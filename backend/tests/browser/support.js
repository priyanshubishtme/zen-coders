import { readFileSync } from 'node:fs';
import http from 'node:http';
import { describe } from 'vitest';
import { isChromiumInstalled } from '../../src/services/scanner/browserPool.js';

export const SAMPLE_HTML = readFileSync(
  new URL('../../../samples/broken-sample.html', import.meta.url),
  'utf8',
);

/** Browser suites skip loudly (not fail) when Chromium has not been downloaded. */
export const describeBrowser = isChromiumInstalled() ? describe : describe.skip;
if (!isChromiumInstalled()) {
  console.warn(
    '\n⚠  Chromium is not installed: browser tests are SKIPPED.\n   Run `npm run browsers:install` to enable them.\n',
  );
}

/** Local HTTP server with the fixtures URL scans need. */
export async function startFixtureServer() {
  const server = http.createServer((req, res) => {
    switch (req.url) {
      case '/sample':
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(SAMPLE_HTML);
      case '/faint.css':
        res.writeHead(200, { 'content-type': 'text/css' });
        return res.end('.faint { color: #c8c8c8; background: #ffffff; }');
      case '/loop':
        res.writeHead(302, { location: '/loop' });
        return res.end();
      case '/doc.pdf':
        res.writeHead(200, { 'content-type': 'application/pdf' });
        return res.end('%PDF-1.4');
      case '/huge':
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(`<p>${'x'.repeat(200_000)}</p>`);
      default:
        res.writeHead(404, { 'content-type': 'text/html' });
        return res.end('<h1>Not found</h1>');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    port,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Poll GET /scans/:id like the UI does, until the scan settles. */
export async function waitForScan(agent, id, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await agent.get(`/scans/${id}`);
    if (res.body.status === 'completed' || res.body.status === 'failed') return res.body;
    if (Date.now() > deadline) throw new Error(`scan ${id} still ${res.body.stage}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}
