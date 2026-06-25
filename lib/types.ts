export type ElectionStatus = "draft" | "polling" | "paused" | "closed" | "published";
export type DeviceRole = "E1" | "V1" | "C1" | "P1" | "P2" | "P3" | "P4";

export type Candidate = {
  id: string;
  positionId: string;
  name: string;
  symbol: string;
  photoUrl?: string;
};

export type Position = {
  id: string;
  order: number;
  name: string;
};

export type EligibleVoter = {
  id: string;
  electionId: string;
  rollNumber: string;
  name: string;
  batch: string;
  email?: string;
  eligible: boolean;
};

export type VoterStatus = {
  electionId: string;
  rollNumber: string;
  verified: boolean;
  voted: boolean;
  verifiedAt?: string;
  votedAt?: string;
};

export type Vote = {
  id: string;
  electionId: string;
  positionId: string;
  candidateId: string;
  timestamp: string;
};

export type AuditLog = {
  id: string;
  timestamp: string;
  actor: DeviceRole | "SYSTEM";
  action: string;
  details: string;
};

export type Election = {
  id: string;
  electionOfficerId: string;
  title: string;
  organization: string;
  tagline: string;
  status: ElectionStatus;
  startPin: string;
  closePin: string;
  devicePairing: Record<DeviceRole, string>;
  activeSession?: {
    rollNumber: string;
    authorized: boolean;
    ballotOpen: boolean;
    openedAt?: string;
    votedPositionIds: string[];
  };
};

export type ImportSummary = {
  imported: number;
  duplicates: number;
  invalid: number;
  total: number;
};

export type CastUrVoteState = {
  currentUser: {
    uid: string;
    name: string;
    role: "election_officer";
  };
  election: Election;
  positions: Position[];
  candidates: Candidate[];
  eligibleVoters: EligibleVoter[];
  voterStatus: Record<string, VoterStatus>;
  votes: Vote[];
  auditLogs: AuditLog[];
};

export type ResultRow = {
  position: Position;
  candidate: Candidate;
  votes: number;
  percentage: number;
  winner: boolean;
};
