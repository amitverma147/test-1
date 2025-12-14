// Debug probe that returns which files exist and simple environment markers.
module.exports = (req, res) => {
  res.status(200).json({ ok: true, probe: 'debug-probe', time: new Date().toISOString() });
};
