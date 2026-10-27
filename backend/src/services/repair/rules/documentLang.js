import { manual, patch } from '../context.js';
import { insertAt, setAttr } from '../edits.js';
import { detectLanguage, fixLangCode } from '../lang.js';

export const ruleIds = ['html-has-lang', 'html-lang-valid'];

export function propose(v, ctx) {
  const html = ctx.$('html')[0];

  if (v.ruleId === 'html-lang-valid') {
    const current = html?.attribs?.lang;
    const fixed = fixLangCode(current);
    if (!fixed || !html?.sourceCodeLocation) {
      return manual(`"${current}" is not a language code we can map automatically.`, [
        'Use a BCP 47 code such as "en", "en-GB" or "hi".',
      ]);
    }
    return patch({
      strategy: 'deterministic',
      confidence: 'high',
      mark: html,
      edits: [setAttr(ctx.source, html, 'lang', fixed)],
      explanation: `Replaces lang="${current}" with the valid code "${fixed}".`,
    });
  }

  const { lang, confident } = detectLanguage(ctx.$('body').text() || ctx.$.root().text());
  const explanation = confident
    ? `Adds lang="${lang}" to <html>; the page text reads as that language.`
    : `Adds lang="${lang}" to <html>. The language could not be detected with confidence, so check it.`;
  const notes = confident ? [] : ['Change the code if the page is not in this language.'];

  if (html?.sourceCodeLocation) {
    return patch({
      strategy: 'deterministic',
      confidence: confident ? 'high' : 'medium',
      mark: html,
      edits: [setAttr(ctx.source, html, 'lang', lang)],
      explanation,
      notes,
    });
  }
  // No <html> tag in the source: adding one (end tag is optional) is valid HTML.
  const doctype = /^\s*<!doctype[^>]*>/i.exec(ctx.source);
  return patch({
    strategy: 'deterministic',
    confidence: confident ? 'high' : 'medium',
    edits: [insertAt(doctype ? doctype[0].length : 0, `<html lang="${lang}">`)],
    explanation: `${explanation} The source had no <html> tag, so one is added.`,
    notes,
  });
}
