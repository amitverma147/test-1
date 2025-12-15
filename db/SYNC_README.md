How to apply the raw->jobs sync trigger

This repository includes a SQL file that creates a trigger to upsert a selected set of columns from `public.bhiwani_service_jobs_raw` into `public.jobs` whenever a row is inserted or updated.

File:
- `db/sync_raw_to_jobs_trigger.sql`

How to apply

1. Open your Supabase project SQL editor and paste the contents of `db/sync_raw_to_jobs_trigger.sql`, then run it.

OR

2. Using the supabase CLI (if configured):
   - Copy the file to a migration and run `supabase db push` / `supabase db reset` depending on your workflow.

What the trigger does

- On INSERT or UPDATE of `bhiwani_service_jobs_raw` it will upsert a conservative set of columns into the `jobs` table:
  id, job_card_number, reg_no, model, color, customer_name, customer_mobile, job_type,
  advisor, technician, status, labour_amt, part_amt, bill_amount, profit, created_at,
  updated_at, follow_up_date, dealer_name, dealer_city, location

- It intentionally updates only these columns to avoid overwriting complex job state (activity logs, photos, services, etc.). Adjust the SQL if you want a different policy.

Verifying the sync

1. Insert a test row into `bhiwani_service_jobs_raw` (via the SQL editor or your upload flow).
2. Query `select * from public.jobs where id = '<the id you expect>';` and verify expected columns are present.
3. Update a raw row and ensure the corresponding `jobs.updated_at` changes and mapped fields reflect the update.

Notes and caveats

- The trigger assumes `jobs.id` exists as a primary key and uses `job_card_number`/`bill_no`/`raw-<raw id>` to derive an id.
- If your `jobs` schema differs, open `db/sync_raw_to_jobs_trigger.sql` and adapt column names/types.
- For large uploads you may prefer to run a server-side batch mapping (the project already contains `src/Pages/api_upload-csv.ts`) instead of relying solely on a trigger.

If you want, I can also add a short CLI script to run a one-time backfill from existing rows in `bhiwani_service_jobs_raw` to `jobs`.