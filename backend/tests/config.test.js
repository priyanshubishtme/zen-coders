import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';

describe('loadConfig', () => {
  it('runs with no environment at all: LLM off, memory store', () => {
    const c = loadConfig({});
    expect(c.LLM_PROVIDER).toBe('none');
    expect(c.STORE).toBe('memory');
    expect(c.INCLUDE_AAA).toBe(false);
  });

  it('treats blank values as unset', () => {
    expect(loadConfig({ PORT: '' }).PORT).toBe(4000);
  });

  it('fails fast on invalid values', () => {
    expect(() => loadConfig({ LLM_PROVIDER: 'gpt' })).toThrow(/LLM_PROVIDER/);
  });
});
