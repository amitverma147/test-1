const { createClient } = require('@supabase/supabase-js');
const { toSnakeCaseKeyMap } = require('../utils/csvMapping.cjs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin;
function makeAdminStub(reason) {
  console.error('Supabase admin client unavailable:', reason);
  return {
    auth: { getUser: async () => ({ data: null, error: { message: reason } }) },
    from: () => ({ select: async () => ({ data: null, error: { message: reason } }) }),
    rpc: async () => ({ data: null, error: { message: reason } }),
  };
}

try {
  new URL(SUPABASE_URL);
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} catch (err) {
  supabaseAdmin = makeAdminStub(String(err?.message || err));
}

async function verifyUserFromAuthHeader(req) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth || typeof auth !== 'string') return null;
  const parts = auth.split(' ');
  if (parts.length !== 2) return null;
  const token = parts[1];
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data) return null;
    return data.user;
  } catch (err) {
    return null;
  }
}

/**
 * Temporary authentication bypass for testing
 * TODO: Remove this once proper authentication is in place
 */
function bypassAuthForTesting(req) {
  // ALWAYS allow access during testing (bypass all auth checks)
  console.log('✅ Auth bypass (jobs): Allowing access for testing');
  return true;
}

function toNumber(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

module.exports = async function jobsHandler(req, res) {
  try {
    // Temporary: Allow access for testing
    let user = null;
    if (!bypassAuthForTesting(req)) {
      user = await verifyUserFromAuthHeader(req);
    } else {
      // Create a fake user for testing when bypassing auth
      user = { id: 'test-user-bypass', email: 'manmeetsingh@pasco.in' };
    }

    // Allow GET requests without auth for development/testing
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin.from('jobs').select('*');
      if (error) {
        console.error('Failed to fetch jobs', error);
        return res.status(500).json({ error });
      }
      return res.status(200).json({ data });
    }

    // For POST/PATCH, we now have a user (real or fake from bypass)
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method === 'POST') {
      const job = (req.body && req.body.job) || null;
      if (!job) return res.status(400).json({ error: 'job required' });

      const labour = toNumber(job.labourAmt ?? job.labour_amt ?? job.labourAmount ?? 0) || 0;
      const part = toNumber(job.partAmt ?? job.part_amt ?? job.partAmount ?? 0) || 0;
      const bill = toNumber(job.billAmount ?? job.bill_amount ?? job.bill ?? 0) || 0;
      const profit = bill !== null ? (bill - (labour + part)) : null;

      // Whitelist of database columns (based on actual schema)
      const dbColumns = [
        'id', 'job_card_number', 'reg_no', 'model', 'color', 'customer_name', 'customer_mobile',
        'job_type', 'advisor', 'technician', 'status', 'current_stage', 'labour_amt', 'part_amt',
        'bill_amount', 'profit', 'created_at', 'updated_at', 'arrival_date', 'follow_up_date',
        'group_name', 'created_by', 'dealer_name', 'dealer_city', 'location', 'chassis',
        'engine_num', 'variant', 'sale_date', 'promised_dt', 'ready_date_time', 'jc_source',
        'approval_status', 'cust_remarks', 'dlr_remarks', 'pickup_required', 'pickup_date',
        'pickup_location', 'address1', 'address2', 'address3', 'city', 'pin', 'dob', 'doa',
        'email', 'chkin_dt', 'before_images', 'after_images', 'image_metadata'
      ];

      const payload = {
        id: job.id,
        labourAmt: labour,
        partAmt: part,
        billAmount: bill,
        profit,
        groupName: job.groupName ?? job.group_name ?? null,
        createdBy: user.id,
        updatedAt: new Date().toISOString(),
        // Only include fields that exist in database
        ...(job.jobCardNumber && { jobCardNumber: job.jobCardNumber }),
        ...(job.regNo && { regNo: job.regNo }),
        ...(job.model && { model: job.model }),
        ...(job.color && { color: job.color }),
        ...(job.customerName && { customerName: job.customerName }),
        ...(job.customerMobile && { customerMobile: job.customerMobile }),
        ...(job.jobType && { jobType: job.jobType }),
        ...(job.advisor && { advisor: job.advisor }),
        ...(job.technician && { technician: job.technician }),
        ...(job.status && { status: job.status }),
        ...(job.currentStage && { currentStage: job.currentStage }),
        ...(job.arrivalDate && { arrivalDate: job.arrivalDate }),
        ...(job.followUpDate && { followUpDate: job.followUpDate }),
        ...(job.before_images && { before_images: job.before_images }),
        ...(job.after_images && { after_images: job.after_images }),
      };

      const payloadSnake = toSnakeCaseKeyMap(payload);

      // Filter to only include columns that exist in database
      const filteredPayload = {};
      for (const key in payloadSnake) {
        if (dbColumns.includes(key)) {
          filteredPayload[key] = payloadSnake[key];
        }
      }

      console.log('📝 Saving job to database:', { id: job.id, columns: Object.keys(filteredPayload) });

      const { error } = await supabaseAdmin.from('jobs').upsert([filteredPayload], { returning: 'minimal' });
      if (error) {
        console.error('Failed to upsert job', error);
        return res.status(500).json({ error });
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'PATCH') {
      const { id, updates } = req.body || {};
      if (!id || !updates) return res.status(400).json({ error: 'id and updates required' });

      // Whitelist of database columns (same as POST)
      const dbColumns = [
        'id', 'job_card_number', 'reg_no', 'model', 'color', 'customer_name', 'customer_mobile',
        'job_type', 'advisor', 'technician', 'status', 'current_stage', 'labour_amt', 'part_amt',
        'bill_amount', 'profit', 'created_at', 'updated_at', 'arrival_date', 'follow_up_date',
        'group_name', 'created_by', 'dealer_name', 'dealer_city', 'location', 'chassis',
        'engine_num', 'variant', 'sale_date', 'promised_dt', 'ready_date_time', 'jc_source',
        'approval_status', 'cust_remarks', 'dlr_remarks', 'pickup_required', 'pickup_date',
        'pickup_location', 'address1', 'address2', 'address3', 'city', 'pin', 'dob', 'doa',
        'email', 'chkin_dt', 'before_images', 'after_images', 'image_metadata'
      ];

      const labour = toNumber(updates.labourAmt ?? updates.labour_amt ?? 0);
      const part = toNumber(updates.partAmt ?? updates.part_amt ?? 0);
      const bill = toNumber(updates.billAmount ?? updates.bill_amount ?? 0);
      const profit = (bill !== null) ? (bill - ((labour || 0) + (part || 0))) : undefined;

      const payload = Object.assign({}, updates, {
        labourAmt: labour ?? undefined,
        partAmt: part ?? undefined,
        billAmount: bill ?? undefined,
        profit: profit ?? undefined,
        updatedAt: new Date().toISOString(),
      });

      const payloadSnake = toSnakeCaseKeyMap(payload);

      // Filter to only include columns that exist in database
      const filteredPayload = {};
      for (const key in payloadSnake) {
        if (dbColumns.includes(key)) {
          filteredPayload[key] = payloadSnake[key];
        }
      }

      console.log('📝 Updating job in database:', { id, columns: Object.keys(filteredPayload) });

      const { error } = await supabaseAdmin.from('jobs').update(filteredPayload).eq('id', id);
      if (error) {
        console.error('Failed to update job', error);
        return res.status(500).json({ error });
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET,POST,PATCH');
    return res.status(405).end('Method not allowed');
  } catch (err) {
    console.error('server_handlers/jobs error', err);
    return res.status(500).json({ error: String(err) });
  }
};
