# CastUrVote

Secure. Simple. Transparent.

CastUrVote is a web-based EVM-style election management system for schools, colleges, student unions, clubs, department associations, and class representative elections.

## Implemented Workflow

- `E1` Election Officer Dashboard: create/edit election, PINs, voter import, ballot setup, QR pairing, turnout, reports, exports, audit log.
- `V1` Voter Verification Unit: roll-number lookup, eligibility status, duplicate-vote prevention, verification handoff to `C1`.
- `C1` Control Unit: PIN-protected start/close, emergency pause, ballot activation, live position lock status.
- `P1-P4` Voting Units: one position per unit, one vote per position, confirmation, automatic lock after voting.
- Ballot secrecy: votes store only `electionId`, `positionId`, `candidateId`, and timestamp. Roll numbers are kept only in `voter_status`.

## Local Run

### Immediate Static Demo

Open `index.html` directly in a browser. This is the easiest working version and is the one deployed by GitHub Pages.

### Next.js Version

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The app starts with demo data and persists to browser storage. Open the same URL in multiple tabs and select different device roles to simulate real-time device communication.

Demo PINs:

- Start polling: `1234`
- Close polling: `9876`

## Deploy With GitHub Pages

This repo includes `.github/workflows/pages.yml`. After you push to GitHub, the workflow deploys `index.html` automatically.

1. Create a new empty GitHub repository named `CastUrVote`.
2. Run these commands in this folder:

```bash
git config user.name "Your Name"
git config user.email "your-email@example.com"
git add .
git commit -m "Initial CastUrVote deployment"
git remote add origin https://github.com/YOUR-USERNAME/CastUrVote.git
git push -u origin master
```

3. In GitHub, open the repository and go to `Settings` -> `Pages`.
4. Under `Build and deployment`, select `GitHub Actions`.
5. Open the `Actions` tab and wait for `Deploy CastUrVote to GitHub Pages` to finish.

Your site URL will be:

```text
https://YOUR-USERNAME.github.io/CastUrVote/
```

## Firebase Setup

Copy `.env.example` to `.env.local` and fill in the Firebase web app values. The current UI uses a local real-time demo store; `lib/firebase.ts` is ready for replacing that store with Firestore listeners.

Required collections:

- `users`
- `elections`
- `positions`
- `candidates`
- `eligible_voters`
- `votes`
- `voter_status`
- `results`
- `audit_logs`

Every election record includes `electionOfficerId`, and all officer-owned reads/writes should be filtered by `currentUser.uid`. The included `firestore.rules` file shows the intended ownership and ballot-secrecy constraints.

## Import Format

CSV/XLSX voter files support:

```csv
RollNumber,Name,Batch,Email
CS001,Muhammed Yaseen,CSE-A,yaseen@example.com
```

Required fields: roll number, name, batch/class. Email is optional.
