Files moved out of `/api` to reduce Vercel function count:

- debug-probe.js
- index.js
- index.ts
- jobs.ts
- mapping_presets.ts
- metrics.js
- redeploy-trigger.txt
- supabase-health.ts
- upload-csv-fallback.js
- upload-csv-real.js
- upload-csv.js
- upload-csv.ts.disabled

These files were intentionally moved/disabled. Active consolidated handlers now live in `src/server_handlers/` and `api/server.js` routes to them.
