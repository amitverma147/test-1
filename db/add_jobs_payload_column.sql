-- db/add_jobs_payload_column.sql
-- Add a jsonb `payload` column to the `jobs` table if it doesn't exist.
-- Run this before enabling the trigger or running the backfill.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS payload jsonb;

-- Optional: create an index for payload if you'll query it by specific keys later.
-- CREATE INDEX IF NOT EXISTS idx_jobs_payload ON public.jobs USING gin (payload jsonb_path_ops);

-- Optionally verify column exists:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='payload';
