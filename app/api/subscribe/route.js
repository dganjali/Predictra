import fs from 'fs'

export async function POST(req) {
  try {
    const body = await req.json();
    const email = (body.email || '').trim();
    const ip = req.headers.get('x-forwarded-for') || 'unknown';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid email address' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    console.log(`New subscription (Next API) from ${email} ip=${ip}`)

    // For local/dev we simply append to a local file (safe fallback)
    try {
      const logLine = `${new Date().toISOString()}\t${email}\t${ip}\n`;
      await fs.promises.appendFile('./subscriptions.log', logLine);
    } catch (err) {
      console.error('Failed to write subscriptions.log', err)
    }

    return new Response(JSON.stringify({ success: true, message: 'Thanks — we received your email!' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
