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

// Helper to convert Excel serial date to ISO string
const excelDateToISO = (excelDate) => {
  if (!excelDate || isNaN(excelDate)) return null;
  // Excel dates are days since 1900-01-01 (with a leap year bug)
  const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
  const days = Math.floor(excelDate);
  const milliseconds = Math.round((excelDate - days) * 86400000);
  const date = new Date(excelEpoch.getTime() + days * 86400000 + milliseconds);
  return date.toISOString();
};

const cleanValue = (v) => { 
  if (v === null || v === undefined) return null; 
  const s = String(v).trim(); 
  if (s === '' || s.toLowerCase() === 'null') return null; 
  return s; 
};

// Clean date fields - handles both ISO strings and Excel serial numbers
const cleanDate = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '' || s.toLowerCase() === 'null') return null;
  
  // Check if it's an Excel serial number (numeric)
  const num = Number(s);
  if (!isNaN(num) && num > 1 && num < 100000) {
    return excelDateToISO(num);
  }
  
  // Otherwise return as-is (already ISO or will be validated by DB)
  return s;
};

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

    console.log(`📥 Received ${rows.length} rows for upload`);
    if (!rows.length) return res.status(400).json({ error: 'No rows provided' });

    // Date field names that should be cleaned with date conversion
    const dateFields = ['callback_date', 'callbackdate', 'created_at', 'updated_at', 'jc_date_time', 
                        'sale_date', 'promised_dt', 'rev_promised_dt', 'ready_date_time', 
                        'pickup_date', 'bill_date', 'dob', 'doa', 'chkin_dt', 
                        'app_sent_date', 'app_rej_date'];

    const mapped = rows.map((row) => {
      const out = {};
      for (const k of Object.keys(row)) {
        const headerKey = sanitizeHeader(k);
        // Use cleanDate for date fields, cleanValue for others
        out[headerKey] = dateFields.includes(headerKey) ? cleanDate(row[k]) : cleanValue(row[k]);
      }

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

    console.log(`🔄 Mapped ${mapped.length} rows, sample:`, mapped[0]);

    const batchSize = 500;
    let insertedCount = 0;
    const errors = [];

    for (let i = 0; i < mapped.length; i += batchSize) {
      const batch = mapped.slice(i, i + batchSize);
      const allHaveHash = batch.every((r) => r.source_hash);
      console.log(`🔄 Processing batch ${i}-${i + batch.length}, allHaveHash: ${allHaveHash}`);
      
      let result;
      if (allHaveHash) {
        // Upsert without returning data
        result = await supabaseAdmin.from(SUPABASE_TABLE_RAW).upsert(batch, { onConflict: 'source_hash' });
      } else {
        result = await supabaseAdmin.from(SUPABASE_TABLE_RAW).insert(batch);
      }

      if (result.error) {
        console.error('❌ Supabase RAW insert/upsert error:', result.error);
        errors.push({ batchStart: i, error: result.error });
      } else {
        console.log(`✅ Upserted batch successfully`);
        
        // Fetch the actual records back using source_hash
        const hashes = batch.map(b => b.source_hash).filter(Boolean);
        const { data: fetchedData, error: fetchError } = await supabaseAdmin
          .from(SUPABASE_TABLE_RAW)
          .select('*')
          .in('source_hash', hashes);
        
        if (fetchError) {
          console.error('❌ Error fetching upserted records:', fetchError);
          errors.push({ batchStart: i, error: fetchError });
        } else {
          const returned = Array.isArray(fetchedData) ? fetchedData.length : 0;
          console.log(`✅ Fetched ${returned} rows from raw table`);
          insertedCount += returned;
        
          if (returned > 0 && fetchedData) {
            const jobsPayloads = fetchedData.map((r) => {
              const toNumber = (v) => {
                if (v === null || v === undefined) return null;
                const n = Number(String(v).replace(/[^0-9.-]/g, ''));
                return Number.isFinite(n) ? n : null;
              };

              const labour = toNumber(r.labour_amt ?? r.labourAmt ?? r.labourAmount);
              const part = toNumber(r.part_amt ?? r.partAmt ?? r.partAmount);
              const bill = toNumber(r.bill_amount ?? r.billAmount ?? r.bill);
              const profit = (bill !== null) ? (bill - ((labour || 0) + (part || 0))) : null;

              // Generate ID from job_card_number or bill_no or raw id
              const jobCardNo = r.job_card_number || r.job_card_no || r.job_card_no_1 || null;
              const billNo = r.bill_no || r.bill_no_1 || null;
              const id = jobCardNo || billNo || `raw-${r.id}`;

              return {
                id: id,
                jobCardNumber: jobCardNo,
                regNo: r.registration_no || r.registration_no_1 || null,
                model: r.model || r.vehicle_model || null,
                color: r.color || null,
                customerName: r.customer_name || null,
                customerMobile: r.customer_mobile || r.mobile_no || r.phone || null,
                jobType: r.service_type || null,
                advisor: r.sa || null,
                technician: r.technician || null,
                status: r.status || 'Pending',
                currentStage: r.approval_status || null,
                labourAmt: labour,
                partAmt: part,
                billAmount: bill,
                profit: profit,
                groupName: r.group_name || r.group || null,
                followUpDate: r.callback_date || r.callbackdate || null,
                dealerName: r.dealer_name || null,
                dealerCity: r.dealer_city || null,
                location: r.location || null,
                chassis: r.chassis || null,
                engineNum: r.engine_num || null,
                variant: r.variant || null,
                saleDate: r.sale_date || null,
                promisedDt: r.promised_dt || r.rev_promised_dt || null,
                readyDateTime: r.ready_date_time || null,
                jcSource: r.jc_source || null,
                approvalStatus: r.approval_status || null,
                custRemarks: r.cust_remarks || null,
                dlrRemarks: r.dlr_remarks || null,
                pickupRequired: r.pickup_required === 'Yes' || r.pickup_required === 'true' || r.pickup_required === true,
                pickupDate: r.pickup_date || null,
                pickupLocation: r.pickup_location || null,
                address1: r.address1 || null,
                address2: r.address2 || null,
                address3: r.address3 || null,
                city: r.city || null,
                pin: r.pin || null,
                dob: r.dob || null,
                doa: r.doa || null,
                email: r.email || null,
                chkinDt: r.chkin_dt || null,
                arrivalDate: r.jc_date_time || r.created_at || null,
                createdAt: r.created_at || r.jc_date_time || new Date().toISOString(),
                updatedAt: r.updated_at || new Date().toISOString(),
              };
            });

            const toSnake = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.replace(/([A-Z])/g, '_$1').toLowerCase(), v]));
            const jobsSnake = jobsPayloads.map(toSnake);

            console.log(`🔄 Upserting ${jobsSnake.length} jobs to jobs table`);
            const { error: jobsError } = await supabaseAdmin.from('jobs').upsert(jobsSnake, { onConflict: 'id', returning: 'minimal' });
            if (jobsError) {
              console.error('❌ Failed to upsert jobs from raw:', jobsError);
              errors.push({ batchStart: i, error: jobsError });
            } else {
              console.log(`✅ Successfully upserted ${jobsSnake.length} jobs`);
              // After successful job insert, extract and populate related tables
              await extractAndPopulateRelatedData(fetchedData, supabaseAdmin);
            }
          }
        }
      }
    }

    console.log(`✅ Upload complete: ${insertedCount} rows processed, ${errors.length} errors`);
    return res.status(200).json({ insertedCount, errors });
  } catch (err) {
    console.error('❌ Fatal error in upload-csv:', err);
    console.error('Error message:', err.message);
    console.error('Stack trace:', err.stack);
    return res.status(500).json({ error: String(err), message: err.message, stack: err.stack });
  }
};

// Helper function to extract and populate related tables from uploaded data
async function extractAndPopulateRelatedData(rawRows, supabaseAdmin) {
  try {
    console.log(`🔍 Extracting data for ${rawRows.length} rows`);
    
    // Extract inventory items from part amounts
    const inventoryMap = new Map(); // part_description -> { total_amount, count }
    
    for (const row of rawRows) {
      // If there's a part amount, create an inventory entry
      // Note: Current data doesn't have part names, so we'll use job info
      const partAmt = parseFloat(row.part_amt || 0);
      
      if (partAmt > 0) {
        const jobCardNo = row.job_card_number || row.job_card_no || 'Unknown';
        const model = row.model || row.vehicle_model || 'Unknown Model';
        const key = `Parts-${model}`;
        
        if (inventoryMap.has(key)) {
          const existing = inventoryMap.get(key);
          existing.total_amount += partAmt;
          existing.count += 1;
        } else {
          inventoryMap.set(key, {
            name: `Parts for ${model}`,
            total_amount: partAmt,
            count: 1,
            category: 'Auto Parts',
            model: model
          });
        }
      }
    }
    
    // Create inventory entries
    const inventoryItems = Array.from(inventoryMap.entries()).map(([key, data]) => ({
      name: data.name,
      quantity: data.count,
      unit_price: Math.round(data.total_amount / data.count * 100) / 100, // Average price
      category: data.category,
      supplier: null,
      metadata: {
        source: 'csv_import',
        imported_at: new Date().toISOString(),
        model: data.model,
        total_jobs: data.count,
        total_amount: data.total_amount
      }
    }));
    
    if (inventoryItems.length > 0) {
      console.log(`📦 Creating ${inventoryItems.length} inventory entries`);
      const { error: inventoryError } = await supabaseAdmin
        .from('inventory')
        .upsert(inventoryItems, { onConflict: 'name', ignoreDuplicates: false });
      
      if (inventoryError) {
        console.warn('Could not create inventory entries:', inventoryError.message);
      } else {
        console.log(`✅ Created/updated ${inventoryItems.length} inventory entries`);
      }
    } else {
      console.log('ℹ️ No inventory data to extract from this upload');
    }
    
  } catch (err) {
    console.warn('Error extracting related data:', err);
  }
}
