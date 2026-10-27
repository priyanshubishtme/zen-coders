/**
 * Helpers that run INSIDE the scanned page. Must stay self-contained (no
 * imports, no closures over module scope) because it is serialized with
 * Function.prototype.toString and evaluated in the browser.
 */
export function afxHelpers() {
  const KEY = '__accessfixIds';
  const state = window[KEY] || (window[KEY] = { ids: new WeakMap(), next: 1 });

  /** Stable per-page element id, used to merge our findings with axe's. */
  const idOf = (el) => {
    if (!state.ids.has(el)) state.ids.set(el, state.next++);
    return state.ids.get(el);
  };

  const cssPathInRoot = (el) => {
    const root = el.getRootNode();
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1) {
      if (parts.length && (node.localName === 'body' || node.localName === 'html')) break;
      if (node.id && root.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      let sel = node.localName;
      const parent = node.parentElement;
      if (parent) {
        const same = [...parent.children].filter((c) => c.localName === node.localName);
        if (same.length > 1) sel += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(sel);
      node = parent;
    }
    return parts.join(' > ');
  };

  /** axe-compatible target: ["sel"], or [["host", "inner"]] across shadow roots. */
  const target = (el) => {
    const chain = [];
    let node = el;
    while (node) {
      chain.unshift(cssPathInRoot(node));
      const root = node.getRootNode();
      node = root instanceof ShadowRoot ? root.host : null;
    }
    return chain.length === 1 ? [chain[0]] : [chain];
  };

  const snippet = (el) => {
    const html = el.outerHTML;
    return html.length > 300 ? `${html.slice(0, 300)}…` : html;
  };

  const isHidden = (el) => {
    if (el.closest('[aria-hidden="true"]')) return true;
    if (typeof el.checkVisibility === 'function') {
      return !el.checkVisibility({ visibilityProperty: true });
    }
    return false;
  };

  const textOf = (node) => {
    let s = '';
    for (const c of node.childNodes) {
      if (c.nodeType === 3) s += c.textContent;
      else if (c.nodeType === 1) {
        if (c.getAttribute('aria-hidden') === 'true') continue;
        if (c.localName === 'img') s += ` ${c.getAttribute('alt') ?? ''} `;
        else if (c.getAttribute('aria-label')) s += ` ${c.getAttribute('aria-label')} `;
        else s += ` ${textOf(c.shadowRoot ?? c)} `;
      }
    }
    return s.replace(/\s+/g, ' ');
  };

  /** Simplified accessible name: aria-labelledby, aria-label, then content. */
  const accName = (el) => {
    const ids = el.getAttribute('aria-labelledby');
    if (ids) {
      const root = el.getRootNode();
      const text = ids
        .split(/\s+/)
        .map((id) => (root.getElementById?.(id) ?? document.getElementById(id))?.textContent ?? '')
        .join(' ')
        .trim();
      if (text) return text;
    }
    const label = el.getAttribute('aria-label');
    if (label?.trim()) return label.trim();
    return textOf(el).trim();
  };

  /** Elements in composed-tree order, descending into shadow roots and slots. */
  function* composed(node) {
    let kids;
    if (node.shadowRoot) kids = node.shadowRoot.children;
    else if (node.localName === 'slot') {
      const assigned = node.assignedElements({ flatten: true });
      kids = assigned.length ? assigned : node.children;
    } else kids = node.children;
    for (const k of kids) {
      yield k;
      yield* composed(k);
    }
  }

  return { idOf, target, snippet, isHidden, accName, composed };
}

/**
 * Map axe targets to [our element id, verification marker]. Top-level array
 * entries are iframe hops (we return nulls for those); a nested array is a
 * shadow-DOM path. The marker is the data-afx-v attribute the verifier adds.
 */
export function resolveTargets(h, targets) {
  return targets.map((t) => {
    try {
      if (t.length !== 1) return [null, null];
      const path = Array.isArray(t[0]) ? t[0] : [t[0]];
      let root = document;
      let el = null;
      for (const sel of path) {
        el = root.querySelector(sel);
        if (!el) return [null, null];
        root = el.shadowRoot ?? el;
      }
      return el ? [h.idOf(el), el.getAttribute('data-afx-v')] : [null, null];
    } catch {
      return [null, null];
    }
  });
}
