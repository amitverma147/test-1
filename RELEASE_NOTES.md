# Release notes — PascoWeb v0.1.0

Summary

This initial release converts a previously mocked UI into a data-driven dashboard backed by Supabase. Key work included:

- CSV and Excel upload with header mapping UI and per-user mapping presets.
- Upload pipeline writes to a RAW staging table and upserts into `jobs` with server-side profit calculations.
- Added fields persisted on `jobs`: `labour_amt`, `part_amt`, `bill_amount`, `profit`, `group_name`, `callback_date`, `technician`, `advisor`.
- Supabase Auth integration and server-side endpoint verification to ensure mapping presets and uploads are stored per-user.
- Replaced several UI mocks with computed values derived from persisted `jobs`.

Important notes

- Apply the SQL in `db/supabase_migrations.sql` before doing live CSV uploads. The app expects those columns/tables to exist.
- The dev environment tolerates missing Supabase env vars but some features (uploading, preset persistence) require proper keys.

How to test quickly

1. Start dev server: `npm run dev` and open http://localhost:3000.
2. Log in using your Supabase credentials (Auth UI is scaffolded in the app).
3. Open the CSV upload dialog and upload a small CSV to verify rows are sent to `/api/upload-csv` and appear in the `jobs` table.

Files added/changed (high level)

- `src/utils/csvMapping.ts` — CSV header/row mapping helpers
- `src/Pages/api_upload-csv.ts` — server endpoint to receive and process CSV rows
- `src/Pages/api_jobs.ts` — secure job create/update endpoint
- `db/supabase_migrations.sql` — SQL to create mapping_presets/profiles/inventory/quick_messages and alter `jobs`
- Various UI components updated to compute from `jobs` instead of mock arrays (ExportReportDialog, InventoryDialog, QuickAccessPanel, CallSmsDialog, BodyshopBottomNav, etc.)

Known issues and next steps

- Type tightening: some `any` usages and JSX shims remain; plan to remove shims once @types/react is validated.
- Bundle size: production build reports large chunk sizes; consider code-splitting or `manualChunks` in `vite.config.ts`.
- CI: a GitHub Actions workflow has been added to run build and tests on push/PR (see `.github/workflows/ci.yml`).
