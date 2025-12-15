Backfill `jobs.payload` from `bhiwani_service_jobs_raw`
===============================================

This document explains how to safely add a `payload` column to `public.jobs` and run a one-time backfill that copies existing rows from `public.bhiwani_service_jobs_raw` into `jobs.payload`.

High-level steps
1. Ensure your `jobs` table has a `payload` column (jsonb). Run `db/add_jobs_payload_column.sql` from the Supabase SQL editor or via your migration tooling.
2. (Optional) Review and apply `db/sync_raw_to_jobs_trigger.sql` which also sets `jobs.payload = to_jsonb(NEW)` for new/updated raw rows.
3. Run the one-time backfill script in `scripts/backfill_jobs_payload.js`.

Precautions
- This script uses the Supabase service role key; do NOT expose this key in the browser. Keep it in a secure environment variable.
- Test using `DRY_RUN=1` before making changes.
- The script upserts rows into `jobs` keyed by a derived `id` (same logic as the trigger: job_card_number → bill_no → raw-<id>). If you have a different identifier strategy, modify `scripts/backfill_jobs_payload.js` accordingly.
- For very large datasets, consider running with a smaller batch size (`BATCH_SIZE=100`) and monitor DB load.

Quick commands

From the repository root (requires node and npm-installed dependencies):

```bash
# preview changes (no writes)
DRY_RUN=1 node scripts/backfill_jobs_payload.js

# real run (ensure env vars SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set)
node scripts/backfill_jobs_payload.js
```

Environment variables required
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (service role key)
- Optional: DRY_RUN=1 to avoid writes, BATCH_SIZE to control batch size

Verification
- In Supabase SQL editor:
  SELECT id, payload FROM public.jobs WHERE payload IS NOT NULL LIMIT 10;

If you want me to change the backfill mapping (e.g., map specific raw fields into top-level job columns while backfilling), tell me which columns to map and I'll update the script.
