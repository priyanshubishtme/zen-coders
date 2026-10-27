import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ErrorBody, Scan, ScanAccepted, UsageResponse } from '../src/schemas/index.js';
import { fakeLookup, fakeRaw, fakeScanner, testApp } from './helpers.js';

describe('POST /scans + GET /scans/:id', () => {
  it('accepts pasted HTML with 202, then serves a contract-valid completed scan', async () => {
    const app = testApp();
    const res = await request(app)
      .post('/scans')
      .send({ input: { type: 'html', html: '<p>hi</p>' } });
    expect(res.status).toBe(202);
    expect(ScanAccepted.safeParse(res.body).success).toBe(true);
    expect(res.headers.location).toBe(`/scans/${res.body.id}`);

    await app.locals.orchestrator.idle();
    const got = await request(app).get(`/scans/${res.body.id}`);
    expect(got.status).toBe(200);
    const parsed = Scan.safeParse(got.body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(got.body).toMatchObject({ status: 'completed', stage: 'done', score: { value: 0 } });
    expect(got.body.violations[0].ruleId).toBe('image-alt');
    expect(got.body.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(got.body)).not.toContain('<p>hi</p>');
    expect(res.body.id).toMatch(/^s_[A-Za-z0-9_-]{21,}$/);
  });

  it('returns the same scan for a repeated Idempotency-Key', async () => {
    const app = testApp();
    const body = { input: { type: 'html', html: '<p>idem</p>' } };
    const a = await request(app).post('/scans').set('Idempotency-Key', 'demo-1').send(body);
    const b = await request(app).post('/scans').set('Idempotency-Key', 'demo-1').send(body);
    expect(a.body.id).toBe(b.body.id);
    await app.locals.orchestrator.idle();
  });

  it('lists only the requested scan ids', async () => {
    const app = testApp();
    const a = await request(app).post('/scans').send({ input: { type: 'html', html: '<p>a</p>' } });
    await request(app).post('/scans').send({ input: { type: 'html', html: '<p>b</p>' } });
    await app.locals.orchestrator.idle();
    const listed = await request(app).get(`/scans`).query({ ids: `${a.body.id},nope` });
    expect(listed.status).toBe(200);
    expect(listed.body.scans.map((s) => s.id)).toEqual([a.body.id]);
  });

  it('refuses GET /scans without ids (no global listing)', async () => {
    const res = await request(testApp()).get('/scans');
    expect(res.status).toBe(400);
  });

  it('serves an escaped HTML report as an attachment with a strict CSP', async () => {
    const app = testApp();
    const created = await request(app)
      .post('/scans')
      .send({ input: { type: 'html', html: '<p>hi</p>' } });
    await app.locals.orchestrator.idle();
    const res = await request(app).get(`/scans/${created.body.id}/report`).query({ format: 'html' });
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-security-policy']).toMatch(/default-src 'none'/);
    expect(res.text).toContain('AccessFix report');
    expect(res.text).not.toContain('<script>');
  });

  it('replays the scan log as server-sent events and refuses a screenshot path', async () => {
    const app = testApp();
    const created = await request(app).post('/scans').send({ input: { type: 'html', html: '<p>hi</p>' } });
    await app.locals.orchestrator.idle();
    const events = await request(app).get(`/scans/${created.body.id}/events`);
    expect(events.status).toBe(200);
    expect(events.headers['content-type']).toMatch(/text\/event-stream/);
    expect(events.text).toContain('"stage":"axe"');
    const missing = await request(app).get(`/scans/${created.body.id}/screenshot`).query({ which: 'before' });
    expect(missing.status).toBe(404);
    const bad = await request(app).get(`/scans/${created.body.id}/screenshot`).query({ which: '../etc/passwd' });
    expect(bad.status).toBe(400);
    const source = await request(app).get(`/scans/${created.body.id}/source`);
    expect(source.status).toBe(410);
    expect(source.body.error.code).toBe('SOURCE_EXPIRED');
  });

  it('accepts a public URL after the safety check', async () => {
    const app = testApp({ lookup: fakeLookup({ 'example.com': ['93.184.215.14'] }) });
    const res = await request(app)
      .post('/scans')
      .send({ input: { type: 'url', url: 'https://example.com/' } });
    expect(res.status).toBe(202);
  });

  it('returns 404 for an unknown scan', async () => {
    const res = await request(testApp()).get('/scans/s_missing');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('serves GET /usage with the scan count', async () => {
    const app = testApp();
    await request(app)
      .post('/scans')
      .send({ input: { type: 'html', html: '<p>x</p>' } });
    const res = await request(app).get('/usage');
    expect(res.status).toBe(200);
    expect(UsageResponse.safeParse(res.body).success).toBe(true);
    expect(res.body.scans).toBe(1);
    expect(res.body.tokens.provider).toBe('none');
  });
});

describe('repairs and verify preconditions', () => {
  it.each([
    ['post', '/scans/s_missing/repairs', {}],
    ['post', '/scans/s_missing/verify', { repairIds: ['r1'] }],
    ['get', '/scans/s_missing/patched.html', undefined],
  ])('%s %s answers 404 for an unknown scan', async (method, path, body) => {
    const res = await request(testApp())[method](path).send(body);
    expect(res.status).toBe(404);
    expect(ErrorBody.safeParse(res.body).success).toBe(true);
  });

  it('answers 410 SOURCE_EXPIRED when the scanned source is no longer held', async () => {
    const app = testApp(); // the fake scanner returns no source, as after expiry
    const { body } = await request(app).post('/scans').send({ input: { type: 'html', html: '<p>x</p>' } });
    await app.locals.orchestrator.idle();
    const res = await request(app).post(`/scans/${body.id}/repairs`).send({});
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('SOURCE_EXPIRED');
  });

  it('answers 409 SCAN_NOT_READY while the scan is running', async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    const app = testApp({ scanner: fakeScanner(() => gate.then(fakeRaw)) });
    const { body } = await request(app).post('/scans').send({ input: { type: 'html', html: '<p>x</p>' } });
    const res = await request(app).post(`/scans/${body.id}/repairs`).send({});
    expect(res.status).toBe(409);
    release();
    await app.locals.orchestrator.idle();
  });

  it('returns 404 for a report whose scan has expired or never existed', async () => {
    const res = await request(testApp()).get('/scans/abc/report');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('error envelope', () => {
  const app = testApp();

  it('rejects an invalid body with 400 and field paths', async () => {
    const res = await request(app)
      .post('/scans')
      .send({ input: { type: 'html', html: '' } });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('body.input.html');
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/scans')
      .set('content-type', 'application/json')
      .send('{"input":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 NOT_FOUND for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rate-limits scan creation per IP with RATE_LIMITED', async () => {
    const limited = testApp({ env: { SCAN_RATE_LIMIT_RPM: '2' } });
    const send = () =>
      request(limited)
        .post('/scans')
        .send({ input: { type: 'html', html: '<p>x</p>' } });
    await send();
    await send();
    const res = await send();
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers.ratelimit).toBeDefined();
  });
});
