// Simple test endpoint to verify that JS serverless functions are deployed.
module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method not allowed');
  }
  const rows = (req.body && Array.isArray(req.body.rows)) ? req.body.rows : [];
  console.log('upload-csv-fallback received', rows.length, 'rows');
  return res.status(200).json({ ok: true, route: 'upload-csv-fallback', insertedCount: rows.length });
};
