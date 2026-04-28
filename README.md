# Guild Wars Tactical Board

Local-first tactical planning board for Guild War coordination, roster management, match history, and member performance tracking.

This app is designed to run without a backend or database. Workspace data is stored in browser `localStorage`, can be backed up/restored as JSON, and can be shared as an encrypted URL snapshot.

## Features

- Tactical board with Guild War map, objective presets, player markers, routes, zones, and notes.
- Multi-phase battle plan flow for opening, rotations, objective setup, siege, defense, and endgame.
- Member database with rank, role, team, party, status, attendance, and performance averages.
- Match import from CSV, local OCR, or Gemini Vision.
- Import review table before saving match history.
- Per-file import audit metadata for screenshot and CSV imports.
- Workspace backup and restore.
- Encrypted URL share snapshot without backend/database.
- Settings page with local diagnostics, map asset info, storage usage, and frame latency check.
- Local Gemini API key storage for optional Gemini screenshot import.

## Tech Stack

- React 19
- TypeScript
- Vite
- Zustand
- Konva / React Konva
- Papa Parse
- Tesseract.js
- Playwright
- Vitest

## Data Model

The workspace is split into two main parts:

- `guild`: source of truth for members, matches, performance rows, and import batches.
- `plan`: tactical board snapshot linked to guild members by `memberId`.

Local settings, including the Gemini API key, are not included in workspace backups or encrypted share links.

## Optional Server Storage

The app is local-first, but the repository includes a modular database structure for future short encrypted share links:

```text
database/
  neon/
    migrations/
    README.md
src/server/
  share/
  database/
    neon/
```

The intended rule is simple: feature code depends on the provider-neutral `ShareSnapshotStore` interface, while vendor-specific schema and adapters stay under their own provider folders. If the project later moves from Neon to another provider, add a new `database/<provider>/` folder and a matching `src/server/database/<provider>/` adapter.

### Neon Short Share Setup

Short encrypted share links use the Vercel API route at `/api/share` and store only encrypted snapshot data in Neon.

1. Create a Neon project.
2. Copy the connection string into local `.env` for development:

```text
NEON_DATABASE_URL=postgresql://...
SHARE_STORAGE_PROVIDER=neon
```

3. Run the migration SQL in the Neon SQL Editor:

```text
database/neon/migrations/001_create_share_snapshots.sql
```

4. Add the same environment variables in Vercel Project Settings:

```text
NEON_DATABASE_URL=postgresql://...
SHARE_STORAGE_PROVIDER=neon
```

5. Deploy to Vercel.

For local API testing, use Vercel's local runtime:

```bash
npm run dev:vercel
```

`npm run dev` starts only the Vite frontend, so short-link API calls will fall back to the long encrypted URL during local frontend-only development.

## Privacy And Storage

This project is local-first:

- No backend is required.
- No database is required.
- Main workspace data is stored in browser `localStorage`.
- Raw screenshots are not stored in backups or import history.
- The Gemini API key is stored only in the current browser.
- Encrypted share links include the decrypt key in the URL hash so anyone with the link can open the snapshot.
- Short share links store only encrypted ciphertext in Neon. The decrypt key remains in the URL hash.

Encrypted share links are snapshots, not live sync.

## CSV Import Notes

Match CSV supports headers such as:

```csv
Player Name,Date,Kills,Assist,Deaths,Fun Coin,Damage,Tank,Heal,Siege Damage
Nyx',2026/04/19 21:03,11,21,11,792,7149041,3725268,56166,0
```

Member summary CSV supports headers such as:

```csv
IGN,Attendance,Last Played (GW),Defeated AVG,Assist AVG,Deaths AVG,DPS AVG,Heal AVG,Tank AVG,Siege AVG,Coin AVG
Nyx',16,18-Apr-2026,3,17,1,5962933,6558,1850864,442310,1617
```

The game may show two `Defeated` columns. In this app:

- The left `Defeated` column is treated as defeated/kills.
- The right `Defeated` column is treated as deaths.
- Match review displays these as `Kills`, `Assist`, and `Deaths` for clarity.
- Member Data displays aggregated `Defeated AVG`, `Assist AVG`, and `Deaths AVG`.

## Getting Started

### Requirements

- Node.js 20 or newer recommended.
- npm.

### Install

```bash
npm install
```

### Generate Optimized Map Asset

The source map image lives in `Assets/gw-maps.png`. The app uses an optimized WebP generated from that source.

```bash
npm run assets:map
```

### Start Development Server

```bash
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Verification

Run these before publishing or after meaningful changes:

```bash
npm run assets:map
npm test
npm run test:e2e
npx tsc --noEmit
npm run build
```

Update Playwright visual snapshots only when the UI change is intentional:

```bash
npm run test:e2e:update
```

## Deployment

This app can be deployed as a static Vite site, for example on Vercel.

Recommended Vercel settings:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

Because the app is local-first, deployed hosting only serves the frontend. User workspace data remains in each browser's local storage unless the user exports, restores, or opens an encrypted share snapshot.

## Project Plan

The persistent implementation plan and audit status are tracked in:

- [docs/project-plan.md](docs/project-plan.md)

Keep that file updated when adding major features, changing architecture, or leaving unfinished work.

## Repository Structure

```text
Assets/                 Source and generated map assets
database/               Provider-specific database schemas and migrations
docs/                   Project plan and audit notes
scripts/                Utility scripts
api/                    Vercel API routes for optional server-side features
src/app/                Store, data layer, persistence, share link helpers
src/features/           Board, guild/member data, roster import, strategy UI
src/server/             Provider-neutral server contracts and database adapters
src/shared/             Shared constants, formatting, dialogs, helpers
src/styles/             Global styles
src/types/              Domain types
tests/e2e/              Playwright smoke and visual tests
```

## License

MIT License. See [LICENSE](LICENSE).
