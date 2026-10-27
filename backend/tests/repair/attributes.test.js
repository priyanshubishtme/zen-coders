import { describe, expect, it } from 'vitest';
import * as dup from '../../src/services/repair/rules/duplicateId.js';
import * as simple from '../../src/services/repair/rules/simpleAttributes.js';
import { run, violation } from './helpers.js';

describe('duplicate-id repair', () => {
  it('renames the later duplicate and updates references in the same component', () => {
    const src =
      '<form><label for="email">A</label><input id="email"></form>' +
      '<form><label for="email">B</label><input id="email" class="second"></form>';
    const { p, after } = run(dup, src, violation('duplicate-id-aria', '.second'));
    expect(after).toBe(
      '<form><label for="email">A</label><input id="email"></form>' +
        '<form><label for="email-2">B</label><input id="email-2" class="second"></form>',
    );
    expect(p.confidence).toBe('medium'); // the first form's label still points to "email"
  });

  it('keeps the first element and asks to fix the copies', () => {
    const src = '<p id="x" class="a"></p><p id="x"></p>';
    expect(run(dup, src, violation('duplicate-id-aria', '.a')).p.kind).toBe('manual');
  });

  it('refuses to rename ids that inline scripts use', () => {
    const src = '<p id="x"></p><p id="x" class="b"></p><script>document.getElementById("x")</script>';
    expect(run(dup, src, violation('duplicate-id-aria', '.b')).p.reason).toMatch(/JavaScript/);
  });
});

describe('simple attribute repairs', () => {
  it('re-enables zoom in the viewport meta tag', () => {
    const src = '<meta name="viewport" content="width=device-width, user-scalable=no, maximum-scale=1">';
    const { after } = run(simple, src, violation('meta-viewport', 'meta'));
    expect(after).toBe('<meta name="viewport" content="width=device-width, maximum-scale=5">');
  });

  it('resets a positive tabindex to 0', () => {
    const { after } = run(simple, '<a href="/" tabindex="3">x</a>', violation('tabindex', 'a'));
    expect(after).toBe('<a href="/" tabindex="0">x</a>');
  });
});
