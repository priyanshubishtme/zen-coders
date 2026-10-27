import { execSync } from 'node:child_process';
import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { testConfig } from '../helpers.js';
import { describeBrowser, waitForScan } from './support.js';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const dist = path.join(root, 'frontend', 'dist');
const selfScanPath = path.join(root, 'frontend', 'src', 'generated', 'self-scan.json');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function startSpa(dir) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = path.join(dir, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(dir)) {
      res.writeHead(403);
      return res.end();
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(dir, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404);
      return res.end('missing');
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

describeBrowser('AccessFix UI scanned by AccessFix', { timeout: 120_000 }, () => {
  let app;
  let agent;
  let spa;

  beforeAll(async () => {
    execSync('npm run build -w frontend', { cwd: root, stdio: 'pipe' });
    spa = await startSpa(dist);
    app = createApp(
      testConfig({
        SCAN_RATE_LIMIT_RPM: '1000',
        ALLOW_PRIVATE_URLS: 'true',
        LLM_PROVIDER: 'none',
      }),
    );
    agent = request(app);
  });

  afterAll(async () => {
    await spa?.close();
    await app?.locals.orchestrator.idle();
    await app?.locals.scanner.close();
  });

  it('finds zero automated violations and zero regressions on the built UI', async () => {
    const created = await agent.post('/scans').send({ input: { type: 'url', url: spa.origin + '/' } });
    expect(created.status).toBe(202);
    const scan = await waitForScan(agent, created.body.id, 60_000);
    expect(scan.status).toBe('completed');
    expect(scan.page?.title).toBe('AccessFix');
    expect(scan.score?.value).not.toBeNull();
    expect(scan.violations, JSON.stringify(scan.violations.map((v) => v.ruleId))).toEqual([]);

    const repairs = await agent.post(`/scans/${scan.id}/repairs`).send({ useLlm: false });
    const ids = (repairs.body.repairs ?? []).filter((r) => r.status === 'verified').map((r) => r.id);
    if (ids.length) {
      const verified = await agent.post(`/scans/${scan.id}/verify`).send({ repairIds: ids });
      expect(verified.body.regressions).toEqual([]);
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      violationCount: scan.violations.length,
      score: scan.score?.value ?? null,
      manualReview: scan.manualReview.map((v) => ({ ruleId: v.ruleId, title: v.title })),
    };
    writeFileSync(selfScanPath, `${JSON.stringify(payload, null, 2)}\n`);
    expect(payload.violationCount).toBe(0);
  });
});
