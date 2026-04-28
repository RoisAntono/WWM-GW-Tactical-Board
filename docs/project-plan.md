# GWWM Project Plan And Audit Status

Last updated: 2026-04-28

This file is the persistent project plan. Any future architecture plan, audit result, and unfinished work should be recorded here so the project state is visible in the repository, not only in chat.

## Current Execution State

- Current Phase: Encrypted URL Share Link Snapshot
- Current Status: Completed
- Next Action: No scheduled phase remains in the current plan; remaining work is deeper product-specific hardening.
- Last Verified: 2026-04-28, Vercel API share endpoint made self-contained after production module-resolution failures, then verified with `npm run test -- workspaceShortShare workspaceShareLink neonShareSnapshotStore`, `npx tsc --noEmit`, and `npm run build`.

## Current Direction

- The project remains local-first for now. No backend, auth, or multi-device sync is required yet.
- `guild` is the local source of truth for member, match, and performance data.
- `plan.roster` is a tactical snapshot linked by `memberId`, synchronized from `guild`.
- Tactical GW planning is the primary product goal. Member and match tracking should be reliable enough to support tactical work, but it does not need to become a full analytics platform yet.

## Completed From Previous Plans

- Local data center exists under `src/app/data/`.
- `syncPlanWithGuild(plan, guild)` is implemented and used to synchronize roster snapshots.
- Central selectors exist: `selectMemberStats`, `selectPlanSquad`, `selectPlayerView`, `selectRosterCsvRows`.
- Store persist version is currently `10`.
- Store settings include Gemini API key and OCR warning preference.
- Gemini API key is stored locally and is not included in workspace backup.
- Settings page exists with Gemini API key save/clear controls.
- Settings page includes workspace diagnostics for persist version, storage size, guild counts, import batches, map asset, and backup reminder.
- Settings diagnostics include board object counts, export canvas budget, and a runtime frame latency check.
- OCR warning modal exists with "do not warn again" checkbox.
- Custom confirmation dialog replaces browser confirm for destructive flows.
- Match import source supports `csv`, `ocr`, and `gemini`.
- Gemini import exists with `gemini-2.5-flash`.
- OCR/Gemini screenshot import supports multi-file sessions before opening the review table.
- Timestamp-only screenshots can provide match time without creating fake player rows.
- Match review table has `Match Time` as a real row column after `IGN`.
- CSV headers such as `Match Time` are mapped into import rows.
- CSV header `Last Played (GW)` is mapped into member summary imports.
- Member CSV summary stats are preserved as historical baseline when later Match CSV rows are imported.
- Member attendance and averages combine imported summary baseline data with detailed match performance rows.
- Member averages now use per-metric denominators, so missing summary K/A data does not dilute later Match CSV defeated/assist averages.
- Member Data table and member CSV export use `Defeated AVG` for the left game Defeated/kill column, include `Deaths AVG` for the right game Defeated/death column, and no longer show/export `Total Damage`.
- OCR death column mapping is fixed so deaths can be imported.
- Import review number inputs can stay empty instead of becoming forced `0`.
- Import validation centralizes warnings for missing IGN, missing stats, and low confidence.
- Import batches are recorded in `guild.importBatches`.
- Import batches store per-file metadata for file name, source, detected rows, accepted rows, warning count, detected match time, timestamp-only files, average confidence, and file-level errors.
- Import batches do not store raw screenshot content.
- Multi-screenshot import rows carry source file provenance into review.
- Duplicate screenshot rows preserve merged source file names for review.
- Duplicate screenshot rows include an expandable drill-down comparison in the import review source column.
- Screenshot session and import review show detected rows, accepted rows, warnings, merged duplicate count, timestamp-only files, and file-level audit details.
- Workspace history captures `plan`, `guild`, and `activePhaseId`; settings are excluded from undo/redo.
- Workspace backup export/import exists and excludes settings.
- Workspace, guild, and plan imports show a compatibility/count report after restore/import.
- Existing unit tests cover data layer, store history, import validation, import merge, match time parsing, OCR import, Gemini import, workspace serialization, and settings normalization.
- Playwright browser smoke tests cover board canvas render, import review layout, screenshot session modal, settings page, backup report, and custom confirm dialog.
- Playwright visual regression snapshots cover board and settings at desktop/compact viewports plus import review at desktop.
- Fase 1 map optimization is complete:
  - source PNG remains at `Assets/gw-maps.png` with size 37.07 MB,
  - generated WebP is `Assets/gw-maps.webp` with size 0.48 MB,
  - production build emits `dist/assets/gw-maps-*.webp` at 502.28 KB,
  - board runtime uses WebP as the primary map asset.
- Fase 2 modularization pass is complete:
  - store history helpers moved to `src/app/storeHistory.ts`,
  - persisted hydration/migration normalization moved to `src/app/storePersistence.ts`,
  - Member Data header, toolbar, dashboard, table, sorting, and import utility code moved out of `MemberDataPage`,
  - public Zustand action names and user-facing workflows were kept stable.
- Encrypted URL share link snapshot is complete:
  - top bar can generate encrypted one-click share links without backend/database,
  - share payload includes `plan`, `guild`, and `activePhaseId`,
  - settings such as Gemini API key are excluded,
  - receiver flow opens a read-only preview before writing to localStorage,
  - `Save Copy` restores the shared snapshot and preserves the shared active phase.
- Modular short-link storage scaffold is present:
  - provider-specific database assets live under `database/<provider>/`,
  - Neon schema and setup notes live under `database/neon/`,
  - server-side share storage contracts live under `src/server/share/`,
  - runtime database adapters live under `src/server/database/<provider>/`,
  - Vercel API route `/api/share` stores and reads encrypted short-link snapshots with the same schema as the provider-neutral store,
  - top bar share attempts a Neon-backed short link first and falls back to the existing long encrypted URL if the API is unavailable.
  - `npm run dev:vercel` is available for local full-stack Vercel API testing; `npm run dev` remains Vite-only and will use the long URL fallback.
  - Vercel Function `/api/share` keeps the Neon insert/read path self-contained to avoid production bundling failures for local `src/server` imports.
  - `src/server/database` remains as the provider-neutral contract/adaptor scaffold for future maintenance and migration work.

## Known Unfinished Or Weak Areas

1. Store action surface is still large.
   - History and persistence helpers are split out, but `src/app/store.ts` still owns many public actions.
   - Deeper action-slice extraction can wait until behavior changes require it.

2. Member Data import orchestration is still centralized.
   - Header, toolbar, dashboard, table, sorting, and pure import helpers are split out.
   - CSV/OCR/Gemini session orchestration still remains in `MemberDataPage`; a future pass can extract it without changing import behavior.

3. Board performance diagnostics are basic.
   - The heavy map image is fixed.
   - Settings shows board object counts, export canvas budget, and browser frame latency.
   - There is still no dedicated automated zoom/pan/drag/export benchmark with thresholds.

4. Visual regression checks are basic but present.
   - Type checks, unit tests, Playwright browser smoke tests, and Playwright screenshot snapshots exist.
   - Snapshots cover selected desktop/compact states, but not every workflow or browser engine.

5. Import review UX still needs polish.
   - The table works, but wide columns require horizontal scrolling.
   - Duplicate/merge detail now has a drill-down comparison, but it is still compact and table-based.

6. Import confidence/audit trail is improved but not exhaustive.
   - Import batches now store per-file metadata, confidence average, timestamp-only files, and file-level errors.
   - Saved performance rows still do not store row-level source provenance; provenance is visible during review and preserved at batch/file level.

7. Match time logic is functional but still needs real-image validation.
   - Parser supports the expected timestamp format.
   - OCR/Gemini attempt to extract match time.
   - Accuracy still depends on actual screenshots and needs more manual samples.

8. Backup compatibility is basic.
   - Workspace backup exists.
   - Old plan/guild import paths still exist.
   - Restore/import now shows a visible compatibility/count report.

9. In-app diagnostics are basic.
    - Users can see storage size, active map asset, persist version, data counts, and storage/migration status from Settings.
    - Diagnostics include a frame latency check, but not workflow-specific performance benchmarks.

## Recommended Next Plan

### Encrypted URL Share Link Snapshot - Completed 2026-04-28

- Goal: share a local-first workspace without backend/database and without manual import/export.
- Share links carry encrypted snapshot data in the URL hash:
  - `plan`,
  - `guild`,
  - `activePhaseId`.
- Settings, including Gemini API key and OCR warning preference, must not be included.
- The encryption key is intentionally embedded in the URL hash for one-click sharing; anyone with the link can open the snapshot.
- Receiver flow must preview the shared workspace first and only write to localStorage after the user chooses `Save Copy`.
- Implementation needs:
  - share-link crypto/serialization helper,
  - top-bar share button and share modal,
  - startup/hash receiver flow,
  - store action to save a `WorkspaceSnapshot`,
  - read-only board preview support,
  - unit and Playwright coverage.
- Implemented with AES-GCM share hash helpers, share/preview modals, read-only board preview canvas, store snapshot restore action, unit coverage, and Playwright coverage.

### P0 - Fix Known Performance Risk - Completed 2026-04-28

- Replaced direct runtime map usage with same-dimension WebP.
- Added `npm run assets:map` to regenerate the WebP from the PNG source.
- Kept board coordinates stable at 5792x4344.
- Verified production build uses WebP as the primary map asset.

### P1 - Make Plan Tracking Visible

- Keep this file updated for every future implementation plan.
- Add a short `README.md` that links to this file and explains how to run/test the project.

### P1 - Split Large UI Modules - Completed 2026-04-28

- Extracted low-risk Member Data UI modules and import utilities.
- Extracted store history and persistence helpers.
- Kept public store action names stable.
- Left OCR/Gemini orchestration in place to avoid mixing refactor with audit-trail behavior changes.

### P1 - Improve Import Audit Trail - Completed 2026-04-28

- Add per-file metadata to import batches:
  - file name,
  - source,
  - detected rows,
  - accepted rows,
  - warnings,
  - detected match time,
  - whether the file was timestamp-only.
- Do not store raw screenshots in localStorage.
- Added row source provenance in the import review table.
- Added screenshot session and import review audit summaries.
- Added duplicate merge provenance for multi-screenshot rows.

### P2 - Browser-Level Verification - Completed 2026-04-28

- Add Playwright or another browser test setup.
- Cover board render, import review layout, screenshot session modal, settings page, and confirm dialog.
- Added `npm run test:e2e`.
- Added `playwright.config.ts` with Vite dev server integration.
- Added smoke tests for board canvas non-empty pixels, match CSV import review audit UI, screenshot session modal, settings save/toggle, and member delete confirm dialog.

### P2 - In-App Diagnostics - Completed 2026-04-28

- Add a lightweight diagnostics/settings panel showing:
  - persist version,
  - counts for members/matches/performances/import batches,
  - estimated localStorage size,
  - current map asset URL/format,
  - backup/export reminder.
- Added diagnostics helpers and unit tests for storage size/version reporting.
- Added Settings diagnostics panel and Playwright smoke coverage.

### Optional Hardening Pass - Completed 2026-04-28

- Added board diagnostics for marker/route/object counts, export canvas budget, and runtime frame latency.
- Added duplicate-row drill-down comparison in import review.
- Added backup compatibility/count report after workspace, guild, and plan import/restore.
- Added snapshot-based visual regression across desktop/compact viewports.

### Remaining Optional Future Work

- Dedicated automated board performance benchmark for zoom, pan, drag, and export with thresholds.
- Broader snapshot visual regression across more workflows and browser engines.
- Persisted row-level source provenance on saved performance rows if long-term audit requirements need it.

## Verification Commands

Run these after implementation changes:

```bash
npm run assets:map
npm test
npm run test:e2e
npm run test:e2e:update # only when intentionally updating visual snapshots
npx tsc --noEmit
npm run build
```
