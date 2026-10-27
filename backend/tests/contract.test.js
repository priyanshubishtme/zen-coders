import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ErrorBody } from '../src/schemas/index.js';
import { testApp } from './helpers.js';

const app = testApp();

describe('API contract skeleton', () => {
  it.each([
    ['post', '/scans', { input: { type: 'html', html: '<p>hi</p>' } }],
    ['get', '/scans/abc', undefined],
    ['post', '/scans/abc/repairs', {}],
    ['post', '/scans/abc/verify', { repairIds: ['r1'] }],
    ['get', '/scans/abc/report', undefined],
    ['get', '/usage', undefined],
  ])('%s %s answers 501 NOT_IMPLEMENTED with the error envelope', async (method, path, body) => {
    const res = await request(app)[method](path).send(body);
    expect(res.status).toBe(501);
    expect(ErrorBody.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('rejects an invalid scan body with 400 VALIDATION_ERROR before any work', async () => {
    const res = await request(app)
      .post('/scans')
      .send({ input: { type: 'html', html: '' } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
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
});
