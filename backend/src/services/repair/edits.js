import { createTwoFilesPatch, structuredPatch } from 'diff';

/**
 * Patches are lists of text edits on the ORIGINAL source string, located with
 * parse5 source offsets. Everything outside an edit stays byte-identical, so
 * diffs are minimal and every change is reversible.
 * @typedef {{ start: number, end: number, text: string }} Edit
 */

export class EditConflictError extends Error {}

export const insertAt = (pos, text) => ({ start: pos, end: pos, text });
export const replaceRange = (start, end, text) => ({ start, end, text });

export const escapeAttr = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
export const escapeText = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** Apply edits; identical edits are merged, overlapping ones throw EditConflictError. */
export function applyEdits(source, edits) {
  const seen = new Set();
  const unique = edits.filter((e) => {
    const key = `${e.start}:${e.end}:${e.text}`;
    return !seen.has(key) && seen.add(key);
  });
  const sorted = unique
    .map((e, i) => ({ ...e, i }))
    .sort((a, b) => a.start - b.start || a.end - a.start - (b.end - b.start) || a.i - b.i);
  let out = '';
  let cursor = 0;
  for (const e of sorted) {
    if (e.start < cursor) throw new EditConflictError(`Edits overlap at offset ${e.start}.`);
    out += source.slice(cursor, e.start) + e.text;
    cursor = e.end;
  }
  return out + source.slice(cursor);
}

/** True when the edit sets can be applied together. */
export function compatible(source, a, b) {
  try {
    applyEdits(source, [...a, ...b]);
    return true;
  } catch {
    return false;
  }
}

/** Copy-pasteable unified diff of the whole file, 2 lines of context. */
export function unifiedDiff(before, after, file = 'index.html') {
  return createTwoFilesPatch(file, file, before, after, 'before', 'after', { context: 2 });
}

/** Only the changed lines, before and after (no context), for side-by-side display. */
export function changedLines(before, after) {
  const { hunks } = structuredPatch('a', 'b', before, after, '', '', { context: 0 });
  const pick = (prefix) =>
    hunks
      .flatMap((h) => h.lines.filter((l) => l[0] === prefix || l[0] === ' ').map((l) => l.slice(1)))
      .join('\n');
  return { before: pick('-'), after: pick('+') };
}

// ---------- element-level helpers (cheerio elements with sourceCodeLocation) ----------

const loc = (el) => el.sourceCodeLocation;

/** Offset where a new attribute goes: before ">" or "/>", after trailing whitespace is skipped. */
export function attrInsertPoint(source, el) {
  let p = loc(el).startTag.endOffset - 1;
  if (source[p - 1] === '/') p -= 1;
  while (/\s/.test(source[p - 1])) p -= 1;
  return p;
}

/** Set (or add) an attribute, rewriting only that attribute. */
export function setAttr(source, el, name, value) {
  const text = `${name}="${escapeAttr(value)}"`;
  const existing = loc(el).startTag.attrs?.[name];
  if (existing) return replaceRange(existing.startOffset, existing.endOffset, text);
  return insertAt(attrInsertPoint(source, el), ` ${text}`);
}

/** Remove an attribute including the whitespace before it. */
export function removeAttr(source, el, name) {
  const a = loc(el).startTag.attrs?.[name];
  if (!a) return null;
  let start = a.startOffset;
  while (start > 0 && /\s/.test(source[start - 1])) start -= 1;
  return replaceRange(start, a.endOffset, '');
}

/** Rename an element's tag in both its start and end tags. */
export function renameTag(el, newName) {
  const old = el.tagName.length;
  const { startTag, endTag } = loc(el);
  const edits = [replaceRange(startTag.startOffset + 1, startTag.startOffset + 1 + old, newName)];
  if (endTag) edits.push(replaceRange(endTag.startOffset + 2, endTag.startOffset + 2 + old, newName));
  return edits;
}

export const insertBefore = (el, html) => insertAt(loc(el).startOffset, html);
export const insertAfter = (el, html) => insertAt(loc(el).endOffset, html);
export const prependInside = (el, html) => insertAt(loc(el).startTag.endOffset, html);
export const appendInside = (el, html) =>
  loc(el).endTag ? insertAt(loc(el).endTag.startOffset, html) : null;

/**
 * Where head-only content (<title>, <style>) can go, even when the source
 * omits <head> or <html>: the parser hoists it into the head either way.
 */
export function headInsertPoint($, source) {
  const head = $('head')[0];
  if (head?.sourceCodeLocation) {
    const l = head.sourceCodeLocation;
    return l.endTag ? l.endTag.startOffset : l.startTag.endOffset;
  }
  const html = $('html')[0];
  if (html?.sourceCodeLocation) return html.sourceCodeLocation.startTag.endOffset;
  const doctype = /^\s*<!doctype[^>]*>/i.exec(source);
  return doctype ? doctype[0].length : 0;
}

/**
 * Insert a block of lines at `pos`. When only indentation precedes `pos` on its
 * line, the block goes on its own lines before it, so the diff stays clean.
 */
export function insertBlock(source, pos, html) {
  let p = pos;
  while (p > 0 && (source[p - 1] === ' ' || source[p - 1] === '\t')) p -= 1;
  if (p === 0 || source[p - 1] === '\n') return insertAt(p, `${html}\n`);
  return insertAt(pos, `\n${html}\n`);
}

/** One <style data-accessfix> block with the union of helper rules repairs need. */
export function cssBlockEdit($, source, rules) {
  const unique = [...new Map(rules.map((r) => [r.key, r.css])).values()];
  if (!unique.length) return [];
  const block = `<style data-accessfix>\n${unique.join('\n')}\n</style>`;
  return [insertBlock(source, headInsertPoint($, source), block)];
}
