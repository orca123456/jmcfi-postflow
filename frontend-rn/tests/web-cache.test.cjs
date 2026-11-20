const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createWebServer, listenWebServer } = require('../scripts/serve-web.cjs');

test('production preview caches versioned assets, revalidates HTML, and proxies APIs', async () => {
  const backend = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ path: req.url, auth: req.headers.authorization }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const server = createWebServer({ backend: `http://127.0.0.1:${backend.address().port}` });
  await new Promise(resolve => listenWebServer(server, 0, resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const html = await fetch(base + '/dashboard/requestor');
    assert.equal(html.status, 200);
    assert.equal(html.headers.get('cache-control'), 'no-cache');
    assert.match(await html.text(), /postflow-shell/);
    const bundle = fs.readdirSync(path.resolve(__dirname, '../dist/_expo/static/js/web')).find(n => n.startsWith('entry-'));
    const asset = await fetch(base + '/_expo/static/js/web/' + bundle, { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.equal(asset.headers.get('content-encoding'), 'gzip');
    await asset.arrayBuffer();
    const unchanged = await fetch(base + '/_expo/static/js/web/' + bundle, { headers: { 'If-None-Match': asset.headers.get('etag') } });
    assert.equal(unchanged.status, 304);
    const missing = await fetch(base + '/_expo/missing.js');
    assert.equal(missing.status, 404);
    const api = await fetch(base + '/api/posts?page=2', { headers: { Authorization: 'Bearer test-only' } });
    assert.equal(api.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await api.json(), { path: '/api/posts?page=2', auth: 'Bearer test-only' });
    // localhost must reach the same API proxy regardless of its DNS address.
    for (const host of ['localhost', '[::1]']) {
      const response = await fetch(`http://${host}:${server.address().port}/api/probe`);
      assert.deepEqual(await response.json(), { path: '/api/probe' });
    }
    // Expo's default wildcard listener must fail instead of taking localhost.
    for (const host of ['::']) {
      const competing = http.createServer();
      await assert.rejects(new Promise((resolve, reject) => {
        competing.once('error', reject);
        competing.listen(server.address().port, host, () => {
          competing.close();
          resolve();
        });
      }), { code: 'EADDRINUSE' });
    }
  } finally {
    server.closeAllConnections();
    backend.closeAllConnections();
    await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => backend.close(resolve))]);
  }
});
