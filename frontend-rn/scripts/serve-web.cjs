const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const zlib = require('node:zlib');
const { createHash } = require('node:crypto');

const ROOT = path.resolve(__dirname, '../dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function createWebServer({ root = ROOT, backend = 'http://127.0.0.1:8000' } = {}) {
  const upstream = new URL(backend);
  const assets = new Map();
  return http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (/^\/(api|storage|sanctum)(\/|$)/.test(pathname)) {
      const transport = upstream.protocol === 'https:' ? https : http;
      const proxy = transport.request(new URL(req.url, upstream), {
        method: req.method,
        headers: { ...req.headers, host: upstream.host },
      }, response => {
        // Authenticated API and storage responses are not part of the asset cache.
        res.writeHead(response.statusCode, { ...response.headers, 'cache-control': 'no-store' });
        response.pipe(res);
      });
      proxy.setTimeout(65000, () => proxy.destroy(new Error('Backend timed out')));
      proxy.on('error', () => {
        if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ message: 'Backend unavailable. Start Laravel on port 8000.' }));
      });
      req.on('aborted', () => proxy.destroy());
      req.pipe(proxy);
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch {
      res.writeHead(400).end();
      return;
    }
    let filename = path.resolve(root, '.' + decoded);
    if (filename !== root && !filename.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      // Missing assets must be 404s; extensionless application routes use the SPA.
      if (path.extname(decoded)) {
        res.writeHead(404).end();
        return;
      }
      filename = path.join(root, 'index.html');
    }
    try {
      const stat = fs.statSync(filename);
      let asset = assets.get(filename);
      if (!asset || asset.modified !== stat.mtimeMs || asset.size !== stat.size) {
        const body = fs.readFileSync(filename);
        const type = TYPES[path.extname(filename)] || 'application/octet-stream';
        asset = {
          body, type, modified: stat.mtimeMs, size: stat.size,
          etag: '"' + createHash('sha256').update(body).digest('hex') + '"',
          gzip: /text\/|json|svg/.test(type) ? zlib.gzipSync(body) : null,
        };
        assets.set(filename, asset);
      }
      const immutable = /[-.][a-f0-9]{16,}\./i.test(path.basename(filename));
      res.setHeader('Content-Type', asset.type);
      res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
      res.setHeader('ETag', asset.etag);
      res.setHeader('Vary', 'Accept-Encoding');
      if ((req.headers['if-none-match'] || '').split(/,\s*/).includes(asset.etag)) {
        res.writeHead(304).end();
        return;
      }
      const compressed = asset.gzip && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      const body = compressed ? asset.gzip : asset.body;
      if (compressed) res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', body.length);
      res.writeHead(200);
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(500).end('Build unavailable. Run npm run export:web.');
    }
  });
}

function listenWebServer(server, port, onListening) {
  // Own both IPv6 and IPv4. Binding only 127.0.0.1 allowed Expo to start on
  // :: at the same port, so "localhost" could silently reach the wrong app.
  return server.listen({ port, host: '::', ipv6Only: false }, onListening);
}

if (require.main === module) {
  if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
    console.error('Build missing. Run npm run export:web first.');
    process.exit(1);
  }
  const portIndex = process.argv.indexOf('--port');
  const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : process.env.PORT || 3000);
  const server = createWebServer({ backend: process.env.POSTFLOW_BACKEND_URL || 'http://127.0.0.1:8000' });
  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      try {
        const { execSync } = require('node:child_process');
        const netstat = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
        for (const line of netstat.split('\n')) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5 && parts[1].endsWith(`:${port}`) && parts[3] === 'LISTENING') {
            const pid = parseInt(parts[4], 10);
            if (pid && pid !== process.pid) {
              execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
              console.log(`Port ${port} was occupied by stale PID ${pid}. Terminated and retrying...`);
              setTimeout(() => listenWebServer(server, port, () => console.log(`PostFlow production preview: http://localhost:${port}\nBrowser asset cache enabled. API proxy: ${process.env.POSTFLOW_BACKEND_URL || 'http://127.0.0.1:8000'}`)), 600);
              return;
            }
          }
        }
      } catch (_) {}
      console.error(`Port ${port} is in use. Stop the old Expo server or pass --port 3001.`);
      process.exitCode = 1;
      return;
    }
    console.error(error.message);
    process.exitCode = 1;
  });
  listenWebServer(server, port, () => console.log(`PostFlow production preview: http://localhost:${port}\nBrowser asset cache enabled. API proxy: ${process.env.POSTFLOW_BACKEND_URL || 'http://127.0.0.1:8000'}`));
}

module.exports = { createWebServer, listenWebServer };
