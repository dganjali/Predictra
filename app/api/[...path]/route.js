// Catch-all API proxy for backend requests.
// Forwards any /api/* request (except /api/subscribe) to the external backend URL 
// specified by the BACKEND_URL environment variable.

export async function GET(req, { params }) {
  return handleProxy(req, params);
}

export async function POST(req, { params }) {
  return handleProxy(req, params);
}

export async function PUT(req, { params }) {
  return handleProxy(req, params);
}

export async function DELETE(req, { params }) {
  return handleProxy(req, params);
}

export async function PATCH(req, { params }) {
  return handleProxy(req, params);
}

async function handleProxy(req, { params }) {
  const backendUrl = process.env.BACKEND_URL;
  const pathSegments = params.path || [];
  
  // Skip proxy for routes handled by Next.js App Router
  if (pathSegments[0] === 'subscribe' || pathSegments[0] === 'frontend') {
    return new Response(JSON.stringify({
      success: false,
      message: 'This route is handled by Next.js App Router'
    }), { 
      status: 404, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  const originalPath = '/' + pathSegments.join('/');
  
  if (!backendUrl) {
    return new Response(JSON.stringify({
      success: false,
      message: 'BACKEND_URL not configured. Set BACKEND_URL in Vercel environment variables to proxy API requests to your backend. See DEPLOYMENT.md for details.'
    }), { 
      status: 501, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  const target = new URL(originalPath, backendUrl).toString();

  try {
    // Build headers to forward
    const forwardHeaders = {};
    const headers = req.headers;
    
    for (const [k, v] of headers.entries()) {
      if (!["host", "connection", "content-length"].includes(k.toLowerCase())) {
        forwardHeaders[k] = v;
      }
    }

    // Get body if present
    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        body = await req.text();
        if (body && !forwardHeaders['content-type']) {
          forwardHeaders['content-type'] = 'application/json';
        }
      } catch (e) {
        // No body
      }
    }

    const fetchRes = await fetch(target, {
      method: req.method,
      headers: forwardHeaders,
      body: body
    });

    // Forward response
    const data = await fetchRes.arrayBuffer();
    const responseHeaders = new Headers();
    
    fetchRes.headers.forEach((v, k) => {
      if (k.toLowerCase() !== 'transfer-encoding') {
        responseHeaders.set(k, v);
      }
    });

    return new Response(data, {
      status: fetchRes.status,
      statusText: fetchRes.statusText,
      headers: responseHeaders
    });
  } catch (err) {
    console.error('Proxy error:', err);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Proxy error', 
      error: err.message 
    }), { 
      status: 502, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

