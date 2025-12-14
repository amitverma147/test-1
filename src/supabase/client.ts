import { createClient } from "@jsr/supabase__supabase-js";

// Uses Vite env variables. Ensure these are set in your environment:
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// If environment variables are missing in the build/deploy environment (e.g. Vercel),
// create a lightweight no-op supabase client to avoid throwing at runtime and
// surface a clear console warning. This prevents a white-screen caused by
// `createClient` throwing when `supabaseUrl` is empty.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "Supabase environment variables are not set (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).\n" +
      "Data persistence will be disabled and the app will run in a degraded mode.\n" +
      "Set these env vars in your Vercel/hosting project settings and re-deploy."
  );

  // Minimal stub implementation covering the used supabase surface in this app.
  const stub = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: (_: any, callback: any) => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    from: (_: string) => ({
      select: async () => ({ data: null, error: null }),
      insert: async () => ({ data: null, error: null }),
      upsert: async () => ({ data: null, error: null }),
      update: async () => ({ data: null, error: null }),
      delete: async () => ({ data: null, error: null }),
    }),
    rpc: async () => ({ data: null, error: null }),
  } as any;

  var client: any = stub;
} else {
  var client: any = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export default client;
