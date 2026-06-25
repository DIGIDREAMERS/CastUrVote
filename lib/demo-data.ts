import type { CastUrVoteState, DeviceRole } from "./types";

const deviceRoles: DeviceRole[] = ["E1", "V1", "C1", "P1", "P2", "P3", "P4"];

const devicePairing = deviceRoles.reduce(
  (acc, role) => ({ ...acc, [role]: `casturvote://${role.toLowerCase()}/demo-election/${cryptoSafe(role)}` }),
  {} as Record<DeviceRole, string>
);

function cryptoSafe(seed: string) {
  return `pair-${seed}-2026`;
}

export const initialState: CastUrVoteState = {
  currentUser: {
    uid: "officer-demo-001",
    name: "Election Officer",
    role: "election_officer"
  },
  election: {
    id: "demo-election",
    electionOfficerId: "officer-demo-001",
    title: "College Union Election 2026",
    organization: "CastUrVote Demo Campus",
    tagline: "Secure. Simple. Transparent.",
    status: "draft",
    startPin: "1234",
    closePin: "9876",
    devicePairing
  },
  positions: [
    { id: "chairperson", order: 1, name: "Chairperson" },
    { id: "general-secretary", order: 2, name: "General Secretary" },
    { id: "treasurer", order: 3, name: "Treasurer" },
    { id: "arts-secretary", order: 4, name: "Arts Secretary" }
  ],
  candidates: [
    { id: "c-1", positionId: "chairperson", name: "Amina K", symbol: "Lamp", photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80" },
    { id: "c-2", positionId: "chairperson", name: "Rahul P", symbol: "Book", photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80" },
    { id: "c-3", positionId: "general-secretary", name: "Neha S", symbol: "Star", photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80" },
    { id: "c-4", positionId: "general-secretary", name: "Arjun V", symbol: "Tree", photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80" },
    { id: "c-5", positionId: "treasurer", name: "Fathima R", symbol: "Key", photoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80" },
    { id: "c-6", positionId: "treasurer", name: "Joel M", symbol: "Pen", photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80" },
    { id: "c-7", positionId: "arts-secretary", name: "Diya N", symbol: "Drum", photoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=160&q=80" },
    { id: "c-8", positionId: "arts-secretary", name: "Kiran T", symbol: "Brush", photoUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=160&q=80" }
  ],
  eligibleVoters: [
    { id: "v-CS001", electionId: "demo-election", rollNumber: "CS001", name: "Muhammed Yaseen", batch: "CSE-A", email: "yaseen@example.com", eligible: true },
    { id: "v-CS002", electionId: "demo-election", rollNumber: "CS002", name: "Ananya R", batch: "CSE-A", email: "ananya@example.com", eligible: true },
    { id: "v-EC011", electionId: "demo-election", rollNumber: "EC011", name: "Vishnu K", batch: "ECE-B", eligible: true },
    { id: "v-ME021", electionId: "demo-election", rollNumber: "ME021", name: "Sara P", batch: "ME-A", eligible: true }
  ],
  voterStatus: {},
  votes: [],
  auditLogs: [
    {
      id: "log-boot",
      timestamp: new Date().toISOString(),
      actor: "SYSTEM",
      action: "System ready",
      details: "Demo election initialized with isolated officer-owned data."
    }
  ]
};
