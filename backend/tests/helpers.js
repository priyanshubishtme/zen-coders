import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

export const testConfig = (env = {}) => loadConfig({ NODE_ENV: 'test', ...env });

/** DNS stand-in: every host in `map` resolves to the listed addresses. */
export const fakeLookup = (map) => async (host) => {
  if (!(host in map)) throw new Error('ENOTFOUND');
  return map[host].map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
};

/** Minimal axe-shaped result used by the fake scanner. */
export const fakeRaw = () => ({
  axeVersion: '4.14.0',
  violations: [
    {
      id: 'image-alt',
      tags: ['cat.text-alternatives', 'wcag2a', 'wcag111'],
      impact: 'critical',
      help: 'Images must have alternative text',
      description: 'd',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.14/image-alt',
      nodes: [
        {
          target: ['img'],
          html: '<img src="a.jpg">',
          impact: 'critical',
          failureSummary: 'x',
          afxId: 1,
        },
      ],
    },
  ],
  incomplete: [],
  findings: [],
  headingOutline: [{ level: 1, text: 'Hi', afxId: 2, target: ['h1'] }],
  page: { finalUrl: null, title: 'T', settled: true },
  network: { requests: 0, blocked: 0, blockedSamples: [] },
  timings: { loadMs: 1, renderMs: 1, axeMs: 1, checksMs: 1 },
});

/**
 * Scanner double. `behaviour` decides each scan: return a raw result, or throw.
 * Records stages so tests can assert progress reporting.
 */
export function fakeScanner(behaviour = async () => fakeRaw()) {
  const calls = [];
  return {
    calls,
    async scan(input, options, { onStage } = {}) {
      const stages = [];
      calls.push({ input, options, stages });
      for (const s of ['loading', 'rendering', 'checking']) {
        stages.push(s);
        onStage?.(s);
      }
      return behaviour(input);
    },
    health: async () => 'down',
    stats: () => ({ active: 0, queued: 0, maxContexts: 1 }),
    close: async () => {},
  };
}

export function testApp({ env, scanner = fakeScanner(), lookup, ...rest } = {}) {
  return createApp(testConfig(env), { scanner, lookup, ...rest });
}
