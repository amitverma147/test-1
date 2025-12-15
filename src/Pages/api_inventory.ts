import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let supabaseAdmin: any;
function makeAdminStub(reason: string) {
  console.error("Supabase admin client unavailable:", reason);
  return {
    auth: { getUser: async (_: any) => ({ data: null, error: { message: reason } }) },
    from: (_: string) => ({ select: async () => ({ data: null, error: { message: reason } }) }),
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await verifyUserFromAuthHeader(req as any);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin.from('inventory').select('*').limit(500);
      if (error) {
        console.error('Failed to fetch inventory', error);
        return res.status(500).json({ error });
      }
      return res.status(200).json({ data });
    }

    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method not allowed');
  } catch (err: any) {
    console.error('api_inventory error', err);
    return res.status(500).json({ error: String(err) });
  }
}
