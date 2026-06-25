"use client";

import { ChangeEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { BarChart3, Check, Download, FileSpreadsheet, Lock, Moon, Pause, Play, Plus, QrCode, RefreshCcw, ShieldCheck, Sun, Trash2, Upload, Vote, X } from "lucide-react";
import { castVote, computeResults, exportCsv, findVoter, importVoters, loadState, openBallot, parseCsv, resetElection, savePositionsAndCandidates, saveState, setElectionStatus, subscribeToState, updateElection, verifyVoter } from "@/lib/election-store";
import type { Candidate, CastUrVoteState, DeviceRole, ImportSummary, Position, ResultRow } from "@/lib/types";

const roleLabels: Record<DeviceRole, string> = {
  E1: "Officer",
  V1: "Verify",
  C1: "Control",
  P1: "Position 1",
  P2: "Position 2",
  P3: "Position 3",
  P4: "Position 4"
};

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function Home() {
  const [state, setState] = useState<CastUrVoteState>(() => loadState());
  const [activeRole, setActiveRole] = useState<DeviceRole>("E1");
  const [dark, setDark] = useState(false);
  const [message, setMessage] = useState("Demo election ready.");

  useEffect(() => subscribeToState(setState), []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  function commit(next: CastUrVoteState, note: string) {
    setState(next);
    saveState(next);
    setMessage(note);
  }

  const stats = useMemo(() => getStats(state), [state]);

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-ink dark:bg-[#121826] dark:text-slate-50">
      <header className="border-b border-line bg-white/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/90 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 text-signal" />
              <h1 className="text-2xl font-bold tracking-normal">CastUrVote</h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">Secure. Simple. Transparent.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={state.election.status} />
            <IconButton label="Toggle theme" onClick={() => setDark((value) => !value)}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </IconButton>
            <IconButton
              label="Reset demo"
              onClick={() => {
                const next = resetElection();
                setState(next);
                setMessage("Demo data reset.");
              }}
            >
              <RefreshCcw className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-lg border border-line bg-white p-3 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(roleLabels) as DeviceRole[]).map((role) => (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className={classNames(
                  "rounded-md border px-3 py-2 text-left text-sm transition",
                  activeRole === role ? "border-signal bg-signal text-white" : "border-line bg-white hover:border-signal dark:border-slate-700 dark:bg-slate-950"
                )}
              >
                <span className="block font-semibold">{role}</span>
                <span className="text-xs opacity-80">{roleLabels[role]}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-2">
            <Metric label="Eligible" value={stats.eligible} />
            <Metric label="Verified" value={stats.verified} />
            <Metric label="Voted" value={stats.voted} />
            <Metric label="Turnout" value={`${stats.turnout}%`} />
          </div>

          <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {message}
          </div>
        </aside>

        <div className="grid gap-4">
          {activeRole === "E1" && <OfficerDashboard state={state} commit={commit} results={computeResults(state)} />}
          {activeRole === "V1" && <Verifier state={state} commit={commit} />}
          {activeRole === "C1" && <ControlUnit state={state} commit={commit} />}
          {activeRole.startsWith("P") && <VotingUnit role={activeRole} state={state} commit={commit} />}
        </div>
      </section>
    </main>
  );
}

function OfficerDashboard({ state, commit, results }: { state: CastUrVoteState; commit: (state: CastUrVoteState, note: string) => void; results: ResultRow[] }) {
  const [draftElection, setDraftElection] = useState(state.election);
  const [pin, setPin] = useState("");
  const [positions, setPositions] = useState<Position[]>(state.positions);
  const [candidates, setCandidates] = useState<Candidate[]>(state.candidates);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraftElection(state.election);
    setPositions(state.positions);
    setCandidates(state.candidates);
  }, [state]);

  async function generateQr() {
    const QRCode = await import("qrcode");
    const next: Record<string, string> = {};
    for (const [role, value] of Object.entries(state.election.devicePairing)) {
      next[role] = await QRCode.toDataURL(value, { margin: 1, width: 120 });
    }
    setQrCodes(next);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    let rows: Record<string, string>[] = [];
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
      rows = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), String(value)])));
    } else {
      rows = parseCsv(await file.text());
    }
    const imported = importVoters(state, rows);
    setSummary(imported.summary);
    commit(imported.state, `Imported ${imported.summary.imported} voters.`);
    event.target.value = "";
  }

  const closed = state.election.status === "closed" || state.election.status === "published";

  return (
    <section className="grid gap-4">
      <Panel title="Election Officer Dashboard" icon={<ShieldCheck className="h-5 w-5" />}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Election Name" value={draftElection.title} onChange={(value) => setDraftElection({ ...draftElection, title: value })} />
          <Field label="Organization" value={draftElection.organization} onChange={(value) => setDraftElection({ ...draftElection, organization: value })} />
          <Field label="Start PIN" value={draftElection.startPin} onChange={(value) => setDraftElection({ ...draftElection, startPin: value.replace(/\D/g, "").slice(0, 4) })} />
          <Field label="Close PIN" value={draftElection.closePin} onChange={(value) => setDraftElection({ ...draftElection, closePin: value.replace(/\D/g, "").slice(0, 4) })} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <ActionButton onClick={() => commit(updateElection(state, draftElection), "Election saved.")} icon={<Check className="h-4 w-4" />}>Save</ActionButton>
          <ActionButton onClick={() => commit(setElectionStatus(state, "polling", "E1", pin), "Polling started.")} icon={<Play className="h-4 w-4" />}>Start</ActionButton>
          <ActionButton onClick={() => commit(setElectionStatus(state, "paused", "E1"), "Polling paused.")} icon={<Pause className="h-4 w-4" />}>Pause</ActionButton>
          <ActionButton onClick={() => commit(setElectionStatus(state, "closed", "E1", pin), "Polling closed. Results unlocked.")} icon={<Lock className="h-4 w-4" />}>Close</ActionButton>
          <ActionButton onClick={() => commit(setElectionStatus(state, "published", "E1"), "Results published.")} icon={<BarChart3 className="h-4 w-4" />}>Publish</ActionButton>
          <input className="w-24 rounded-md border border-line px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="PIN" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} />
        </div>
      </Panel>

      <Panel title="Eligible Voters" icon={<Upload className="h-5 w-5" />}>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-signal px-3 py-2 text-sm font-semibold text-white">
            <FileSpreadsheet className="h-4 w-4" />
            Import CSV/XLSX
            <input type="file" accept=".csv,.xlsx" className="sr-only" onChange={handleImport} />
          </label>
          {summary && <span className="text-sm text-slate-600 dark:text-slate-300">{summary.imported} imported, {summary.duplicates} duplicates, {summary.invalid} invalid</span>}
          <ActionButton
            onClick={() => exportCsv("casturvote-voters.csv", [["Roll Number", "Name", "Batch", "Email"], ...state.eligibleVoters.map((voter) => [voter.rollNumber, voter.name, voter.batch, voter.email ?? ""])])}
            icon={<Download className="h-4 w-4" />}
          >
            Voters
          </ActionButton>
        </div>
        <DataTable
          headers={["Roll", "Name", "Batch", "Status"]}
          rows={state.eligibleVoters.slice(0, 8).map((voter) => [voter.rollNumber, voter.name, voter.batch, state.voterStatus[voter.rollNumber]?.voted ? "Voted" : state.voterStatus[voter.rollNumber]?.verified ? "Verified" : "Waiting"])}
        />
      </Panel>

      <Panel title="Ballot Setup" icon={<Vote className="h-5 w-5" />}>
        <div className="grid gap-3 xl:grid-cols-2">
          {positions.map((position, index) => (
            <div key={position.id} className="rounded-lg border border-line p-3 dark:border-slate-700">
              <Field label={`P${index + 1} Position`} value={position.name} onChange={(value) => setPositions(positions.map((item) => (item.id === position.id ? { ...item, name: value } : item)))} />
              <div className="mt-3 grid gap-2">
                {candidates.filter((candidate) => candidate.positionId === position.id).map((candidate) => (
                  <div key={candidate.id} className="grid gap-2 sm:grid-cols-[1fr_110px_40px]">
                    <input className="rounded-md border border-line px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" value={candidate.name} onChange={(event) => setCandidates(candidates.map((item) => (item.id === candidate.id ? { ...item, name: event.target.value } : item)))} />
                    <input className="rounded-md border border-line px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" value={candidate.symbol} onChange={(event) => setCandidates(candidates.map((item) => (item.id === candidate.id ? { ...item, symbol: event.target.value } : item)))} />
                    <IconButton label="Remove candidate" onClick={() => setCandidates(candidates.filter((item) => item.id !== candidate.id))}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                ))}
                <ActionButton
                  onClick={() => setCandidates([...candidates, { id: `c-${Date.now()}`, positionId: position.id, name: "New Candidate", symbol: "Symbol" }])}
                  icon={<Plus className="h-4 w-4" />}
                >
                  Candidate
                </ActionButton>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <ActionButton onClick={() => commit(savePositionsAndCandidates(state, positions, candidates), "Ballot setup saved.")} icon={<Check className="h-4 w-4" />}>Save Ballot</ActionButton>
        </div>
      </Panel>

      <Panel title="QR Device Pairing" icon={<QrCode className="h-5 w-5" />}>
        <ActionButton onClick={generateQr} icon={<QrCode className="h-4 w-4" />}>Generate Codes</ActionButton>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(state.election.devicePairing) as DeviceRole[]).map((role) => (
            <div key={role} className="rounded-lg border border-line p-3 text-center dark:border-slate-700">
              <div className="text-sm font-semibold">{role} {roleLabels[role]}</div>
              {qrCodes[role] ? <img src={qrCodes[role]} alt={`${role} pairing QR`} className="mx-auto mt-2 h-28 w-28" /> : <div className="mx-auto mt-2 grid h-28 w-28 place-items-center bg-slate-100 text-xs dark:bg-slate-800">QR</div>}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Reports and Results" icon={<BarChart3 className="h-5 w-5" />}>
        {!closed ? (
          <div className="rounded-md border border-caution/30 bg-amber-50 p-3 text-sm text-caution dark:bg-amber-950/30">Results are hidden until polling is closed.</div>
        ) : (
          <>
            <ResultsTable results={results} />
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton onClick={() => exportCsv("casturvote-results.csv", [["Position", "Candidate", "Votes", "Percentage", "Winner"], ...results.map((row) => [row.position.name, row.candidate.name, String(row.votes), `${row.percentage}%`, row.winner ? "Yes" : "No"])])} icon={<Download className="h-4 w-4" />}>Excel CSV</ActionButton>
              <ActionButton onClick={() => window.print()} icon={<Download className="h-4 w-4" />}>PDF</ActionButton>
            </div>
          </>
        )}
      </Panel>

      <Panel title="Audit Logs" icon={<ShieldCheck className="h-5 w-5" />}>
        <DataTable headers={["Time", "Actor", "Action", "Details"]} rows={state.auditLogs.slice(0, 10).map((entry) => [new Date(entry.timestamp).toLocaleTimeString(), entry.actor, entry.action, entry.details])} />
      </Panel>
    </section>
  );
}

function Verifier({ state, commit }: { state: CastUrVoteState; commit: (state: CastUrVoteState, note: string) => void }) {
  const [roll, setRoll] = useState("");
  const lookup = findVoter(state, roll);
  const canVerify = Boolean(lookup.voter?.eligible && !lookup.status.voted && state.election.status === "polling");

  return (
    <Panel title="V1 Voter Verification Unit" icon={<ShieldCheck className="h-5 w-5" />}>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          <Field label="Roll Number" value={roll} onChange={(value) => setRoll(value.toUpperCase())} placeholder="CS001" />
          <div className="mt-4 rounded-lg border border-line p-4 dark:border-slate-700">
            {!roll ? <p className="text-sm text-slate-600 dark:text-slate-300">Enter a roll number to check the eligible voter list.</p> : lookup.voter ? (
              <div className="grid gap-2">
                <div className="text-xl font-bold">{lookup.voter.name}</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">{lookup.voter.batch} {lookup.voter.email ? `- ${lookup.voter.email}` : ""}</div>
                <EligibilityLine ok={lookup.voter.eligible && !lookup.status.voted} text={lookup.status.voted ? "Already Voted" : lookup.voter.eligible ? "Eligible to Vote" : "Not Eligible"} />
                <div className="text-sm">Voting status: {lookup.status.voted ? "Voted" : lookup.status.verified ? "Verified" : "Not verified"}</div>
              </div>
            ) : <EligibilityLine ok={false} text="Not Eligible" />}
          </div>
          <div className="mt-4">
            <ActionButton disabled={!canVerify} onClick={() => commit(verifyVoter(state, roll), "Voter verified. C1 can now enable ballot.")} icon={<Check className="h-4 w-4" />}>Verify Voter</ActionButton>
          </div>
        </div>
        <DeviceCard role="V1" />
      </div>
    </Panel>
  );
}

function ControlUnit({ state, commit }: { state: CastUrVoteState; commit: (state: CastUrVoteState, note: string) => void }) {
  const [pin, setPin] = useState("");
  const session = state.election.activeSession;
  const ballotReady = Boolean(session?.authorized && !session.ballotOpen && state.election.status === "polling");

  return (
    <Panel title="C1 Control Unit" icon={<Lock className="h-5 w-5" />}>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="grid gap-3">
          <div className="rounded-lg border border-line p-4 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-300">Current authorization</div>
            <div className="mt-1 text-2xl font-bold">{session ? session.rollNumber : "No verified voter"}</div>
            <div className="mt-2 text-sm">{session?.ballotOpen ? "P1-P4 are unlocked." : session?.authorized ? "Ballot button is active." : "Waiting for V1."}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton disabled={!ballotReady} onClick={() => commit(openBallot(state), "Ballot enabled. P1-P4 unlocked.")} icon={<Vote className="h-4 w-4" />}>Ballot</ActionButton>
            <ActionButton onClick={() => commit(setElectionStatus(state, "polling", "C1", pin), "Polling started from C1.")} icon={<Play className="h-4 w-4" />}>Start Polling</ActionButton>
            <ActionButton onClick={() => commit(setElectionStatus(state, "paused", "C1"), "Emergency pause activated.")} icon={<Pause className="h-4 w-4" />}>Emergency Pause</ActionButton>
            <ActionButton onClick={() => commit(setElectionStatus(state, "closed", "C1", pin), "Polling closed from C1.")} icon={<Lock className="h-4 w-4" />}>Close Polling</ActionButton>
            <input className="w-24 rounded-md border border-line px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="PIN" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {state.positions.map((position) => (
              <div key={position.id} className={classNames("rounded-md border p-3 text-sm", session?.ballotOpen && !session.votedPositionIds.includes(position.id) ? "border-signal bg-emerald-50 text-signal dark:bg-emerald-950/30" : "border-line dark:border-slate-700")}>
                <div className="font-semibold">P{position.order}</div>
                <div>{session?.votedPositionIds.includes(position.id) ? "Recorded" : session?.ballotOpen ? "Unlocked" : "Locked"}</div>
              </div>
            ))}
          </div>
        </div>
        <DeviceCard role="C1" />
      </div>
    </Panel>
  );
}

function VotingUnit({ role, state, commit }: { role: DeviceRole; state: CastUrVoteState; commit: (state: CastUrVoteState, note: string) => void }) {
  const order = Number(role.slice(1));
  const position = state.positions.find((item) => item.order === order);
  const candidates = state.candidates.filter((candidate) => candidate.positionId === position?.id);
  const session = state.election.activeSession;
  const locked = !session?.ballotOpen || !position || session.votedPositionIds.includes(position.id);

  return (
    <Panel title={`${role} Voting Unit`} icon={<Vote className="h-5 w-5" />}>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-line p-4 dark:border-slate-700">
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-300">Position</div>
              <div className="text-2xl font-bold">{position?.name ?? "Unassigned"}</div>
            </div>
            <StatusPill locked={locked} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                disabled={locked}
                onClick={() => {
                  if (position && window.confirm(`Record vote for ${candidate.name}?`)) {
                    commit(castVote(state, position.id, candidate.id), "Vote recorded successfully.");
                  }
                }}
                className="rounded-lg border border-line bg-white p-4 text-left shadow-sm transition hover:border-signal disabled:cursor-not-allowed disabled:opacity-55 dark:border-slate-700 dark:bg-slate-950"
              >
                <div className="flex items-center gap-3">
                  {candidate.photoUrl ? <img src={candidate.photoUrl} alt="" className="h-16 w-16 rounded-md object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-md bg-slate-100 dark:bg-slate-800"><Vote className="h-6 w-6" /></div>}
                  <div>
                    <div className="text-lg font-bold">{candidate.name}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">Symbol: {candidate.symbol}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {position && session?.votedPositionIds.includes(position.id) && <div className="mt-4 rounded-md border border-signal/30 bg-emerald-50 p-3 text-sm font-semibold text-signal dark:bg-emerald-950/30">Vote Recorded Successfully</div>}
        </div>
        <DeviceCard role={role} />
      </div>
    </Panel>
  );
}

function getStats(state: CastUrVoteState) {
  const eligible = state.eligibleVoters.filter((voter) => voter.eligible).length;
  const statuses = Object.values(state.voterStatus);
  const verified = statuses.filter((status) => status.verified).length;
  const voted = statuses.filter((status) => status.voted).length;
  return { eligible, verified, voted, remaining: Math.max(0, eligible - voted), turnout: eligible ? Math.round((voted / eligible) * 100) : 0 };
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-signal">{icon}</span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      <input className="rounded-md border border-line px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ActionButton({ children, icon, onClick, disabled }: { children: ReactNode; icon: ReactNode; onClick: () => void | Promise<void>; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={() => {
        try {
          Promise.resolve(onClick()).catch((error) => window.alert(error instanceof Error ? error.message : "Action failed."));
        } catch (error) {
          window.alert(error instanceof Error ? error.message : "Action failed.");
        }
      }}
      className="inline-flex items-center gap-2 rounded-md bg-signal px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {icon}
      {children}
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} className="grid h-10 w-10 place-items-center rounded-md border border-line bg-white hover:border-signal dark:border-slate-700 dark:bg-slate-950">
      {children}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-line px-3 py-2 dark:border-slate-700">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className="rounded-full border border-signal/30 bg-emerald-50 px-3 py-1 text-sm font-semibold capitalize text-signal dark:bg-emerald-950/30">{status}</span>;
}

function StatusPill({ locked }: { locked: boolean }) {
  return locked ? <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200"><Lock className="h-4 w-4" /> Locked</span> : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-signal dark:bg-emerald-950/30"><Check className="h-4 w-4" /> Unlocked</span>;
}

function EligibilityLine({ ok, text }: { ok: boolean; text: string }) {
  return <div className={classNames("inline-flex items-center gap-2 text-sm font-semibold", ok ? "text-signal" : "text-danger")}>{ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}{text}</div>;
}

function DeviceCard({ role }: { role: DeviceRole }) {
  return (
    <div className="rounded-lg border border-line bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="text-sm text-slate-600 dark:text-slate-300">Paired device</div>
      <div className="mt-1 text-4xl font-black">{role}</div>
      <div className="mt-2 text-sm">{roleLabels[role]}</div>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>{headers.map((header) => <th key={header} className="border-b border-line px-3 py-2 dark:border-slate-700">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, index) => <td key={`${rowIndex}-${index}`} className="border-b border-line px-3 py-2 dark:border-slate-800">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultsTable({ results }: { results: ResultRow[] }) {
  return (
    <div className="grid gap-4">
      {Array.from(new Set(results.map((row) => row.position.id))).map((positionId) => {
        const rows = results.filter((row) => row.position.id === positionId);
        return (
          <div key={positionId} className="rounded-lg border border-line p-3 dark:border-slate-700">
            <div className="font-bold">{rows[0]?.position.name}</div>
            <div className="mt-3 grid gap-2">
              {rows.map((row) => (
                <div key={row.candidate.id} className="grid grid-cols-[1fr_80px_80px] items-center gap-2 text-sm">
                  <span>{row.candidate.name}{row.winner ? " - Winner" : ""}</span>
                  <span className="font-semibold">{row.votes} votes</span>
                  <span>{row.percentage}%</span>
                  <div className="col-span-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-2 rounded-full bg-signal" style={{ width: `${row.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
