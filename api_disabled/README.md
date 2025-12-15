This directory contains API handlers that were moved out of `/api` to avoid
creating multiple serverless functions on Vercel's Hobby plan.

Files were moved here so the repository keeps their content in history but they
are not deployed as separate functions. The active serverless function is
`/api/server.js` which routes requests to the consolidated handlers under
`src/server_handlers/`.

If you need to restore a handler as a separate function, move its source back
into `/api` and deploy from a Pro team or keep functions count below the
Hobby limit.
