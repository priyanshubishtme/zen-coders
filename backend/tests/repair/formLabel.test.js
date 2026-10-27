import { describe, expect, it } from 'vitest';
import * as fixer from '../../src/services/repair/rules/formLabel.js';
import { run, violation } from './helpers.js';

describe('label repair (native labels only)', () => {
  it('wraps bare text right before the field in a <label for>', () => {
    const src = '<form>Email <input type="email" id="e"></form>';
    const { p, after } = run(fixer, src, violation('label', '#e'));
    expect(after).toBe('<form><label for="e" data-accessfix>Email</label> <input type="email" id="e"></form>');
    expect(p.confidence).toBe('high');
  });

  it('turns an adjacent <span> into the label without changing the element', () => {
    const src = '<form><span>Name</span> <input name="n"></form>';
    const { after } = run(fixer, src, violation('label', 'input'));
    expect(after).toBe('<form><span><label for="n" data-accessfix>Name</label></span> <input name="n" id="n"></form>');
  });

  it('creates a visible label from the placeholder', () => {
    const src = '<form><input id="q" placeholder="Search recipes"></form>';
    const { p, after } = run(fixer, src, violation('label', '#q'));
    expect(after).toContain('<label for="q" data-accessfix>Search recipes</label> <input id="q"');
    expect(p.notes[0]).toMatch(/layout may shift/);
  });

  it('creates a visible label from the name and a unique id', () => {
    const src = '<div id="first-name"></div><form><input name="first_name"></form>';
    const { after } = run(fixer, src, violation('label', 'input'));
    expect(after).toContain('<label for="first-name-2" data-accessfix>First name</label>');
    expect(after).toContain('<input name="first_name" id="first-name-2">');
  });

  it('never uses aria-label', () => {
    const { after } = run(fixer, '<form><input name="city"></form>', violation('label', 'input'));
    expect(after).not.toContain('aria-label');
  });

  it('falls back to a TODO template when nothing names the field', () => {
    const { p } = run(fixer, '<form><input></form>', violation('label', 'input'));
    expect(p).toMatchObject({ strategy: 'template', placeholder: 'TODO: label this field' });
  });

  it('sends custom controls to manual review', () => {
    const { p } = run(fixer, '<div role="textbox" class="t"></div>', violation('label', '.t'));
    expect(p.kind).toBe('manual');
  });
});
