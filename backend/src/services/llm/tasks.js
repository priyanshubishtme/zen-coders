import { sha256, shortHash } from '../../utils/hash.js';
import {
  CONTEXT_CHARS,
  LLM_ASSISTED,
  MAX_VISION_BYTES,
  PROMPT_VERSION,
  SNIPPET_CHARS,
} from './safety.js';

const ATTR_KEEP = new Set([
  'id',
  'class',
  'name',
  'type',
  'alt',
  'title',
  'placeholder',
  'role',
  'href',
  'src',
  'for',
]);

function redactSnippet(html) {
  let s = String(html ?? '');
  s = s.replace(/\b(value|data-password|autocomplete)=("[^"]*"|'[^']*')/gi, '$1="…"');
  if (s.length > SNIPPET_CHARS) s = `${s.slice(0, SNIPPET_CHARS - 1)}…`;
  return s;
}

function nearbyText(ctx, el) {
  const bits = [];
  const cap = ctx.$(el).closest('figure').find('figcaption').first().text();
  if (cap) bits.push(cap);
  const heading = ctx.$(el).closest('section,article,main,body').find('h1,h2,h3').first().text();
  if (heading) bits.push(heading);
  const prev = ctx.$(el).prev().text();
  if (prev) bits.push(prev);
  const next = ctx.$(el).next().text();
  if (next) bits.push(next);
  for (const name of ['title', 'placeholder', 'aria-label', 'alt']) {
    const v = el.attribs?.[name];
    if (v) bits.push(v);
  }
  const out = bits
    .map((t) => String(t).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' · ');
  return out.slice(0, CONTEXT_CHARS);
}

function attrHints(el) {
  if (!el?.attribs) return '';
  return Object.entries(el.attribs)
    .filter(([k]) => ATTR_KEEP.has(k) || k.startsWith('aria-'))
    .map(([k, v]) => `${k}=${String(v).slice(0, 80)}`)
    .join(' ');
}

function resolveSrc(src, mainUrl) {
  if (!src || src.startsWith('data:')) return null;
  try {
    return new URL(src, mainUrl || 'http://accessfix.invalid/').href;
  } catch {
    return null;
  }
}

/**
 * A vision payload from a captured scan resource. The bytes never leave this
 * object except into the vision model request; callers must not log it.
 */
export function capturedImage(el, cached) {
  const src = el?.attribs?.src;
  if (!src) return null;
  if (src.startsWith('data:')) return null;
  const url = resolveSrc(src, cached?.mainUrl);
  const hit = url && cached?.resources instanceof Map ? cached.resources.get(url) : null;
  if (!hit?.body || !Buffer.isBuffer(hit.body)) return null;
  const mime = String(hit.headers?.['content-type'] ?? hit.contentType ?? 'application/octet-stream')
    .split(';')[0]
    .toLowerCase();
  if (!/^image\/(jpeg|jpg|png|gif|webp)$/.test(mime)) return null;
  if (hit.body.length > MAX_VISION_BYTES) return null;
  return { mime, base64: hit.body.toString('base64'), hash: sha256(hit.body) };
}

/**
 * One LLM task per unique (rule, signature, context). Image bytes stay on the
 * task only until the call; they are never cached or returned.
 */
export function buildLlmTasks(repairs, { ctx, cached, model }) {
  const tasks = [];
  const byKey = new Map();
  for (const r of repairs) {
    if (!LLM_ASSISTED.has(r.ruleId) || r.strategy !== 'template') continue;
    const v = ctx.findings.find((f) => f.id === r.violationId);
    const located = ctx.locate(v?.node.target ?? r.patch?.target ?? []);
    const el = located.el;
    const snippet = redactSnippet(v?.node.html ?? r.patch?.before ?? '');
    const context = el ? nearbyText(ctx, el) : '';
    const hints = el ? attrHints(el) : '';
    const vision = r.ruleId.includes('image') ? capturedImage(el, cached) : null;
    const key = sha256(
      [PROMPT_VERSION, model, r.ruleId, v?.signature ?? r.ruleId, shortHash(context + hints), vision?.hash ?? ''].join(
        '|',
      ),
    );
    const existing = byKey.get(key);
    if (existing) {
      existing.repairIds.push(r.id);
      continue;
    }
    const task = {
      key,
      ruleId: r.ruleId,
      signature: v?.signature ?? r.ruleId,
      snippet,
      context: [context, hints].filter(Boolean).join(' · ').slice(0, CONTEXT_CHARS),
      tier: vision ? 'vision' : 'text',
      image: vision,
      repairIds: [r.id],
    };
    byKey.set(key, task);
    tasks.push(task);
  }
  return tasks;
}
