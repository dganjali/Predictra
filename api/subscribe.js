// Serverless function to accept mailing list subscriptions.
// If SENDGRID_API_KEY and OWNER_EMAIL are configured in Vercel, this will
// send a notification email to OWNER_EMAIL with the new subscriber. Otherwise
// it returns a success response but logs the subscriber — configure SendGrid
// or another provider in production.

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const OWNER_EMAIL = process.env.OWNER_EMAIL;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.end(JSON.stringify({ success: false, message: 'Method not allowed' }));
    return;
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let body = req.body;
  if (!body) {
    try {
      body = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => resolve(JSON.parse(data || '{}')));
      });
    } catch (e) {
      body = {};
    }
  }

  const email = (body.email || '').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, message: 'Invalid email address' }));
    return;
  }

  console.log(`New subscription from ${email} (ip=${ip})`);

  if (SENDGRID_API_KEY && OWNER_EMAIL) {
    try {
      const payload = {
        personalizations: [{ to: [{ email: OWNER_EMAIL }] }],
        from: { email: OWNER_EMAIL },
        subject: `New subscriber: ${email}`,
        content: [{ type: 'text/plain', value: `A new subscriber signed up: ${email}\nIP: ${ip}` }]
      };

      const fetchRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!fetchRes.ok) {
        const text = await fetchRes.text();
        console.error('SendGrid error', fetchRes.status, text);
        // still return 200 to avoid breaking UX, but indicate partial failure
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, message: 'Subscribed (notification failed)' }));
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, message: 'Thanks — we received your email!' }));
      return;
    } catch (err) {
      console.error('Error sending SendGrid email', err);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, message: 'Subscribed (notification failed)' }));
      return;
    }
  }

  // Fallback: no external provider configured. Return success and log.
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: true, message: 'Thanks — we received your email! (No provider configured)' }));
};
