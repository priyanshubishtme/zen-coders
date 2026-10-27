import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ErrorBody, Scan, ScanAccepted } from '../src/schemas/index.js';
import { fakeLookup, testApp } from './helpers.js';

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
    expect(got.body).toMatchObject({ status: 'completed', stage: 'done', score: null });
    expect(got.body.violations[0].ruleId).toBe('image-alt');
    expect(got.body.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(got.body)).not.toContain('<p>hi</p>');
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
    expect(res.body.scans).toBe(1);
  });
});

describe('not yet implemented (Phase 2+)', () => {
  const app = testApp();
  it.each([
    ['post', '/scans/abc/repairs', {}],
    ['post', '/scans/abc/verify', { repairIds: ['r1'] }],
    ['get', '/scans/abc/report', undefined],
  ])('%s %s answers 501 NOT_IMPLEMENTED with the error envelope', async (method, path, body) => {
    const res = await request(app)[method](path).send(body);
    expect(res.status).toBe(501);
    expect(ErrorBody.safeParse(res.body).success).toBe(true);
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
