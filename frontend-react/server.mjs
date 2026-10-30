/** Static asset server + runtime API reverse proxy (no rebuild required). */
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const staticDir = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const backendHost = process.env.BACKEND_HOST || '127.0.0.1';
const backendPort = Number(process.env.BACKEND_PORT || 8888);
const listenPort = Number(process.env.FRONTEND_PORT || 8080);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  const rawPath = req.url || '/';
  if (rawPath === '/api' || rawPath.startsWith('/api/') || rawPath.startsWith('/api?')) {
    const upstream = http.request({
      hostname: backendHost,
      port: backendPort,
      path: rawPath,
      method: req.method,
      headers: { ...req.headers, host: `${backendHost}:${backendPort}` },
    }, (reply) => {
      res.writeHead(reply.statusCode || 502, reply.headers);
      reply.pipe(res);
    });
    upstream.on('error', (error) => {
      console.error('Backend unavailable:', error.message);
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Backend unavailable' }));
    });
    req.pipe(upstream);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end('Method not allowed');
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(rawPath, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Invalid URL');
    return;
  }
  let filePath = resolve(staticDir, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (filePath !== staticDir && !filePath.startsWith(staticDir + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    if (extname(pathname)) {
      res.writeHead(404).end('Not found');
      return;
    }
    filePath = resolve(staticDir, 'index.html');
  }
  if (!existsSync(filePath)) {
    res.writeHead(503).end('Frontend not built yet. Run npm run build first.');
    return;
  }
  res.writeHead(200, {
    'Content-Type': mime[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(filePath).pipe(res);
}).listen(listenPort, '0.0.0.0', () => {
  console.log(`Insights dashboard listening on :${listenPort}; /api -> ${backendHost}:${backendPort}`);
});
