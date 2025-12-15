// Central router for /api/* — delegates to specific JS handlers present in /api
const url = require('url');

function sendNotFound(res) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not found');
}

module.exports = (req, res) => {
  try {
    const parsed = url.parse(req.url || req.originalUrl || '/');
    const path = parsed.pathname || '/';

    // Map known API routes to files that we control and that are plain JS.
    if (path === '/api/' || path === '/api') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, message: 'API router active' }));
    }

    // route /api/upload-csv to the real JS handler that persists to Supabase
    if (path === '/api/upload-csv' || path === '/api/upload-csv.js') {
      // prefer the real implementation if present
      try {
        const h = require('./upload-csv-real.js');
        return h(req, res);
      } catch (e) {
        // fallback to the non-persistent handler if real one isn't available
        const h = require('./upload-csv.js');
        return h(req, res);
      }
    }

    // route /api/jobs to the JS handler if present
    if (path === '/api/jobs' || path === '/api/jobs.js') {
      try {
        const h = require('./jobs.js');
        return h(req, res);
      } catch (e) {
        console.error('Failed to load api/jobs.js', e);
        return sendNotFound(res);
      }
    }

    // route /api/metrics
    if (path === '/api/metrics' || path === '/api/metrics.js') {
      try {
        const h = require('./metrics.js');
        return h(req, res);
      } catch (e) {
        console.error('Failed to load api/metrics.js', e);
        return sendNotFound(res);
      }
    }

    // route inventory and quick_messages
    if (path === '/api/inventory' || path === '/api/inventory.js') {
      try { const h = require('./inventory.js'); return h(req, res); } catch (e) { console.error('Failed to load api/inventory.js', e); return sendNotFound(res); }
    }

    if (path === '/api/quick_messages' || path === '/api/quick_messages.js') {
      try { const h = require('./quick_messages.js'); return h(req, res); } catch (e) { console.error('Failed to load api/quick_messages.js', e); return sendNotFound(res); }
    }

    if (path === '/api/upload-csv-fallback') {
      const h = require('./upload-csv-fallback.js');
      return h(req, res);
    }

    if (path === '/api/debug-probe') {
      const h = require('./debug-probe.js');
      return h(req, res);
    }

    // If route not matched, fall back to 404
    return sendNotFound(res);
  } catch (err) {
    console.error('api/index router error', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: String(err) }));
  }
};
