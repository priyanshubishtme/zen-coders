import { NotImplementedError } from '../../utils/errors.js';

/**
 * Scanner: render input in an isolated Chromium context and run axe-core plus
 * our deterministic checks. Returns raw, un-normalized engine output.
 *
 * Extension points (docs/09-roadmap-future.md): URL fetch (Phase 2),
 * SPA hydration waits, auth cookies, keyboard/focus simulation, multi-page crawl.
 *
 * @typedef {object} RawScanResult
 * @property {string} axeVersion
 * @property {object[]} violations   axe results.violations
 * @property {object[]} passes       axe results.passes
 * @property {object[]} incomplete   axe results.incomplete (needs review)
 * @property {object[]} extraChecks  results from services/scanner/checks/*
 * @property {number} durationMs
 *
 * @typedef {object} Scanner
 * @property {(input: { type: 'html', html: string } | { type: 'url', url: string },
 *   options: { includeAAA: boolean, includeBestPractice: boolean }) => Promise<RawScanResult>} scan
 * @property {() => Promise<'up' | 'down'>} health
 * @property {() => Promise<void>} close
 */

/** @returns {Scanner} */
export function createScanner() {
  return {
    async scan() {
      throw new NotImplementedError('Scanner.scan');
    },
    async health() {
      return 'down';
    },
    async close() {},
  };
}

/** axe tags for the default WCAG 2.2 AA target. */
export function axeTags({ includeAAA, includeBestPractice }) {
  const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
  if (includeAAA) tags.push('wcag2aaa', 'wcag21aaa', 'wcag22aaa');
  if (includeBestPractice) tags.push('best-practice');
  return tags;
}
