import { describe, expect, it } from 'vitest';
import * as names from '../../src/services/repair/rules/accessibleName.js';
import * as imageAlt from '../../src/services/repair/rules/imageAlt.js';
import * as linkContext from '../../src/services/repair/rules/linkContext.js';
import { run, violation } from './helpers.js';

const span = (t) => `<span class="afx-sr-only" data-accessfix>${t}</span>`;

describe('button-name / link-name repair', () => {
  it.each([
    ['title attribute', '<button title="Close dialog"><i></i></button>', 'button', 'Close dialog', 'high'],
    ['SVG <title>', '<button><svg><title>Search</title></svg></button>', 'button', 'Search', 'high'],
    ['icon class', '<button class="menu-toggle"><svg></svg></button>', 'button', 'Menu', 'medium'],
    ['sprite reference', '<button><svg><use href="#icon-cart"></use></svg></button>', 'button', 'Cart', 'medium'],
    ['link URL', '<a href="/about-us/"><i class="i"></i></a>', 'a', 'About us', 'medium'],
    ['social host', '<a href="https://github.com/org"><i></i></a>', 'a', 'GitHub', 'medium'],
  ])('derives the name from the %s', (_from, src, target, name, confidence) => {
    const ruleId = target === 'a' ? 'link-name' : 'button-name';
    const { p, after } = run(names, src, violation(ruleId, target));
    expect(after).toContain(span(name));
    expect(after).toContain('.afx-sr-only{position:absolute!important');
    expect(p.confidence).toBe(confidence);
  });

  it('uses visible text for submit inputs', () => {
    const { after } = run(names, '<input type="submit">', violation('input-button-name', 'input'));
    expect(after).toBe('<input type="submit" value="Submit">');
  });

  it('falls back to a TODO template and never invents a name', () => {
    const { p } = run(names, '<button><svg></svg></button>', violation('button-name', 'button'));
    expect(p).toMatchObject({ strategy: 'template', placeholder: 'TODO: name this button' });
  });
});

describe('image-alt repair', () => {
  it.each([
    ['tiny', '<img src="a.png" width="1" height="1">', /at most 2×2/],
    ['spacer file', '<img src="/img/spacer.gif">', /spacer/],
    ['inside a link with text', '<a href="/x"><img src="arrow.png"> Next</a>', /already has text/],
  ])('marks a %s image decorative with alt=""', (_k, src, why) => {
    const { p, after } = run(imageAlt, src, violation('image-alt', 'img'));
    expect(after).toContain('alt=""');
    expect(p.explanation).toMatch(why);
  });

  it('uses the title as alt text', () => {
    const { after } = run(imageAlt, '<img src="a.jpg" title="Our team">', violation('image-alt', 'img'));
    expect(after).toContain('alt="Our team"');
  });

  it('leaves a TODO for informative images instead of guessing', () => {
    const { p } = run(imageAlt, '<img src="loaf.jpg" width="400">', violation('image-alt', 'img'));
    expect(p).toMatchObject({ strategy: 'template', placeholder: 'TODO: describe this image' });
  });
});

describe('ambiguous link text repair', () => {
  it('adds hidden context from the nearest heading', () => {
    const src = '<h2>Sourdough</h2><p>Loaf. <a href="/s">Read more</a></p>';
    const { after } = run(linkContext, src, violation('afx-link-ambiguous', 'a'));
    expect(after).toContain(`<a href="/s">Read more${span(' about Sourdough')}</a>`);
  });

  it('asks for manual rewriting when there is no heading', () => {
    expect(run(linkContext, '<a href="/s">More</a>', violation('afx-link-ambiguous', 'a')).p.kind).toBe('manual');
  });
});
