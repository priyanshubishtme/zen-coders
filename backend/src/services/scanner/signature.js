import { shortHash } from '../../utils/hash.js';

/** Attributes that describe what an element *is*; everything else is noise for dedupe. */
const KEEP = new Set(['type', 'role', 'name', 'alt', 'title', 'placeholder', 'href', 'src', 'for']);

function normalizeUrl(value) {
  const path = value.split(/[?#]/)[0];
  const file = path.split('/').filter(Boolean).pop() ?? path;
  return file.replace(/\d+/g, '#');
}

/**
 * Reduce an element snippet to its pattern: tag, identity attributes (ids,
 * classes and data-* dropped; URLs reduced to file name; digits -> #) and a
 * short normalized text. Ten identical icon buttons share one pattern.
 */
export function normalizePattern(html) {
  const open = /^<([a-z][\w-]*)([^>]*)>/i.exec(html.trim());
  if (!open) return html.trim().toLowerCase().replace(/\d+/g, '#').slice(0, 80);
  const [, tag, attrSource] = open;
  const attrs = [];
  for (const m of attrSource.matchAll(/([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    const name = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    if (KEEP.has(name) || name.startsWith('aria-')) {
      if (name.startsWith('aria-labelledby') || name.startsWith('aria-describedby')) continue;
      const v =
        name === 'href' || name === 'src' ? normalizeUrl(value) : value.replace(/\d+/g, '#');
      attrs.push(`${name}=${v.toLowerCase()}`);
    }
  }
  const text = html
    .slice(open[0].length)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\d+/g, '#')
    .slice(0, 40);
  return [tag.toLowerCase(), ...attrs.sort(), text].join('|');
}

export const patternSignature = (ruleId, html) => `${ruleId}:${shortHash(normalizePattern(html))}`;
