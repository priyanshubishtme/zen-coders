import { describe, expect, it } from 'vitest';
import { RULE_TEMPLATES, describeRule } from '../src/services/scanner/templates/rules.js';
import {
  KNOWN_CRITERIA,
  criterionFromTag,
  criterionRef,
} from '../src/services/scanner/templates/wcag.js';

/** Every rule named in docs/05-repair-catalog.md plus the WebAIM top six. */
const CATALOG_RULES = [
  'color-contrast',
  'image-alt',
  'label',
  'link-name',
  'button-name',
  'html-has-lang',
  'html-lang-valid',
  'valid-lang',
  'document-title',
  'meta-viewport',
  'meta-refresh',
  'link-in-text-block',
  'select-name',
  'input-button-name',
  'input-image-alt',
  'frame-title',
  'aria-hidden-focus',
  'scrollable-region-focusable',
  'list',
  'listitem',
  'duplicate-id-aria',
  'aria-valid-attr',
  'aria-allowed-attr',
  'aria-prohibited-attr',
  'target-size',
  'autocomplete-valid',
  'heading-order',
  'page-has-heading-one',
  'landmark-one-main',
  'region',
  'tabindex',
  'empty-heading',
  'video-caption',
  'audio-caption',
  'aria-required-children',
  'aria-required-parent',
  'aria-roles',
  'nested-interactive',
  'td-headers-attr',
  'th-has-data-cells',
  'td-has-header',
  'bypass',
];

describe('plain-language templates', () => {
  it.each(CATALOG_RULES)('%s has a template', (ruleId) => {
    expect(RULE_TEMPLATES[ruleId], ruleId).toBeDefined();
  });

  it.each(Object.entries(RULE_TEMPLATES))('%s is complete and readable', (_id, t) => {
    expect(t.title.length).toBeGreaterThan(5);
    expect(t.title.length).toBeLessThanOrEqual(70);
    expect(t.explanation.length).toBeLessThanOrEqual(220);
    expect(t.who.length).toBeGreaterThan(5);
    expect(t.title).not.toMatch(/\b(axe|wcag\d)/i);
  });

  it('every criterion referenced by our own checks is known', () => {
    for (const t of Object.values(RULE_TEMPLATES)) {
      for (const sc of t.criteria ?? []) expect(KNOWN_CRITERIA).toContain(sc);
    }
  });

  it('falls back to axe help text with a category-based audience', () => {
    expect(
      describeRule('brand-new-rule', {
        help: 'Do X',
        description: 'Because Y',
        tags: ['cat.keyboard'],
      }),
    ).toEqual({
      title: 'Do X',
      explanation: 'Because Y',
      whoItAffects: 'People who use a keyboard or switch device instead of a mouse',
    });
  });
});

describe('WCAG references', () => {
  it.each([
    ['wcag111', '1.1.1'],
    ['wcag143', '1.4.3'],
    ['wcag1410', '1.4.10'],
    ['wcag2411', '2.4.11'],
    ['wcag258', '2.5.8'],
    ['wcag2aa', null],
    ['wcag22aa', null],
    ['best-practice', null],
  ])('%s -> %s', (tag, sc) => {
    expect(criterionFromTag(tag)).toBe(sc);
  });

  it('links to the W3C Understanding page', () => {
    expect(criterionRef('1.4.3')).toEqual({
      sc: '1.4.3',
      name: 'Contrast (Minimum)',
      level: 'AA',
      url: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
    });
  });

  it('labels 4.1.1 as obsolete', () => {
    expect(criterionRef('4.1.1').name).toMatch(/obsolete/);
  });
});
