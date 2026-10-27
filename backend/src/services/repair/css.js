import { parseHex, toHex } from './color.js';

/** Normalize a CSS colour value we can compare (#rgb, #rrggbb, rgb()). Others -> null. */
export function cssColorToHex(value) {
  const v = String(value).trim().toLowerCase();
  if (v.startsWith('#')) {
    const rgb = parseHex(v);
    return rgb ? toHex(rgb) : null;
  }
  const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/.exec(v);
  if (!m) return null;
  if (m[4] !== undefined && parseFloat(m[4]) < (m[4].endsWith('%') ? 100 : 1)) return null;
  return toHex([m[1], m[2], m[3]].map((n) => Number(n) / 255));
}

/**
 * Every `color:` declaration in the page's own <style> blocks, with absolute
 * source offsets of its value. Ignores our own data-accessfix block.
 * @returns {{ selector: string, value: string, start: number, end: number, important: boolean }[]}
 */
export function colorDeclarations($, source) {
  const out = [];
  $('style').each((_, style) => {
    if (style.attribs?.['data-accessfix'] !== undefined) return;
    const textNode = style.children?.[0];
    const loc = textNode?.sourceCodeLocation;
    if (!loc) return;
    const css = source.slice(loc.startOffset, loc.endOffset);
    for (const rule of css.matchAll(/([^{}@;]+)\{([^{}]*)\}/g)) {
      const selector = rule[1].trim();
      const blockStart = loc.startOffset + rule.index + rule[0].indexOf('{') + 1;
      const decl = /(^|[;\s])color\s*:\s*([^;!}]+?)\s*(!important)?\s*(?=;|$)/gi;
      for (const d of rule[2].matchAll(decl)) {
        const valueOffset = d.index + d[0].indexOf(d[2], d[1].length);
        out.push({
          selector,
          value: d[2],
          start: blockStart + valueOffset,
          end: blockStart + valueOffset + d[2].length,
          important: Boolean(d[3]),
        });
      }
    }
  });
  return out;
}

/** Parse a style attribute into ordered [prop, value] pairs. */
export function parseStyleAttr(style = '') {
  return style
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf(':');
      return [p.slice(0, i).trim().toLowerCase(), p.slice(i + 1).trim()];
    });
}

export function serializeStyle(pairs) {
  return pairs.map(([k, v]) => `${k}: ${v}`).join('; ');
}

/** Set one property in a style attribute string, keeping the others in place. */
export function setStyleProp(style, prop, value) {
  const pairs = parseStyleAttr(style);
  const i = pairs.findIndex(([k]) => k === prop);
  if (i >= 0) pairs[i] = [prop, value];
  else pairs.push([prop, value]);
  return serializeStyle(pairs);
}
