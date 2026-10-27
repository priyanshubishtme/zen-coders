import { PLACEHOLDER, SR_ONLY_CSS, humanize, manual, patch } from '../context.js';
import { appendInside, escapeText, setAttr } from '../edits.js';

export const ruleIds = ['button-name', 'link-name', 'input-button-name'];

/** Icon words commonly used in class names and sprite ids -> spoken name. */
const ICONS = [
  [['cart', 'basket', 'bag', 'shopping'], 'Cart'],
  [['menu', 'hamburger', 'bars', 'burger', 'navicon'], 'Menu'],
  [['search', 'magnifier', 'magnifying'], 'Search'],
  [['close', 'times', 'dismiss', 'xmark'], 'Close'],
  [['user', 'account', 'profile', 'avatar'], 'Account'],
  [['home', 'house'], 'Home'],
  [['settings', 'gear', 'cog'], 'Settings'],
  [['bell', 'notification', 'notifications'], 'Notifications'],
  [['heart', 'like', 'favorite', 'favourite', 'wishlist'], 'Favourites'],
  [['share'], 'Share'],
  [['download'], 'Download'],
  [['upload'], 'Upload'],
  [['edit', 'pencil'], 'Edit'],
  [['delete', 'trash', 'bin'], 'Delete'],
  [['plus', 'add'], 'Add'],
  [['play'], 'Play'],
  [['pause'], 'Pause'],
  [['next', 'forward'], 'Next'],
  [['prev', 'previous', 'back'], 'Previous'],
  [['mail', 'email', 'envelope'], 'Email'],
  [['phone', 'call'], 'Call'],
  [['help', 'question'], 'Help'],
  [['info', 'information'], 'Information'],
  [['filter'], 'Filter'],
  [['sort'], 'Sort'],
  [['calendar'], 'Calendar'],
  [['login', 'signin'], 'Sign in'],
  [['logout', 'signout'], 'Sign out'],
  [['print'], 'Print'],
  [['refresh', 'reload'], 'Refresh'],
  [['more', 'ellipsis', 'kebab', 'dots'], 'More options'],
  [['facebook'], 'Facebook'],
  [['instagram'], 'Instagram'],
  [['linkedin'], 'LinkedIn'],
  [['github'], 'GitHub'],
  [['youtube'], 'YouTube'],
  [['twitter'], 'Twitter'],
];
const ICON_WORDS = new Map(ICONS.flatMap(([words, name]) => words.map((w) => [w, name])));
const SOCIAL_HOSTS = {
  'facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'linkedin.com': 'LinkedIn',
  'github.com': 'GitHub',
  'youtube.com': 'YouTube',
  'twitter.com': 'Twitter',
  'x.com': 'X',
};

/** Name from an icon word in class names, sprite references or data-icon. */
function iconName(ctx, el) {
  const nodes = [el, ...ctx.$(el).find('*').toArray()];
  for (const n of nodes) {
    const sources = [n.attribs?.class, n.attribs?.['data-icon'], n.attribs?.href, n.attribs?.['xlink:href']];
    for (const s of sources) {
      for (const word of String(s ?? '').toLowerCase().split(/[^a-z]+/)) {
        if (ICON_WORDS.has(word)) return ICON_WORDS.get(word);
      }
    }
  }
  return null;
}

/** "/cart" -> "Cart", "/about-us/" -> "About us"; social hosts by name. */
function hrefName(href) {
  if (!href || href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) return null;
  try {
    const u = new URL(href, 'http://local.invalid');
    if (u.hostname !== 'local.invalid') {
      const host = u.hostname.replace(/^www\./, '');
      if (SOCIAL_HOSTS[host]) return SOCIAL_HOSTS[host];
    }
    const last = u.pathname.split('/').filter(Boolean).pop() ?? '';
    const word = last.replace(/\.(html?|php|aspx?)$/i, '');
    if (!word || /^\d+$/.test(word) || /^index$/i.test(word)) return null;
    return humanize(word);
  } catch {
    return null;
  }
}

/** Highest-confidence name first: title, SVG <title>, then icon words and URL. */
function deriveName(ctx, el) {
  const title = el.attribs.title?.trim();
  if (title) return { name: title, confidence: 'high', from: 'its title attribute' };
  const svgTitle = ctx.$(el).find('svg title').first().text().trim();
  if (svgTitle) return { name: svgTitle, confidence: 'high', from: 'the icon\'s <title>' };
  const icon = iconName(ctx, el);
  if (icon) return { name: icon, confidence: 'medium', from: 'the icon it shows' };
  if (el.tagName === 'a') {
    const fromHref = hrefName(el.attribs.href);
    if (fromHref) return { name: fromHref, confidence: 'medium', from: 'where it links to' };
  }
  return null;
}

/** Adds visible-to-screen-readers text inside the element (native content, not aria-label). */
export function propose(v, ctx) {
  const { el, reason } = ctx.locate(v.node.target);
  if (!el) return manual(reason);
  if (!el.sourceCodeLocation) return manual('The element has no tag of its own in the source.');

  if (el.tagName === 'input') {
    const type = (el.attribs.type ?? '').toLowerCase();
    const value = { submit: 'Submit', reset: 'Reset' }[type];
    if (value) {
      return patch({
        strategy: 'deterministic',
        confidence: 'medium',
        mark: el,
        edits: [setAttr(ctx.source, el, 'value', value)],
        explanation: `Gives the ${type} button the visible text "${value}".`,
        notes: ['A more specific word, like "Subscribe", is better.'],
      });
    }
    const text = `${PLACEHOLDER} name this button`;
    return patch({
      strategy: 'template',
      confidence: 'low',
      mark: el,
      edits: [setAttr(ctx.source, el, 'value', text)],
      explanation: 'Adds visible text to the button. Write what it does.',
      placeholder: text,
    });
  }

  if (!el.sourceCodeLocation.endTag) return manual('The element has no closing tag to put text inside.');
  const kind = el.tagName === 'a' ? 'link' : 'button';
  const derived = deriveName(ctx, el);
  const name = derived?.name ?? `${PLACEHOLDER} name this ${kind}`;
  return patch({
    strategy: derived ? 'deterministic' : 'template',
    confidence: derived?.confidence ?? 'low',
    mark: el,
    edits: [appendInside(el, `<span class="afx-sr-only" data-accessfix>${escapeText(name)}</span>`)],
    css: [SR_ONLY_CSS],
    explanation: derived
      ? `Adds the hidden text "${name}" inside the ${kind}, taken from ${derived.from}. Screen readers announce it; the look does not change.`
      : `Adds hidden text inside the ${kind}. Write what it does or where it goes.`,
    notes: derived?.confidence === 'medium' ? ['Check that this name is right.'] : [],
    placeholder: derived ? null : name,
  });
}
