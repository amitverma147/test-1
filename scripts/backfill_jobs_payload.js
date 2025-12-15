#!/usr/bin/env node
// scripts/backfill_jobs_payload.js
// One-time backfill to copy rows from `bhiwani_service_jobs_raw` into `jobs.payload`.
// Usage:
//   DRY_RUN=1 node scripts/backfill_jobs_payload.js   # prints operations without writing
//   node scripts/backfill_jobs_payload.js            # performs upserts
// Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars set (service role)

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const dryRun = Boolean(process.env.DRY_RUN || process.env.DRY || process.argv.includes('--dry-run'));
const batchSize = Number(process.env.BATCH_SIZE || 200);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function targetIdForRaw(row) {
  return (row.job_card_number || row.job_card_no || row.bill_no || row.bill_no_1 || ('raw-' + row.id)).toString();
}

async function fetchRawBatch(offset, limit) {
  // supabase-js supports pagination via range
  const from = offset;
  const to = offset + limit - 1;
  const { data, error } = await supabase
    .from('bhiwani_service_jobs_raw')
    .select('*')
    .order('id', { ascending: true })
    .range(from, to);
  if (error) throw error;
  return data || [];
}

async function upsertJobs(batch) {
  // each item should be { id, payload }
  const { error } = await supabase.from('jobs').upsert(batch, { returning: 'minimal' });
  if (error) throw error;
}

(async () => {
  console.log('Backfill jobs.payload from bhiwani_service_jobs_raw');
  console.log('DRY RUN:', dryRun);

  let offset = 0;
  let total = 0;
  while (true) {
    const batch = await fetchRawBatch(offset, batchSize);
    if (!batch || batch.length === 0) break;

    const upserts = batch.map((r) => {
      const id = targetIdForRaw(r);
      // store the full raw row as payload; you can alter this mapping if desired
      return { id, payload: r };
    });

    if (dryRun) {
      console.log(`Would upsert ${upserts.length} jobs (offset ${offset}) - sample id: ${upserts[0]?.id}`);
    } else {
      try {
        await upsertJobs(upserts);
        console.log(`Upserted ${upserts.length} jobs (offset ${offset})`);
      } catch (err) {
        console.error('Failed to upsert batch at offset', offset, err.message || err);
        process.exit(1);
      }
    }

    total += upserts.length;
    offset += batchSize;
  }

  console.log('Done. Processed', total, 'rows.');
})();
