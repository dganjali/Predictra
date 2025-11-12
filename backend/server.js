/* Replace disabled server with a lightweight Express server that serves
  the frontend static assets and provides a /api/subscribe endpoint. */

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

// Basic security headers (allow CDNs used by frontend)
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "https://cdnjs.cloudflare.com"],
      "style-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      "font-src": ["'self'", "https://cdnjs.cloudflare.com"],
    },
  })
);

// Rate limiting for API endpoints
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 }); // 60 requests / minute
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

// Subscribe endpoint (adapted from api/subscribe.js serverless function)
app.post('/api/subscribe', async (req, res) => {
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const OWNER_EMAIL = process.env.OWNER_EMAIL;
  const SENDGRID_LIST_ID = process.env.SENDGRID_LIST_ID;

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const body = req.body || {};
  const email = (body.email || '').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email address' });
  }

  console.log(`New subscription from ${email} (ip=${ip})`);

  if (SENDGRID_API_KEY) {
    try {
      if (SENDGRID_LIST_ID) {
        const mgPayload = {
          list_ids: [SENDGRID_LIST_ID],
          contacts: [{ email }]
        };

        const mgRes = await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(mgPayload)
        });

        if (!mgRes.ok) {
          const text = await mgRes.text();
          console.error('SendGrid marketing error', mgRes.status, text);
        } else {
          console.log(`Added ${email} to SendGrid list ${SENDGRID_LIST_ID}`);
        }
      }

      if (OWNER_EMAIL) {
        const payload = {
          personalizations: [{ to: [{ email: OWNER_EMAIL }] }],
          from: { email: OWNER_EMAIL },
          subject: `New subscriber: ${email}`,
          content: [{ type: 'text/plain', value: `A new subscriber signed up: ${email}\nIP: ${ip}` }]
        };

        const notifyRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!notifyRes.ok) {
          const text = await notifyRes.text();
          console.error('SendGrid notify error', notifyRes.status, text);
        }
      }

      return res.json({ success: true, message: 'Thanks — we received your email!' });
    } catch (err) {
      console.error('SendGrid error', err);
      // fall through to fallback success response
    }
  }

  // Fallback: no provider configured
  return res.json({ success: true, message: 'Thanks — we received your email! (No provider configured)' });
});

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});