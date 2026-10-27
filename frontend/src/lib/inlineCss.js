const baseName = (href) => {
  const clean = href.split(/[?#]/)[0];
  return decodeURIComponent(clean.slice(clean.lastIndexOf('/') + 1)).toLowerCase();
};

const styleTag = (name, css) => `<style data-accessfix-file="${name.replace(/"/g, '')}">\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`;

/**
 * Put uploaded stylesheets inside the HTML so the scanner sees one document.
 * A `<link rel="stylesheet">` whose file name matches an upload is replaced in place,
 * so the cascade order stays the same. Uploads no link refers to go at the end of <head>.
 * @param {string} html
 * @param {{ name: string, text: string }[]} cssFiles
 * @returns {{ html: string, linked: string[], appended: string[] }}
 */
export function inlineCss(html, cssFiles) {
  const byName = new Map(cssFiles.map((f) => [f.name.toLowerCase(), f]));
  const used = new Set();
  const linked = [];
  let out = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) return tag;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) return tag;
    const file = byName.get(baseName(href));
    if (!file) return tag;
    used.add(file.name.toLowerCase());
    linked.push(file.name);
    return styleTag(file.name, file.text);
  });
  const rest = cssFiles.filter((f) => !used.has(f.name.toLowerCase()));
  const appended = rest.map((f) => f.name);
  if (rest.length) {
    const block = rest.map((f) => styleTag(f.name, f.text)).join('\n');
    if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${block}\n</head>`);
    else if (/<body\b/i.test(out)) out = out.replace(/<body\b/i, `${block}\n<body`);
    else out = `${block}\n${out}`;
  }
  return { html: out, linked, appended };
}
