// Minimal Vercel / serverless handler for waitlist submissions.
// Accepts POST { email } and attempts to append to a JSON file for local/dev use.
// NOTE: On Vercel serverless, writing to the repo filesystem is ephemeral. Replace this
// with a proper DB (Supabase, Airtable, DynamoDB, etc.) for production persistence.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { email } = req.body || {}
    if (!email || typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email' })
    }

    const entry = { email: email.trim(), ts: new Date().toISOString() }

    // If AIRTABLE configuration exists in env, try to persist there.
    const AIRTABLE_KEY = process.env.AIRTABLE_API_KEY || process.env.NEXT_PUBLIC_AIRTABLE_API_KEY
    const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID || process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID
    const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE_NAME || process.env.NEXT_PUBLIC_AIRTABLE_TABLE_NAME || 'Waitlist'

    if (AIRTABLE_KEY && AIRTABLE_BASE) {
      try {
        const fetch = require('node-fetch')
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}`
        const payload = { fields: { Email: entry.email, Timestamp: entry.ts } }
        const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${AIRTABLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!r.ok) {
          const body = await r.text()
          console.warn('Airtable write failed', r.status, body)
        } else {
          console.log('Saved to Airtable')
          return res.status(200).json({ ok: true })
        }
      } catch (err) {
        console.warn('Airtable error', err && err.message)
      }
    }

    // Fallback: append to a local JSON file (useful for local dev).
    try {
      const fs = require('fs')
      const path = require('path')
      const file = path.join(process.cwd(), 'frontend', 'waitlist-submissions.json')
      let arr = []
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf8') || '[]'
        arr = JSON.parse(raw)
      }
      arr.push(entry)
      fs.writeFileSync(file, JSON.stringify(arr, null, 2))
      console.log('Waitlist entry saved to', file)
    } catch (err) {
      console.warn('Could not write waitlist file (ephemeral environment?):', err && err.message)
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('waitlist handler error', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
