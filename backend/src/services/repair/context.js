import * as cheerio from 'cheerio';

export const PLACEHOLDER = 'TODO:';

/** Visually hidden but announced. `!important` so page CSS cannot undo it. */
export const SR_ONLY_CSS = {
  key: 'afx-sr-only',
  css: '.afx-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}',
};

/**
 * Per-scan repair context: the source, a location-aware DOM of it, and the
 * scan's own findings (needed by fixers that look at more than one element).
 */
export function createContext({ source, scan }) {
  const $ = cheerio.load(source, { sourceCodeLocationInfo: true });
  const usedIds = new Set($('[id]').map((_, el) => $(el).attr('id')).get());
  return {
    source,
    $,
    scan,
    /** All flagged items, any bucket. */
    findings: [...(scan.violations ?? []), ...(scan.advisory ?? [])],

    /**
     * Find the one source element behind an axe target.
     * @returns {{ el: any | null, reason?: string }}
     */
    locate(target) {
      if (target.length !== 1 || target[0].includes(' >>> ')) {
        return { el: null, reason: 'It is inside an iframe or shadow DOM, which we cannot patch yet.' };
      }
      let matches;
      try {
        matches = $(target[0]);
      } catch {
        return { el: null, reason: 'Its selector could not be matched in the source.' };
      }
      if (matches.length === 0) {
        return {
          el: null,
          reason: 'It is not in the source HTML. It is probably created by JavaScript, so fix it in the code that renders it.',
        };
      }
      if (matches.length > 1) {
        return { el: null, reason: 'Its selector matches more than one element in the source.' };
      }
      const el = matches[0];
      if (!el.sourceCodeLocation) return { el, implicit: true };
      return { el };
    },

    text: (el) => $(el).text().replace(/\s+/g, ' ').trim(),

    /** An id not used anywhere in the source or by earlier fixes in this run. */
    uniqueId(base) {
      const slug =
        String(base || 'field')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'field';
      let id = slug;
      for (let n = 2; usedIds.has(id); n += 1) id = `${slug}-${n}`;
      usedIds.add(id);
      return id;
    },
  };
}

/** "first_name" -> "First name", "emailAddress" -> "Email address". */
export function humanize(s) {
  const words = String(s ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-.[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : '';
}

/** A fixer's verdict when no safe automated patch exists. */
export const manual = (reason, howToCheck = []) => ({ kind: 'manual', reason, howToCheck });

/**
 * @typedef {object} Proposal
 * @property {'patch'} kind
 * @property {'deterministic' | 'template'} strategy
 * @property {'high' | 'medium' | 'low'} confidence
 * @property {import('./edits.js').Edit[]} edits
 * @property {{ key: string, css: string }[]} [css]
 * @property {any} [mark]          element the verifier tags to attribute results
 * @property {string} explanation
 * @property {string[]} [notes]
 */
export const patch = (p) => ({ kind: 'patch', css: [], notes: [], ...p });
