const { createClient } = require('@supabase/supabase-js');

function makeAdminStub(reason) {
  console.error('Supabase admin client unavailable:', reason);
  return {
    from: () => ({ select: async () => ({ data: null, error: { message: reason }, count: 0 }) }),
    rpc: async () => ({ data: null, error: { message: reason } }),
  };
}

let supabaseAdmin;
try {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE envs');
  // eslint-disable-next-line no-new
  new URL(SUPABASE_URL);
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} catch (err) {
  supabaseAdmin = makeAdminStub(String(err?.message || err));
}

function isoDayRange(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

module.exports = async function handler(req, res) {
  try {
    // Only support GET
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const q = req.query || {};
    const mode = q.mode || 'today';

    if (mode === 'today') {
      const { start, end } = isoDayRange(new Date());

      // Count total jobs created today
      const totalResp = await supabaseAdmin.from('jobs').select('id', { count: 'exact' }).gte('created_at', start).lt('created_at', end);
      const total = totalResp && totalResp.count ? totalResp.count : 0;

      // Count created today and not completed
      const openResp = await supabaseAdmin.from('jobs').select('id', { count: 'exact' }).gte('created_at', start).lt('created_at', end).not('status', 'eq', 'Completed');
      const open = openResp && openResp.count ? openResp.count : 0;

      // Count created today and completed
      const compResp = await supabaseAdmin.from('jobs').select('id', { count: 'exact' }).gte('created_at', start).lt('created_at', end).eq('status', 'Completed');
      const completed = compResp && compResp.count ? compResp.count : 0;

      // Sum bill_amount for today
      const rowsResp = await supabaseAdmin.from('jobs').select('bill_amount').gte('created_at', start).lt('created_at', end).limit(10000);
      const rows = (rowsResp && rowsResp.data) || [];
      const revenue = rows.reduce((s, r) => s + (Number(r?.bill_amount || 0) || 0), 0);

      // Follow-ups due today (follow_up_date <= end and not completed)
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const followResp = await supabaseAdmin.from('jobs').select('id', { count: 'exact' }).lte('follow_up_date', today.toISOString()).not('status', 'eq', 'Completed');
      const followups = followResp && followResp.count ? followResp.count : 0;

      return res.status(200).json({
        mode: 'today',
        totalCreatedToday: total,
        openCreatedToday: open,
        completedCreatedToday: completed,
        revenueToday: revenue,
        followupsDueToday: followups,
      });
    }

    // Generic summary
    if (mode === 'summary') {
      // total jobs
      const totalResp = await supabaseAdmin.from('jobs').select('id', { count: 'exact' });
      const total = totalResp && totalResp.count ? totalResp.count : 0;
      // open jobs (not completed)
      const openResp = await supabaseAdmin.from('jobs').select('id', { count: 'exact' }).not('status', 'eq', 'Completed');
      const open = openResp && openResp.count ? openResp.count : 0;
      return res.status(200).json({ mode: 'summary', totalJobs: total, openJobs: open });
    }

    return res.status(400).json({ error: 'Unknown mode' });
  } catch (err) {
    console.error('api/metrics error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
