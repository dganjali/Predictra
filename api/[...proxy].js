// Catch-all API proxy for Vercel serverless functions.
// Forwards any /api/* request to the external backend URL specified by the
// BACKEND_URL environment variable. If BACKEND_URL is not set, returns a
// helpful error so deployments succeed but API calls fail clearly.

module.exports = async (req, res) => {
  const backendUrl = process.env.BACKEND_URL;
  const originalPath = req.url.replace(/^\/api/, ''); // keep leading '/'

  if (!backendUrl) {
    res.statusCode = 501;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      message: 'BACKEND_URL not configured. Set BACKEND_URL in Vercel environment variables to proxy API requests to your backend. See DEPLOYMENT.md for details.'
    }));
    return;
  }

  const target = new URL(originalPath, backendUrl).toString();

  try {
    // Build headers to forward, but avoid hop-by-hop headers
    const forwardHeaders = {};
    for (const [k, v] of Object.entries(req.headers || {})) {
      if (["host", "connection", "content-length"].includes(k.toLowerCase())) continue;
      forwardHeaders[k] = v;
    }

    // Reconstruct body if present
    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = req.body;
      // If body is an object (parsed by Vercel), stringify it and set header
      if (body && typeof body === 'object' && !(body instanceof Buffer)) {
        body = JSON.stringify(body);
        forwardHeaders['content-type'] = forwardHeaders['content-type'] || 'application/json';
      }
    }

    // Use global fetch (Node 18+ / Vercel environment supports fetch)
    const fetchRes = await fetch(target, {
      method: req.method,
      headers: forwardHeaders,
      body: body
    });

    // Forward status and headers
    res.statusCode = fetchRes.status;
    fetchRes.headers.forEach((v, k) => {
      // Avoid setting restricted headers
      if (k.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(k, v);
    });

    const data = await fetchRes.arrayBuffer();
    res.end(Buffer.from(data));
  } catch (err) {
    console.error('Proxy error:', err);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, message: 'Proxy error', error: err.message }));
  }
};
