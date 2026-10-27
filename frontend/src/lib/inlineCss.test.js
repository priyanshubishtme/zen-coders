import { describe, expect, it } from 'vitest';
import { inlineCss } from './inlineCss.js';

describe('inlineCss', () => {
  it('replaces a matching stylesheet link in place', () => {
    const html = '<html><head><link rel="stylesheet" href="./css/site.css?v=2"><title>t</title></head><body></body></html>';
    const out = inlineCss(html, [{ name: 'site.css', text: 'p{color:#777}' }]);
    expect(out.linked).toEqual(['site.css']);
    expect(out.appended).toEqual([]);
    expect(out.html).toContain('<style data-accessfix-file="site.css">\np{color:#777}\n</style><title>');
    expect(out.html).not.toContain('<link');
  });

  it('appends unreferenced files to the end of head', () => {
    const out = inlineCss('<html><head><title>t</title></head><body></body></html>', [
      { name: 'extra.css', text: 'h1{}' },
    ]);
    expect(out.appended).toEqual(['extra.css']);
    expect(out.html).toMatch(/h1\{\}\n<\/style>\n<\/head>/);
  });

  it('keeps links to files that were not uploaded', () => {
    const html = '<head><link rel="stylesheet" href="https://cdn.example/x.css"></head>';
    expect(inlineCss(html, []).html).toBe(html);
  });

  it('cannot close the style element early', () => {
    const out = inlineCss('<head></head>', [{ name: 'a.css', text: 'a{}</style><script>x</script>' }]);
    expect(out.html).not.toContain('</style><script>');
  });
});
