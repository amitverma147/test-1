-- db/sync_raw_to_jobs_trigger.sql
-- Create a trigger that upserts selected columns from
-- public.bhiwani_service_jobs_raw into public.jobs on INSERT or UPDATE.
-- Run this in Supabase SQL editor or via supabase CLI.

-- IMPORTANT: review the selected columns below and adjust as needed for
-- your jobs table schema. This is idempotent (uses CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.sync_bhiwani_raw_to_jobs()
RETURNS trigger AS $$
DECLARE
  target_id TEXT;
  labour_val NUMERIC;
  part_val NUMERIC;
  bill_val NUMERIC;
  computed_profit NUMERIC;
  jc_ts timestamptz;
  followup_ts timestamptz;
  jt TEXT;
BEGIN
  -- Determine an ID for jobs: prefer job_card_number, then bill_no, otherwise derive from raw id
  target_id := COALESCE(NEW.job_card_number, NEW.job_card_no, NEW.bill_no, NEW.bill_no_1, 'raw-' || NEW.id::text);

  -- Parse numeric-ish fields conservatively (strip non-numeric characters)
  BEGIN
    labour_val := NULLIF(regexp_replace(COALESCE(NEW.labour_amt::text, NEW.estlab_amt::text, ''), '[^0-9.-]', '', 'g'), '')::numeric;
  EXCEPTION WHEN others THEN
    labour_val := NULL;
  END;
  BEGIN
    part_val := NULLIF(regexp_replace(COALESCE(NEW.part_amt::text, NEW.estpart_amt::text, ''), '[^0-9.-]', '', 'g'), '')::numeric;
  EXCEPTION WHEN others THEN
    part_val := NULL;
  END;
  BEGIN
    bill_val := NULLIF(regexp_replace(COALESCE(NEW.bill_amount::text, NEW.bill_no::text, ''), '[^0-9.-]', '', 'g'), '')::numeric;
  EXCEPTION WHEN others THEN
    bill_val := NULL;
  END;

  IF bill_val IS NOT NULL THEN
    computed_profit := bill_val - COALESCE(labour_val, 0) - COALESCE(part_val, 0);
  ELSE
    computed_profit := NULL;
  END IF;

  -- parse some timestamps if available
  jc_ts := NULL;
  followup_ts := NULL;
  BEGIN jc_ts := NEW.jc_date_time; EXCEPTION WHEN others THEN jc_ts := NULL; END;
  BEGIN followup_ts := NEW.callback_date; EXCEPTION WHEN others THEN followup_ts := NULL; END;

  -- Normalize job type to allowed set; default to 'Cash' if unknown/empty
  jt := NULLIF(NEW.service_type::text, '');
  IF jt IS NULL THEN
    jt := 'Cash';
  ELSE
    IF jt NOT IN ('Insurance','Cash','Warranty') THEN jt := 'Cash'; END IF;
  END IF;

  -- Insert or update only the selected columns. Use ON CONFLICT (id) to perform an upsert.
  INSERT INTO public.jobs (
    id,
    job_card_number,
    reg_no,
    model,
    color,
    customer_name,
    customer_mobile,
    job_type,
    advisor,
    technician,
    status,
    labour_amt,
    part_amt,
    bill_amount,
    profit,
    payload,
    created_at,
    updated_at,
    follow_up_date,
    dealer_name,
    dealer_city,
    location
  ) VALUES (
    target_id,
    COALESCE(NEW.job_card_number, NEW.job_card_no, NEW.bill_no, NEW.job_card_number::text),
    COALESCE(NEW.registration_no, NEW.registration_no_1, NEW.reg_no, NEW.reg_no::text),
    COALESCE(NEW.model, NEW.vehicle_model),
    COALESCE(NEW.color),
    COALESCE(NEW.customer_name, NEW.customer),
    COALESCE(NEW.mobile_no, NEW.phone, NEW.customer_mobile),
    jt,
    COALESCE(NEW.sa, NEW.advisor),
    COALESCE(NEW.technician),
    COALESCE(NEW.status, 'Service'),
    labour_val,
    part_val,
    bill_val,
    computed_profit,
    to_jsonb(NEW),
    COALESCE(jc_ts, now()),
    now(),
    followup_ts,
    COALESCE(NEW.dealer_name),
    COALESCE(NEW.dealer_city),
    COALESCE(NEW.location)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    job_card_number = EXCLUDED.job_card_number,
    reg_no = EXCLUDED.reg_no,
    model = EXCLUDED.model,
    color = EXCLUDED.color,
    customer_name = COALESCE(EXCLUDED.customer_name, public.jobs.customer_name),
    customer_mobile = COALESCE(EXCLUDED.customer_mobile, public.jobs.customer_mobile),
    job_type = EXCLUDED.job_type,
    advisor = COALESCE(EXCLUDED.advisor, public.jobs.advisor),
    technician = COALESCE(EXCLUDED.technician, public.jobs.technician),
    status = EXCLUDED.status,
    labour_amt = COALESCE(EXCLUDED.labour_amt, public.jobs.labour_amt),
    part_amt = COALESCE(EXCLUDED.part_amt, public.jobs.part_amt),
    bill_amount = COALESCE(EXCLUDED.bill_amount, public.jobs.bill_amount),
    profit = COALESCE(EXCLUDED.profit, public.jobs.profit),
  -- preserve existing payload unless the new raw row has data
  payload = COALESCE(EXCLUDED.payload, public.jobs.payload),
    updated_at = now(),
    follow_up_date = COALESCE(EXCLUDED.follow_up_date, public.jobs.follow_up_date),
    dealer_name = COALESCE(EXCLUDED.dealer_name, public.jobs.dealer_name),
    dealer_city = COALESCE(EXCLUDED.dealer_city, public.jobs.dealer_city),
    location = COALESCE(EXCLUDED.location, public.jobs.location);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to run AFTER INSERT OR UPDATE on the raw table
DROP TRIGGER IF EXISTS trg_sync_raw_to_jobs ON public.bhiwani_service_jobs_raw;
CREATE TRIGGER trg_sync_raw_to_jobs
AFTER INSERT OR UPDATE ON public.bhiwani_service_jobs_raw
FOR EACH ROW EXECUTE FUNCTION public.sync_bhiwani_raw_to_jobs();

-- Notes:
-- - This trigger upserts a conservative set of columns to avoid overwriting complex
--   job state in `jobs`. Adjust the columns in the INSERT/UPDATE lists to suit your
--   schema and policy.
-- - Test by inserting a row into `bhiwani_service_jobs_raw` and checking `jobs`.
