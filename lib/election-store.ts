"use client";

import { initialState } from "./demo-data";
import type { AuditLog, Candidate, CastUrVoteState, DeviceRole, EligibleVoter, ImportSummary, Position, Vote } from "./types";

const STORAGE_KEY = "casturvote-state-v1";
const CHANNEL = "casturvote-realtime";

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function normalizeRoll(value: string) {
  return value.trim().toUpperCase();
}

function log(actor: DeviceRole | "SYSTEM", action: string, details: string): AuditLog {
  return { id: id("log"), timestamp: now(), actor, action, details };
}

function cloneState(state: CastUrVoteState): CastUrVoteState {
  return JSON.parse(JSON.stringify(state)) as CastUrVoteState;
}

export function loadState(): CastUrVoteState {
  if (typeof window === "undefined") return initialState;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return cloneState(initialState);
  try {
    return { ...cloneState(initialState), ...JSON.parse(stored) } as CastUrVoteState;
  } catch {
    return cloneState(initialState);
  }
}

export function saveState(state: CastUrVoteState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  new BroadcastChannel(CHANNEL).postMessage({ type: "state", state });
}

export function subscribeToState(listener: (state: CastUrVoteState) => void) {
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event) => {
    if (event.data?.type === "state") listener(event.data.state);
  };
  const storageListener = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener(loadState());
  };
  window.addEventListener("storage", storageListener);
  return () => {
    channel.close();
    window.removeEventListener("storage", storageListener);
  };
}

export function resetElection(): CastUrVoteState {
  const state = cloneState(initialState);
  saveState(state);
  return state;
}

export function assertOfficerScope(state: CastUrVoteState) {
  if (state.election.electionOfficerId !== state.currentUser.uid) {
    throw new Error("Election officer scope violation.");
  }
}

export function updateElection(state: CastUrVoteState, fields: Partial<CastUrVoteState["election"]>) {
  assertOfficerScope(state);
  return {
    ...state,
    election: { ...state.election, ...fields },
    auditLogs: [log("E1", "Election updated", "Election configuration changed."), ...state.auditLogs]
  };
}

export function setElectionStatus(state: CastUrVoteState, status: CastUrVoteState["election"]["status"], actor: DeviceRole, pin?: string) {
  assertOfficerScope(state);
  if (status === "polling" && pin !== state.election.startPin) throw new Error("Invalid start PIN.");
  if (status === "closed" && pin !== state.election.closePin) throw new Error("Invalid close PIN.");
  return {
    ...state,
    election: {
      ...state.election,
      status,
      activeSession: status === "closed" ? undefined : state.election.activeSession
    },
    auditLogs: [log(actor, `Election ${status}`, `Status changed to ${status}.`), ...state.auditLogs]
  };
}

export function savePositionsAndCandidates(state: CastUrVoteState, positions: Position[], candidates: Candidate[]) {
  assertOfficerScope(state);
  return {
    ...state,
    positions: positions.sort((a, b) => a.order - b.order).slice(0, 4),
    candidates,
    auditLogs: [log("E1", "Ballot configured", "Positions and candidates were updated."), ...state.auditLogs]
  };
}

export function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

export function importVoters(state: CastUrVoteState, rows: Record<string, string>[]): { state: CastUrVoteState; summary: ImportSummary } {
  assertOfficerScope(state);
  const existing = new Set(state.eligibleVoters.map((voter) => normalizeRoll(voter.rollNumber)));
  const next = [...state.eligibleVoters];
  let duplicates = 0;
  let invalid = 0;

  for (const row of rows) {
    const rollNumber = normalizeRoll(row.rollnumber || row["roll number"] || row.roll || "");
    const name = (row.name || row["student name"] || "").trim();
    const batch = (row.batch || row.class || row["batch/class"] || "").trim();
    if (!rollNumber || !name || !batch) {
      invalid += 1;
      continue;
    }
    if (existing.has(rollNumber)) {
      duplicates += 1;
      continue;
    }
    existing.add(rollNumber);
    next.push({
      id: id("voter"),
      electionId: state.election.id,
      rollNumber,
      name,
      batch,
      email: (row.email || "").trim() || undefined,
      eligible: true
    });
  }

  const summary = { imported: next.length - state.eligibleVoters.length, duplicates, invalid, total: rows.length };
  return {
    summary,
    state: {
      ...state,
      eligibleVoters: next,
      auditLogs: [log("E1", "Voters imported", `${summary.imported} imported, ${duplicates} duplicates, ${invalid} invalid.`), ...state.auditLogs]
    }
  };
}

export function findVoter(state: CastUrVoteState, roll: string) {
  const rollNumber = normalizeRoll(roll);
  const voter = state.eligibleVoters.find((entry) => normalizeRoll(entry.rollNumber) === rollNumber);
  const status = state.voterStatus[rollNumber] ?? { electionId: state.election.id, rollNumber, verified: false, voted: false };
  return { voter, status };
}

export function verifyVoter(state: CastUrVoteState, roll: string) {
  const rollNumber = normalizeRoll(roll);
  const { voter, status } = findVoter(state, rollNumber);
  if (!voter || !voter.eligible) throw new Error("Voter is not eligible.");
  if (status.voted) throw new Error("Voter has already voted.");
  return {
    ...state,
    voterStatus: {
      ...state.voterStatus,
      [rollNumber]: { electionId: state.election.id, rollNumber, verified: true, voted: false, verifiedAt: now() }
    },
    election: {
      ...state.election,
      activeSession: { rollNumber, authorized: true, ballotOpen: false, votedPositionIds: [] }
    },
    auditLogs: [log("V1", "Voter verified", `${rollNumber} authorized for ballot activation.`), ...state.auditLogs]
  };
}

export function openBallot(state: CastUrVoteState) {
  if (state.election.status !== "polling") throw new Error("Polling must be active.");
  if (!state.election.activeSession?.authorized) throw new Error("No verified voter waiting.");
  return {
    ...state,
    election: {
      ...state.election,
      activeSession: { ...state.election.activeSession, ballotOpen: true, openedAt: now() }
    },
    auditLogs: [log("C1", "Ballot enabled", `${state.election.activeSession.rollNumber} can vote now.`), ...state.auditLogs]
  };
}

export function castVote(state: CastUrVoteState, positionId: string, candidateId: string) {
  const session = state.election.activeSession;
  if (!session?.ballotOpen) throw new Error("Ballot is locked.");
  if (session.votedPositionIds.includes(positionId)) throw new Error("This position is already recorded.");
  if (!state.candidates.some((candidate) => candidate.id === candidateId && candidate.positionId === positionId)) {
    throw new Error("Invalid candidate for this position.");
  }

  const nextVoted = [...session.votedPositionIds, positionId];
  const vote: Vote = { id: id("vote"), electionId: state.election.id, positionId, candidateId, timestamp: now() };
  const complete = nextVoted.length >= state.positions.length;
  const rollNumber = session.rollNumber;
  const status = state.voterStatus[rollNumber];

  return {
    ...state,
    votes: [...state.votes, vote],
    voterStatus: {
      ...state.voterStatus,
      [rollNumber]: complete ? { ...status, voted: true, votedAt: now() } : status
    },
    election: {
      ...state.election,
      activeSession: complete ? undefined : { ...session, votedPositionIds: nextVoted }
    },
    auditLogs: [log(`P${state.positions.find((p) => p.id === positionId)?.order ?? 1}` as DeviceRole, "Vote recorded", `Vote recorded for ${positionId}. Voter identity was not stored with vote.`), ...state.auditLogs]
  };
}

export function computeResults(state: CastUrVoteState) {
  const totalByPosition = new Map<string, number>();
  for (const vote of state.votes) totalByPosition.set(vote.positionId, (totalByPosition.get(vote.positionId) ?? 0) + 1);
  return state.positions.flatMap((position) => {
    const candidates = state.candidates.filter((candidate) => candidate.positionId === position.id);
    const counts = candidates.map((candidate) => ({
      position,
      candidate,
      votes: state.votes.filter((vote) => vote.candidateId === candidate.id).length
    }));
    const high = Math.max(0, ...counts.map((row) => row.votes));
    return counts.map((row) => ({
      ...row,
      percentage: totalByPosition.get(position.id) ? Math.round((row.votes / (totalByPosition.get(position.id) ?? 1)) * 100) : 0,
      winner: row.votes === high && high > 0
    }));
  });
}

export function exportCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
