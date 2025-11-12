import fs from 'fs';
import path from 'path';

const mime = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

export async function GET(req, { params }) {
  const parts = params.path || [];
  const filePath = path.join(process.cwd(), 'frontend', ...parts);

  try {
    const data = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mime[ext] || 'application/octet-stream';

    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': contentType }
    });
  } catch (err) {
    return new Response('Not found', { status: 404 });
  }
}
