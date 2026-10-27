import { describe, expect, it } from 'vitest';
import { detectLanguage, fixLangCode } from '../../src/services/repair/lang.js';
import * as lang from '../../src/services/repair/rules/documentLang.js';
import * as title from '../../src/services/repair/rules/documentTitle.js';
import { run, violation } from './helpers.js';

const english =
  'Fresh bread every morning, baked before sunrise. Order online and we will deliver it to your door. More about our bakery and the people who work here.';

describe('language detection', () => {
  it('recognizes English with confidence', () => {
    expect(detectLanguage(english)).toEqual({ lang: 'en', confident: true });
  });

  it('recognizes Spanish and Devanagari', () => {
    expect(detectLanguage('El pan fresco de la casa es el mejor para los que buscan calidad y sabor en la ciudad con su familia').lang).toBe('es');
    expect(detectLanguage('यह एक परीक्षण पृष्ठ है जिसमें हिंदी में बहुत सारा पाठ लिखा गया है ताकि पहचान हो सके').lang).toBe('hi');
  });

  it('defaults to en without confidence when unsure', () => {
    expect(detectLanguage('Xyzzy plugh')).toEqual({ lang: 'en', confident: false });
  });

  it.each([
    ['english', 'en'],
    ['en_us', 'en-US'],
    ['EN', 'en'],
    ['klingon-ish', null],
  ])('maps %s -> %s', (from, to) => expect(fixLangCode(from)).toBe(to));
});

describe('html-has-lang repair', () => {
  it('adds lang to <html> and touches nothing else', () => {
    const src = `<!doctype html>\n<html>\n<body><p>${english}</p></body>\n</html>`;
    const { p, after } = run(lang, src, violation('html-has-lang', 'html'));
    expect(after).toBe(src.replace('<html>', '<html lang="en">'));
    expect(p.confidence).toBe('high');
  });

  it('adds an <html> tag after the doctype when the source has none', () => {
    const src = `<!doctype html><p>${english}</p>`;
    const { after } = run(lang, src, violation('html-has-lang', 'html'));
    expect(after.startsWith('<!doctype html><html lang="en"><p>')).toBe(true);
  });

  it('fixes an invalid lang value', () => {
    const { after } = run(lang, '<html lang="english"><body></body></html>', violation('html-lang-valid', 'html'));
    expect(after).toBe('<html lang="en"><body></body></html>');
  });
});

describe('document-title repair', () => {
  it('adds a title from the first h1', () => {
    const src = '<html>\n  <head>\n    <meta charset="utf-8">\n  </head>\n<body><h1>Weekly <b>specials</b></h1></body></html>';
    const { p, after } = run(title, src, violation('document-title', 'html'));
    expect(after).toContain('<title>Weekly specials</title>\n  </head>');
    expect(p.strategy).toBe('deterministic');
  });

  it('fills an empty title', () => {
    const { after } = run(title, '<html><head><title></title></head><body><h1>Hi</h1></body></html>', violation('document-title', 'html'));
    expect(after).toContain('<title>Hi</title>');
  });

  it('uses a template placeholder when there is no heading', () => {
    const { p, after } = run(title, '<p>x</p>', violation('document-title', 'html'));
    expect(p.strategy).toBe('template');
    expect(after).toContain('<title>TODO: page title</title>');
  });
});
