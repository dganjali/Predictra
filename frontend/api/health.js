export default function handler(req, res) {
  res.status(200).json({ ok: true, ts: new Date().toISOString(), env: process.env.NODE_ENV || 'unknown' })
}
