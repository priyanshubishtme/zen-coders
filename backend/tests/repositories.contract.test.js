import { afterAll, describe, expect, it } from 'vitest';
import { createMemoryScanRepository } from '../src/repositories/memoryScanRepository.js';
import { createMongoScanRepository } from '../src/repositories/mongoScanRepository.js';
import { REPOSITORY_METHODS } from '../src/repositories/scanRepository.js';

const scan = (id) => ({
  id,
  inputHash: 'a'.repeat(64),
  status: 'queued',
  results: [{ x: 1 }],
  createdAt: new Date().toISOString(),
});

const mongoUri = process.env.MONGODB_URI;
const adapters = [
  ['memory', () => createMemoryScanRepository({ maxScans: 3 })],
  ...(mongoUri
    ? [
        [
          'mongo',
          () =>
            createMongoScanRepository({
              uri: mongoUri,
              dbName: `accessfix_test_${Date.now()}`,
              ttlDays: 30,
            }),
        ],
      ]
    : []),
];

if (!mongoUri) {
  console.warn('MONGODB_URI unset: Mongo contract tests skipped. Use docker compose to run them.');
}

describe.each(adapters)('%s repository', (name, make) => {
  const repo = make();
  afterAll(async () => {
    await repo.close?.();
  });

  it('implements every contract method', () => {
    for (const m of REPOSITORY_METHODS) expect(typeof repo[m], m).toBe('function');
    expect(['memory', 'mongo']).toContain(repo.kind);
  });

  it('saves, reads, patches and lists by id', async () => {
    await repo.ready;
    await repo.saveScan(scan('s1'));
    expect(await repo.getScan('s1')).toMatchObject({ id: 's1', status: 'queued' });
    expect(await repo.updateScan('s1', { status: 'completed' })).toMatchObject({
      status: 'completed',
      inputHash: 'a'.repeat(64),
    });
    expect(await repo.updateScan('missing', { status: 'x' })).toBeNull();
    expect(await repo.getScan('missing')).toBeNull();
    const listed = await repo.listByIds(['missing', 's1']);
    expect(listed.map((s) => s.id)).toEqual(['s1']);
  });

  it('never lets callers mutate stored state', async () => {
    await repo.ready;
    const original = scan('s-mut');
    await repo.saveScan(original);
    original.results[0].x = 99;
    const read = await repo.getScan('s-mut');
    read.status = 'tampered';
    expect(await repo.getScan('s-mut')).toMatchObject({ status: 'queued', results: [{ x: 1 }] });
  });

  it('counts usage', async () => {
    await repo.ready;
    await repo.recordUsage({ scanId: 's1', kind: 'scan', at: new Date().toISOString() });
    expect((await repo.usageSummary()).scans).toBeGreaterThanOrEqual(1);
  });

  if (name === 'memory') {
    it('evicts the least recently used scan past the cap', async () => {
      const r = make();
      for (const id of ['s1', 's2', 's3']) await r.saveScan(scan(id));
      await r.getScan('s1');
      await r.updateScan('s1', { status: 'touched' });
      await r.saveScan(scan('s4'));
      expect(await r.getScan('s2')).toBeNull();
      expect(await r.getScan('s1')).not.toBeNull();
    });
  }
});
