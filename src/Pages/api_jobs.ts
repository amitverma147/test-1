import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { toSnakeCaseKeyMap } from "../utils/csvMapping";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let supabaseAdmin: any;
function makeAdminStub(reason: string) {
  console.error("Supabase admin client unavailable:", reason);
  return {
    auth: { getUser: async (_: any) => ({ data: null, error: { message: reason } }) },
    from: (_: string) => ({
      select: async () => ({ data: null, error: { message: reason } }),
      insert: async () => ({ data: null, error: { message: reason } }),
      upsert: async () => ({ data: null, error: { message: reason } }),
      update: async () => ({ data: null, error: { message: reason } }),
      delete: async () => ({ data: null, error: { message: reason } }),
    }),
    rpc: async () => ({ data: null, error: { message: reason } }),
  };
}

try {
  new URL(SUPABASE_URL);
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} catch (err: any) {
  supabaseAdmin = makeAdminStub(String(err?.message || err || 'Invalid SUPABASE_URL or missing SERVICE_ROLE_KEY'));
}

async function verifyUserFromAuthHeader(req: any) {
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

function toNumber(v: any) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req: any, res: any) {
  try {
    const user = await verifyUserFromAuthHeader(req as any);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method === 'POST') {
      // create or upsert a job
      const { job } = req.body as { job?: any };
      if (!job) return res.status(400).json({ error: 'job required' });

      const labour = toNumber(job.labourAmt ?? job.labour_amt ?? job.labourAmount ?? 0) || 0;
      const part = toNumber(job.partAmt ?? job.part_amt ?? job.partAmount ?? 0) || 0;
      const bill = toNumber(job.billAmount ?? job.bill_amount ?? job.bill ?? 0) || 0;
      const profit = bill !== null ? (bill - (labour + part)) : null;

      const payload: any = {
        ...job,
        labourAmt: labour,
        partAmt: part,
        billAmount: bill,
        profit,
        groupName: job.groupName ?? job.group_name ?? null,
        callbackDate: job.callbackDate ?? job.callback_date ?? job.followUpDate ?? null,
        createdBy: user.id,
        updatedAt: new Date().toISOString(),
      };

      // Debug log the incoming job object
      console.log('📥 API received job:', {
        id: job.id,
        hasBeforeImages: !!job.before_images,
        hasAfterImages: !!job.after_images,
        beforeImagesCount: job.before_images?.length || 0,
        afterImagesCount: job.after_images?.length || 0,
        beforeUrls: job.before_images?.map((i: any) => i.url) || [],
        afterUrls: job.after_images?.map((i: any) => i.url) || []
      });
      
      // Transform keys to snake_case for DB columns
      // Store snake-cased top-level columns where possible, and also persist
      // the entire job object into a `payload` jsonb column so no fields are lost.
      const payloadSnake = toSnakeCaseKeyMap(payload);
      
      // CRITICAL: Explicitly preserve before_images and after_images from the original payload
      // These might be lost during snake_case conversion
      payloadSnake.before_images = payload.before_images || payload.beforeImages || [];
      payloadSnake.after_images = payload.after_images || payload.afterImages || [];
      
      // Also check if image_metadata exists and preserve it
      if (payload.image_metadata || payload.imageMetadata) {
        payloadSnake.image_metadata = payload.image_metadata || payload.imageMetadata;
      }
      
      // Keep full job for compatibility with UI which looks for `row.payload`
      payloadSnake.payload = payload;
      
      console.log('💾 Saving job to database:', {
        id: payloadSnake.id,
        beforeImagesCount: payloadSnake.before_images?.length || 0,
        afterImagesCount: payloadSnake.after_images?.length || 0,
        beforeUrls: payloadSnake.before_images?.map((i: any) => i.url) || [],
        afterUrls: payloadSnake.after_images?.map((i: any) => i.url) || []
      });
      
      const { error } = await supabaseAdmin.from('jobs').upsert([payloadSnake], { returning: 'minimal' });
      if (error) {
        console.error('Failed to upsert job', error);
        return res.status(500).json({ error });
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      // return all jobs to authenticated user (server will use service role)
      const { data, error } = await supabaseAdmin.from('jobs').select('*');
      if (error) {
        console.error('Failed to fetch jobs', error);
        return res.status(500).json({ error });
      }
      return res.status(200).json({ data });
    }

    if (req.method === 'PATCH') {
      const { id, updates } = req.body as { id?: string; updates?: any };
      if (!id || !updates) return res.status(400).json({ error: 'id and updates required' });

      const labour = toNumber(updates.labourAmt ?? updates.labour_amt ?? 0);
      const part = toNumber(updates.partAmt ?? updates.part_amt ?? 0);
      const bill = toNumber(updates.billAmount ?? updates.bill_amount ?? 0);
      const profit = (bill !== null) ? (bill - ((labour || 0) + (part || 0))) : undefined;

      const payload: any = {
        ...updates,
        labourAmt: labour ?? undefined,
        partAmt: part ?? undefined,
        billAmount: bill ?? undefined,
        profit: profit ?? undefined,
        updatedAt: new Date().toISOString(),
      };

    const payloadSnake = toSnakeCaseKeyMap(payload);
    // also update the `payload` JSON column with the full job/updates object
    payloadSnake.payload = payload;
  const { error } = await supabaseAdmin.from('jobs').update(payloadSnake).eq('id', id);
      if (error) return res.status(500).json({ error });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'POST,PATCH');
    return res.status(405).end('Method not allowed');
  } catch (err: any) {
    console.error('api_jobs error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
