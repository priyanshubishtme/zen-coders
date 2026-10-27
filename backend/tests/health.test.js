import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { HealthResponse } from '../src/schemas/index.js';
import { testApp } from './helpers.js';

describe('GET /health', () => {
  it('returns 200 and a contract-valid body', async () => {
    const res = await request(testApp()).get('/health');
    expect(res.status).toBe(200);
    expect(HealthResponse.safeParse(res.body).success).toBe(true);
  });

  it('reports LLM off and the memory store by default', async () => {
    const res = await request(testApp()).get('/health');
    expect(res.body.checks).toMatchObject({ llm: 'off', store: 'memory' });
  });

  it('is degraded, not failing, when the browser is down', async () => {
    const res = await request(testApp()).get('/health');
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.browser).toBe('down');
  });
});
