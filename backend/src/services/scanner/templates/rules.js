/**
 * Plain-language text per rule. No LLM. `title` says what is wrong,
 * `explanation` why it matters, `who` who is blocked. Keep each under ~200
 * characters and free of jargon; it is shown verbatim in the UI.
 */
const SR = 'Blind and low-vision people using screen readers';
const LV = 'People with low vision or colour blindness';
const KB = 'People who use a keyboard or switch device instead of a mouse';
const VC = 'Screen reader and voice-control users';
const COG = 'People with cognitive or learning disabilities';

export const RULE_TEMPLATES = {
  // --- WebAIM top six ---
  'color-contrast': {
    title: 'Text has low contrast against its background',
    explanation:
      'Faint text is hard or impossible to read. Normal text needs a contrast ratio of at least 4.5:1, large text 3:1.',
    who: `${LV}, and anyone reading on a phone in sunlight`,
  },
  'image-alt': {
    title: 'Image has no text alternative',
    explanation:
      'Without an alt attribute, screen readers announce the file name or nothing. Describe the image, or use alt="" if it is decorative.',
    who: SR,
  },
  label: {
    title: 'Form field has no label',
    explanation:
      'Without a label, people cannot tell what to type here. Placeholder text is not a label: it disappears and is often low contrast.',
    who: `${VC}, and ${COG.toLowerCase()}`,
  },
  'link-name': {
    title: 'Link has no name',
    explanation:
      'This link has no text a screen reader can announce, so it is read as just "link". Icon-only links need an accessible name.',
    who: VC,
  },
  'button-name': {
    title: 'Button has no name',
    explanation:
      'This button has no text a screen reader can announce, so people hear only "button" and cannot tell what it does.',
    who: VC,
  },
  'html-has-lang': {
    title: 'Page language is not set',
    explanation:
      'Without lang on <html>, screen readers guess the language and may pronounce every word wrongly. Translation tools also struggle.',
    who: SR,
  },

  // --- Names, roles, values ---
  'html-lang-valid': {
    title: 'Page language code is not valid',
    explanation:
      'The lang value is not a recognised language code (for example "en" or "en-GB"), so assistive technology ignores it.',
    who: SR,
  },
  'valid-lang': {
    title: 'Language code on part of the page is not valid',
    explanation:
      'A lang attribute inside the page uses an unknown code, so that passage may be pronounced in the wrong language.',
    who: SR,
  },
  'html-xml-lang-mismatch': {
    title: 'lang and xml:lang disagree',
    explanation:
      'The two language attributes on <html> name different languages, so tools may pick the wrong one.',
    who: SR,
  },
  'document-title': {
    title: 'Page has no title',
    explanation:
      'The <title> is the first thing announced and the text shown in tabs and bookmarks. Without it, people cannot tell pages apart.',
    who: `${SR}, and anyone with many tabs open`,
  },
  'input-button-name': {
    title: 'Input button has no text',
    explanation:
      'This submit, reset or button input has no value, so it is announced without saying what it does.',
    who: VC,
  },
  'input-image-alt': {
    title: 'Image button has no text alternative',
    explanation:
      'An <input type="image"> needs alt text that says what the button does, such as "Search".',
    who: VC,
  },
  'select-name': {
    title: 'Dropdown has no label',
    explanation: 'Without a label, people cannot tell what this dropdown is for.',
    who: VC,
  },
  'frame-title': {
    title: 'Embedded frame has no title',
    explanation:
      'Screen readers announce frames by their title. Without one, people cannot tell what the embedded content is.',
    who: SR,
  },
  'object-alt': {
    title: 'Embedded object has no text alternative',
    explanation: 'The <object> has no accessible description of what it shows.',
    who: SR,
  },
  'svg-img-alt': {
    title: 'SVG image has no text alternative',
    explanation: 'An SVG with role="img" needs a <title> or aria-label describing it.',
    who: SR,
  },
  'role-img-alt': {
    title: 'Element shown as an image has no text alternative',
    explanation: 'Elements with role="img" need an accessible name describing the image.',
    who: SR,
  },
  'area-alt': {
    title: 'Image map area has no text alternative',
    explanation: 'Each clickable area of an image map needs alt text saying where it goes.',
    who: VC,
  },
  'aria-command-name': {
    title: 'Interactive element has no name',
    explanation: 'An element acting as a button, link or menu item has no accessible name.',
    who: VC,
  },
  'aria-input-field-name': {
    title: 'Custom input has no name',
    explanation: 'A custom text field, combobox or similar control has no accessible name.',
    who: VC,
  },
  'aria-toggle-field-name': {
    title: 'Custom toggle has no name',
    explanation:
      'A custom checkbox, switch or radio has no accessible name, so people cannot tell what they are turning on or off.',
    who: VC,
  },
  'aria-dialog-name': {
    title: 'Dialog has no name',
    explanation: 'When this dialog opens, screen readers cannot announce what it is about.',
    who: SR,
  },
  'aria-progressbar-name': {
    title: 'Progress bar has no name',
    explanation: 'People cannot tell what this progress bar is measuring.',
    who: SR,
  },
  'aria-meter-name': {
    title: 'Meter has no name',
    explanation: 'People cannot tell what this meter is measuring.',
    who: SR,
  },
  'aria-tooltip-name': {
    title: 'Tooltip has no text',
    explanation: 'This tooltip has no accessible text to announce.',
    who: SR,
  },
  'aria-treeitem-name': {
    title: 'Tree item has no name',
    explanation: 'An item in this tree view has no accessible name.',
    who: SR,
  },
  'summary-name': {
    title: 'Expandable section has no name',
    explanation: 'This <summary> has no text, so people cannot tell what expanding it will show.',
    who: VC,
  },

  // --- ARIA correctness ---
  'aria-allowed-attr': {
    title: 'ARIA attribute is not allowed here',
    explanation:
      'This element uses an ARIA attribute that does not apply to its role, so assistive technology may ignore or misreport it.',
    who: SR,
  },
  'aria-prohibited-attr': {
    title: 'ARIA attribute is prohibited on this element',
    explanation:
      'This role does not support the attribute used, so the information is lost or announced incorrectly.',
    who: SR,
  },
  'aria-required-attr': {
    title: 'Required ARIA attribute is missing',
    explanation:
      'This role needs certain attributes (for example aria-checked on a checkbox) to report its state.',
    who: SR,
  },
  'aria-required-children': {
    title: 'ARIA widget is missing required parts',
    explanation:
      'This role must contain specific child roles (for example a list must contain list items), so its structure is broken.',
    who: SR,
  },
  'aria-required-parent': {
    title: 'ARIA element is outside its required container',
    explanation:
      'This role only makes sense inside a specific parent (for example a tab inside a tablist).',
    who: SR,
  },
  'aria-roles': {
    title: 'ARIA role is not valid',
    explanation:
      'The role value is misspelled or does not exist, so assistive technology ignores it.',
    who: SR,
  },
  'aria-valid-attr': {
    title: 'ARIA attribute name is not valid',
    explanation:
      'This aria-* attribute is misspelled or does not exist (for example aria-labeledby), so it has no effect.',
    who: SR,
  },
  'aria-valid-attr-value': {
    title: 'ARIA attribute has an invalid value',
    explanation:
      'The value is not allowed for this attribute, or it points at an id that does not exist.',
    who: SR,
  },
  'aria-hidden-body': {
    title: 'Whole page is hidden from assistive technology',
    explanation: 'aria-hidden="true" on <body> hides the entire page from screen readers.',
    who: SR,
  },
  'aria-hidden-focus': {
    title: 'Hidden content can still receive focus',
    explanation:
      'Keyboard focus can land on something screen readers have been told to ignore, so people hear nothing.',
    who: `${SR}, and keyboard users`,
  },
  'aria-text': {
    title: 'role="text" contains focusable content',
    explanation:
      'Elements inside role="text" lose their meaning, so focusable children are announced without a role.',
    who: SR,
  },
  'aria-braille-equivalent': {
    title: 'Braille label has no spoken equivalent',
    explanation: 'aria-braillelabel is used without a matching accessible name.',
    who: 'Braille display users',
  },
  'aria-conditional-attr': {
    title: 'ARIA attribute is used in an invalid situation',
    explanation:
      'This attribute is only valid in certain conditions on this role, which are not met here.',
    who: SR,
  },
  'aria-deprecated-role': {
    title: 'ARIA role is deprecated',
    explanation: 'This role is deprecated and may not be supported by assistive technology.',
    who: SR,
  },
  'duplicate-id-aria': {
    title: 'An id used by ARIA is not unique',
    explanation:
      'Labels and descriptions point at an id that appears more than once, so the wrong text may be announced.',
    who: SR,
  },
  'nested-interactive': {
    title: 'Interactive element is nested inside another',
    explanation:
      'A control inside another control (for example a button inside a link) is not announced or reachable reliably.',
    who: `${SR}, and keyboard users`,
  },
  'presentation-role-conflict': {
    title: 'Element marked as decorative is still interactive',
    explanation:
      'role="none" or "presentation" is ignored because the element is focusable or has global ARIA attributes.',
    who: SR,
  },

  // --- Structure and semantics ---
  list: {
    title: 'List contains items that are not list items',
    explanation:
      'A <ul> or <ol> should only contain <li> elements, otherwise screen readers miscount or skip items.',
    who: SR,
  },
  listitem: {
    title: 'List item is outside a list',
    explanation: 'An <li> must be inside <ul>, <ol> or <menu> to be announced as part of a list.',
    who: SR,
  },
  'definition-list': {
    title: 'Definition list has invalid content',
    explanation: 'A <dl> should only contain <dt>/<dd> groups.',
    who: SR,
  },
  dlitem: {
    title: 'Definition term or description is outside a list',
    explanation: '<dt> and <dd> must be inside a <dl>.',
    who: SR,
  },
  'td-headers-attr': {
    title: 'Table cell points to headers that do not exist',
    explanation:
      'The headers attribute references cells outside this table, so cells are announced without context.',
    who: SR,
  },
  'th-has-data-cells': {
    title: 'Table header describes no cells',
    explanation:
      'This header cell has no data cells, so the table structure is confusing when read aloud.',
    who: SR,
  },
  'td-has-header': {
    title: 'Large table cell has no header',
    explanation: 'In a large table, each data cell needs a header so its meaning is announced.',
    who: SR,
  },
  'table-fake-caption': {
    title: 'Table caption is faked with a cell',
    explanation: 'Use <caption> instead of a spanning cell so the table title is announced.',
    who: SR,
  },
  bypass: {
    title: 'No way to skip repeated content',
    explanation:
      'There is no skip link, heading or landmark, so keyboard users must tab through every menu item on every page.',
    who: `${KB}, and screen reader users`,
  },
  'link-in-text-block': {
    title: 'Link is distinguished by colour alone',
    explanation:
      'This link looks like surrounding text except for its colour. Underline it or add another visual cue.',
    who: LV,
  },
  'meta-viewport': {
    title: 'Zooming is disabled',
    explanation:
      'The viewport meta tag blocks pinch-zoom, so people cannot enlarge text on phones.',
    who: `${LV}`,
  },
  'meta-refresh': {
    title: 'Page refreshes or redirects on a timer',
    explanation:
      'A timed refresh can move people away before they finish reading, and resets screen readers to the top.',
    who: `${SR}, and ${COG.toLowerCase()}`,
  },
  blink: {
    title: 'Blinking content',
    explanation: 'Blinking text is distracting and cannot be paused.',
    who: COG,
  },
  marquee: {
    title: 'Scrolling marquee',
    explanation: 'Moving text is hard to read and cannot be paused.',
    who: COG,
  },
  'video-caption': {
    title: 'Video has no captions',
    explanation: 'Without captions, speech and important sounds in this video are lost.',
    who: 'Deaf and hard-of-hearing people',
  },
  'audio-caption': {
    title: 'Audio has no text alternative',
    explanation: 'Without a transcript or captions, this audio is inaccessible.',
    who: 'Deaf and hard-of-hearing people',
  },
  'no-autoplay-audio': {
    title: 'Audio plays automatically',
    explanation:
      'Sound that starts on its own talks over screen readers and cannot always be stopped.',
    who: SR,
  },
  'scrollable-region-focusable': {
    title: 'Scrollable area cannot be reached by keyboard',
    explanation:
      'This region scrolls but cannot receive focus, so keyboard users cannot scroll its content.',
    who: KB,
  },
  'server-side-image-map': {
    title: 'Server-side image map',
    explanation: 'Server-side image maps cannot be used with a keyboard.',
    who: KB,
  },
  'autocomplete-valid': {
    title: 'Autocomplete value is not valid',
    explanation:
      'The autocomplete token is not recognised, so browsers cannot help fill this field.',
    who: `${COG}, and people with motor disabilities`,
  },
  'avoid-inline-spacing': {
    title: 'Text spacing cannot be adjusted',
    explanation:
      'Inline !important spacing stops people from increasing line or letter spacing to read comfortably.',
    who: `${COG} (including dyslexia), and low-vision readers`,
  },
  'css-orientation-lock': {
    title: 'Content is locked to one orientation',
    explanation: 'People with a mounted device may not be able to rotate it.',
    who: 'People with motor disabilities',
  },
  'target-size': {
    title: 'Touch target is too small',
    explanation:
      'Small or crowded targets are hard to hit. Targets need at least 24 by 24 CSS pixels or enough spacing.',
    who: 'People with tremors or limited dexterity, and touch-screen users',
  },
  'label-title-only': {
    title: 'Field is labelled only by a tooltip',
    explanation: 'A title or aria-describedby alone is not a visible label.',
    who: VC,
  },
  'form-field-multiple-labels': {
    title: 'Form field has more than one label',
    explanation: 'Multiple labels are announced inconsistently across screen readers.',
    who: SR,
  },
  tabindex: {
    title: 'Positive tabindex changes the focus order',
    explanation: 'tabindex greater than 0 makes keyboard focus jump around the page unpredictably.',
    who: KB,
  },
  'skip-link': {
    title: 'Skip link target does not exist',
    explanation: 'The skip link points to an id that is missing or not focusable.',
    who: KB,
  },
  'focus-order-semantics': {
    title: 'Focusable element has no suitable role',
    explanation: 'This element receives focus but is not announced as anything interactive.',
    who: SR,
  },

  // --- Best practices (advisory) ---
  'heading-order': {
    title: 'Heading levels skip a step',
    explanation:
      'Headings jump a level (for example from h1 to h4). Screen reader users navigate by headings and lose the structure.',
    who: SR,
  },
  'empty-heading': {
    title: 'Heading is empty',
    explanation:
      'An empty heading is announced as "heading" with no text, which is confusing when navigating.',
    who: SR,
  },
  'page-has-heading-one': {
    title: 'Page has no main heading',
    explanation:
      'An h1 tells people what the page is about and is the first stop when navigating by headings.',
    who: SR,
  },
  'landmark-one-main': {
    title: 'Page has no main landmark',
    explanation: 'A <main> element lets people jump straight to the content.',
    who: `${SR}, and keyboard users`,
  },
  region: {
    title: 'Content is outside any landmark',
    explanation:
      'Some content is not inside header, nav, main or footer, so people navigating by landmarks can miss it.',
    who: SR,
  },
  'landmark-unique': {
    title: 'Landmarks share the same name',
    explanation:
      'Two landmarks of the same type have the same label, so people cannot tell them apart.',
    who: SR,
  },
  'landmark-no-duplicate-main': {
    title: 'Page has more than one main landmark',
    explanation: 'There should be only one <main>.',
    who: SR,
  },
  'landmark-no-duplicate-banner': {
    title: 'Page has more than one banner',
    explanation: 'There should be only one top-level header.',
    who: SR,
  },
  'landmark-no-duplicate-contentinfo': {
    title: 'Page has more than one footer landmark',
    explanation: 'There should be only one top-level footer.',
    who: SR,
  },
  'landmark-complementary-is-top-level': {
    title: 'Aside is nested inside another landmark',
    explanation: 'Complementary content should be a top-level landmark.',
    who: SR,
  },
  'landmark-banner-is-top-level': {
    title: 'Banner is nested inside another landmark',
    explanation: 'The page header landmark should be top level.',
    who: SR,
  },
  'landmark-contentinfo-is-top-level': {
    title: 'Footer landmark is nested inside another landmark',
    explanation: 'The page footer landmark should be top level.',
    who: SR,
  },
  'landmark-main-is-top-level': {
    title: 'Main landmark is nested inside another landmark',
    explanation: 'The main landmark should be top level.',
    who: SR,
  },
  'image-redundant-alt': {
    title: 'Image alt text repeats nearby text',
    explanation: 'The same words are announced twice.',
    who: SR,
  },
  'identical-links-same-purpose': {
    title: 'Links with the same name go to different places',
    explanation: 'Links that read the same should lead to the same destination.',
    who: SR,
  },
  'p-as-heading': {
    title: 'Bold paragraph is used as a heading',
    explanation: 'Text styled to look like a heading is not announced as one.',
    who: SR,
  },
  'empty-table-header': {
    title: 'Table header is empty',
    explanation: 'An empty header cell gives no context to the cells below it.',
    who: SR,
  },
  accesskeys: {
    title: 'Access key is not unique',
    explanation: 'Two elements share the same keyboard shortcut.',
    who: KB,
  },
  'frame-title-unique': {
    title: 'Frames share the same title',
    explanation: 'Frames with identical titles cannot be told apart.',
    who: SR,
  },
  'scope-attr-valid': {
    title: 'Table scope attribute is used incorrectly',
    explanation: 'scope must be "row" or "col" on header cells.',
    who: SR,
  },
  'meta-viewport-large': {
    title: 'Zoom is limited',
    explanation: 'The viewport limits zoom below 500%.',
    who: LV,
  },
  'aria-allowed-role': {
    title: 'ARIA role is not appropriate for this element',
    explanation: 'This element should not be given that role.',
    who: SR,
  },
  'aria-dialog-name-best-practice': {
    title: 'Dialog has no name',
    explanation: 'Dialogs should have an accessible name.',
    who: SR,
  },

  // --- AccessFix checks ---
  'afx-heading-missing-h1': {
    title: 'Page has no main heading',
    explanation: 'There is no h1, so people navigating by headings have no clear starting point.',
    who: SR,
    criteria: [],
  },
  'afx-heading-multiple-h1': {
    title: 'Page has more than one main heading',
    explanation:
      'Several h1s make it unclear what the page is about. Use one h1 and h2 for sections.',
    who: SR,
    criteria: [],
  },
  'afx-heading-skip': {
    title: 'Heading levels skip a step',
    explanation:
      'The outline jumps a level, so the structure screen reader users rely on is broken.',
    who: SR,
    criteria: ['1.3.1'],
  },
  'afx-heading-empty': {
    title: 'Heading is empty',
    explanation: 'An empty heading is announced as "heading" with no text.',
    who: SR,
    criteria: ['2.4.6'],
  },
  'afx-link-ambiguous': {
    title: 'Link text does not say where it goes',
    explanation:
      'Phrases like "click here" or "read more" make no sense out of context, for example in a screen reader\'s list of links.',
    who: `${SR}, and ${COG.toLowerCase()}`,
    criteria: ['2.4.4'],
  },
};

/** Fallback "who it affects" from axe category tags. */
const CATEGORY_WHO = {
  'cat.color': LV,
  'cat.text-alternatives': SR,
  'cat.forms': VC,
  'cat.keyboard': KB,
  'cat.name-role-value': VC,
  'cat.structure': SR,
  'cat.semantics': SR,
  'cat.language': SR,
  'cat.aria': SR,
  'cat.tables': SR,
  'cat.parsing': SR,
  'cat.sensory-and-visual-cues': LV,
  'cat.time-and-media': 'Deaf and hard-of-hearing people, and people who need more time',
};

/**
 * Plain-language text for a rule, falling back to axe's own help text.
 * @param {string} ruleId
 * @param {{ help?: string, description?: string, tags?: string[] }} [axeRule]
 */
export function describeRule(ruleId, axeRule = {}) {
  const t = RULE_TEMPLATES[ruleId];
  if (t) return { title: t.title, explanation: t.explanation, whoItAffects: t.who };
  const category = (axeRule.tags ?? []).find((tag) => CATEGORY_WHO[tag]);
  return {
    title: axeRule.help ?? ruleId,
    explanation: axeRule.description ?? 'An automated accessibility check failed for this element.',
    whoItAffects: category ? CATEGORY_WHO[category] : 'People using assistive technology',
  };
}
