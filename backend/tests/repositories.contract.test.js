import { describe, expect, it } from 'vitest';
import { createMemoryScanRepository } from '../src/repositories/memoryScanRepository.js';
import { createMongoScanRepository } from '../src/repositories/mongoScanRepository.js';
import { REPOSITORY_METHODS } from '../src/repositories/scanRepository.js';

const scan = (id) => ({ id, inputHash: 'a'.repeat(64), status: 'queued', results: [{ x: 1 }] });

describe.each([
  ['memory', () => createMemoryScanRepository({ maxScans: 3 })],
  ['mongo (stub)', () => createMongoScanRepository({ uri: '' })],
])('%s repository', (name, make) => {
  it('implements every contract method', () => {
    const repo = make();
    for (const m of REPOSITORY_METHODS) expect(typeof repo[m], m).toBe('function');
    expect(['memory', 'mongo']).toContain(repo.kind);
  });

  if (name.startsWith('mongo')) {
    it('throws NOT_IMPLEMENTED until Phase 4', async () => {
      await expect(make().saveScan(scan('s1'))).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    });
    return;
  }

  it('saves, reads and patches scans', async () => {
    const repo = make();
    await repo.saveScan(scan('s1'));
    expect(await repo.getScan('s1')).toMatchObject({ id: 's1', status: 'queued' });
    expect(await repo.updateScan('s1', { status: 'completed' })).toMatchObject({
      status: 'completed',
      inputHash: 'a'.repeat(64),
    });
    expect(await repo.updateScan('missing', { status: 'x' })).toBeNull();
    expect(await repo.getScan('missing')).toBeNull();
  });

  it('never lets callers mutate stored state', async () => {
    const repo = make();
    const original = scan('s1');
    await repo.saveScan(original);
    original.results[0].x = 99;
    const read = await repo.getScan('s1');
    read.status = 'tampered';
    expect(await repo.getScan('s1')).toMatchObject({ status: 'queued', results: [{ x: 1 }] });
  });

  it('evicts the least recently used scan past the cap', async () => {
    const repo = make();
    for (const id of ['s1', 's2', 's3']) await repo.saveScan(scan(id));
    await repo.getScan('s1');
    await repo.updateScan('s1', { status: 'touched' });
    await repo.saveScan(scan('s4'));
    expect(await repo.getScan('s2')).toBeNull();
    expect(await repo.getScan('s1')).not.toBeNull();
  });

  it('counts usage', async () => {
    const repo = make();
    await repo.recordUsage({ scanId: 's1', kind: 'scan', at: new Date().toISOString() });
    expect((await repo.usageSummary()).scans).toBe(1);
  });
});
