const url = require('url');

const jobsHandler = require('../src/server_handlers/jobs');
const metricsHandler = require('../src/server_handlers/metrics');
const inventoryHandler = require('../src/server_handlers/inventory');
const quickMessagesHandler = require('../src/server_handlers/quick_messages');
const uploadCsvHandler = require('../src/server_handlers/upload_csv_real');

function sendNotFound(res) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not found');
}

module.exports = (req, res) => {
  try {
    const parsed = url.parse(req.url || req.originalUrl || '/');
    const path = parsed.pathname || '/';

    if (path === '/api/' || path === '/api') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, message: 'API server function active' }));
    }

    if (path === '/api/jobs') return jobsHandler(req, res);
    if (path === '/api/metrics') return metricsHandler(req, res);
    if (path === '/api/inventory') return inventoryHandler(req, res);
    if (path === '/api/quick_messages') return quickMessagesHandler(req, res);
    if (path === '/api/upload-csv' || path === '/api/upload-csv.js') return uploadCsvHandler(req, res);

    return sendNotFound(res);
  } catch (err) {
    console.error('api/server router error', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: String(err) }));
  }
};
