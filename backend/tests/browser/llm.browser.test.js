import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { CreateRepairsResponse } from '../../src/schemas/index.js';
import { testConfig } from '../helpers.js';
import { SAMPLE_HTML, describeBrowser, waitForScan } from './support.js';

describeBrowser('AI drafts on the broken sample (mock provider)', { timeout: 60_000 }, () => {
  let app;
  let agent;
  let scanId;

  beforeAll(async () => {
    app = createApp(testConfig({ SCAN_RATE_LIMIT_RPM: '1000', LLM_PROVIDER: 'mock' }), {
      lookup: async () => {
        throw new Error('network is off');
      },
    });
    agent = request(app);
    const res = await agent.post('/scans').send({ input: { type: 'html', html: SAMPLE_HTML } });
    scanId = res.body.id;
    await waitForScan(agent, scanId);
  });

  afterAll(async () => {
    await app?.locals.orchestrator.idle();
    await app?.locals.scanner.close();
  });

  it('fills image-alt with a mock draft and saves tokens versus naive', async () => {
    const res = await agent.post(`/scans/${scanId}/repairs`).send({ useLlm: true });
    expect(res.status).toBe(200);
    expect(CreateRepairsResponse.safeParse(res.body).success).toBe(true);
    const img = res.body.repairs.find((r) => r.ruleId === 'image-alt');
    expect(img).toMatchObject({ strategy: 'llm', status: 'needs-input', accepted: false });
    expect(img.draft).toBeTruthy();
    expect(res.body.tokenUsage.tokensSaved).toBeGreaterThan(0);
    expect(res.body.tokenUsage.totalTokens).toBeGreaterThan(0);

    const denied = await agent.post(`/scans/${scanId}/verify`).send({ repairIds: [img.id] });
    expect(denied.body.repairs[0]).toMatchObject({
      outcome: 'not-applied',
      detail: 'Accept the AI draft first.',
    });
  });
});
