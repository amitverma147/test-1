// Minimal port of upload-csv-real.js into server_handlers so the single
// serverless function can call it.
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_TABLE_RAW = process.env.SUPABASE_TABLE_RAW || 'bhiwani_service_jobs_raw';

let supabaseAdmin;
function makeAdminStub(reason) {
  console.error('Supabase admin client unavailable:', reason);
  return { from: () => ({ insert: async () => ({ data: null, error: { message: reason } }) }) };
}

try {
  new URL(SUPABASE_URL);
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} catch (err) {
  supabaseAdmin = makeAdminStub(String(err?.message || err));
}

const sanitizeHeader = (h) => String(h || '').trim().replace(/\r|\n/g, '').replace(/\s+/g, '_').replace(/[^\w_]/g, '').toLowerCase();
const cleanValue = (v) => { if (v === null || v === undefined) return null; const s = String(v).trim(); if (s === '' || s.toLowerCase() === 'null') return null; return s; };

module.exports = async function uploadCsvHandler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).end('Method not allowed');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
      return res.status(500).json({ error: 'Server misconfigured: missing Supabase env vars' });
    }

    const body = req.body || {};
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (!rows.length) return res.status(400).json({ error: 'No rows provided' });

    const mapped = rows.map((row) => {
      const out = {};
      for (const k of Object.keys(row)) out[sanitizeHeader(k)] = cleanValue(row[k]);

      const sigFields = [
        out.job_card_number,
        out.job_card_no,
        out.registration_no,
        out.registration_no_1,
        out.bill_no,
        out.bill_no_1,
        out.chassis,
      ].filter(Boolean).join('|');
      if (sigFields) {
        out.source_hash = crypto.createHash('md5').update(sigFields).digest('hex');
      }

      return out;
    });

    const batchSize = 500;
    let insertedCount = 0;
    const errors = [];
    for (let i = 0; i < mapped.length; i += batchSize) {
      const batch = mapped.slice(i, i + batchSize);
      const allHaveHash = batch.every((r) => r.source_hash);
      let result;
      if (allHaveHash) {
        result = await supabaseAdmin.from(SUPABASE_TABLE_RAW).upsert(batch, { onConflict: 'source_hash', returning: 'representation' });
      } else {
        result = await supabaseAdmin.from(SUPABASE_TABLE_RAW).insert(batch, { returning: 'representation' });
      }

      if (result.error) {
        console.error('Supabase RAW insert/upsert error:', result.error);
        errors.push({ batchStart: i, error: result.error });
      } else {
        const returned = Array.isArray(result.data) ? result.data.length : 0;
        insertedCount += returned;
        if (returned > 0) {
          const jobsPayloads = result.data.map((r) => {
            const toNumber = (v) => {
              if (v === null || v === undefined) return null;
              const n = Number(String(v).replace(/[^0-9.-]/g, ''));
              return Number.isFinite(n) ? n : null;
            };

            const labour = toNumber(r.labour_amt ?? r.labourAmt ?? r.labourAmount);
            const part = toNumber(r.part_amt ?? r.partAmt ?? r.partAmount);
            const bill = toNumber(r.bill_amount ?? r.billAmount ?? r.bill);
            const profit = (bill !== null) ? (bill - ((labour || 0) + (part || 0))) : null;

            return {
              jobCardNo: r.job_card_number || r.job_card_no || r.job_card_no_1 || null,
              registrationNo: r.registration_no || r.registration_no_1 || null,
              billAmount: bill,
              labourAmt: labour,
              partAmt: part,
              profit: profit,
              groupName: r.group_name || r.group || null,
              callbackDate: r.callback_date || r.callbackdate || null,
              raw_id: r.id,
            };
          });

          const toSnake = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.replace(/([A-Z])/g, '_$1').toLowerCase(), v]));
          const jobsSnake = jobsPayloads.map((p) => { const s = toSnake(p); s.payload = p; return s; });

          const { error: jobsError } = await supabaseAdmin.from('jobs').upsert(jobsSnake, { returning: 'minimal' });
          if (jobsError) {
            console.error('Failed to upsert jobs from raw:', jobsError);
            errors.push({ batchStart: i, error: jobsError });
          }
        }
      }
    }

    return res.status(200).json({ insertedCount, errors });
  } catch (err) {
    console.error('upload-csv-real error', err);
    return res.status(500).json({ error: String(err) });
  }
};
