/** Screenshot frame the pins were measured against. */
export const MARK_FRAME = Object.freeze({ width: 1280, height: 720 });

const BADGE_SIZES = [24, 16];
const GAP = 4;

/** Document-level targets have no element worth boxing. */
export function isPageLevel(violation, mark) {
  const target = violation?.node?.target?.[0] ?? '';
  const selector = target.split(' >>> ').pop().trim();
  if (/^(html|head|title)(\W|$)/i.test(selector)) return true;
  if (mark?.place === 'pin' && mark.w >= 0.9 && mark.h >= 0.9) return true;
  return false;
}

/**
 * Boxes in reading order, then chips for everything that has no box.
 * Numbers start at 1 and are only for display.
 * @param {import('./api.js').Violation[]} violations
 * @param {import('./api.js').Violation[]} manualReview
 * @param {{ violationId: string, place: string, x: number | null, y: number | null, w: number | null, h: number | null }[]} marks
 */
export function buildPreviewModel(violations, manualReview, marks) {
  const markById = new Map((marks ?? []).map((mark) => [mark.violationId, mark]));
  const boxes = [];
  const chips = [];
  for (const violation of violations ?? []) {
    const mark = markById.get(violation.id);
    if (mark?.place === 'pin' && mark.w != null && mark.h != null && !isPageLevel(violation, mark)) {
      boxes.push({ violation, mark, manual: false });
    } else {
      chips.push({ violation, mark: mark ?? null, manual: false });
    }
  }
  for (const violation of manualReview ?? []) {
    chips.push({ violation, mark: markById.get(violation.id) ?? null, manual: true });
  }
  boxes.sort((a, b) => a.mark.y - b.mark.y || a.mark.x - b.mark.x || a.violation.id.localeCompare(b.violation.id));
  let n = 1;
  const numberedBoxes = boxes.map((item) => ({ ...item, n: n++ }));
  const numberedChips = chips.map((item) => ({ ...item, n: n++ }));
  /** @type {Record<string, number>} */
  const numberById = {};
  for (const item of [...numberedBoxes, ...numberedChips]) numberById[item.violation.id] = item.n;
  return { boxes: numberedBoxes, chips: numberedChips, numberById };
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function inside(badge, frame) {
  return badge.x >= 0 && badge.y >= 0 && badge.x + badge.w <= frame.width + 0.01 && badge.y + badge.h <= frame.height + 0.01;
}

function spotsFor(box, size, frame) {
  const spots = [
    { x: box.x + box.w + GAP, y: box.y },
    { x: box.x + box.w - size, y: box.y - size - GAP },
    { x: box.x, y: box.y - size - GAP },
    { x: box.x - size - GAP, y: box.y },
    { x: box.x, y: box.y + box.h + GAP },
    { x: box.x + box.w + GAP, y: box.y + box.h - size },
  ];
  for (let step = 8; step < frame.height; step += 8) {
    spots.push({ x: box.x + box.w + GAP, y: box.y + step });
    spots.push({ x: box.x - size - GAP, y: box.y + step });
    spots.push({ x: box.x + step, y: box.y - size - GAP });
    spots.push({ x: box.x + step, y: box.y + box.h + GAP });
  }
  return spots;
}

function freeSpot(size, frame, ownBox, boxes, badges, pad) {
  let best = null;
  let bestDistance = Infinity;
  for (let y = 0; y <= frame.height - size; y += 8) {
    for (let x = 0; x <= frame.width - size; x += 8) {
      const badge = { x, y, w: size, h: size };
      const padded = { x: x - pad, y: y - pad, w: size + pad * 2, h: size + pad * 2 };
      if (overlaps(padded, ownBox)) continue;
      if (boxes.some((box) => overlaps(padded, box))) continue;
      if (badges.some((other) => overlaps(padded, other))) continue;
      const dx = x - (ownBox.x + ownBox.w);
      const dy = y - ownBox.y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        best = badge;
        bestDistance = distance;
      }
    }
  }
  return best;
}

/**
 * Place numbered badges outside their boxes. Shrink once to 16px. Never drop a box.
 * displayScale is the on-screen width divided by the 1280px frame, so a badge
 * stays 24px (or 16px) on the preview instead of shrinking with the image.
 * @param {{ id: string, x: number, y: number, w: number, h: number }[]} items fractions
 * @param {{ width: number, height: number }} [frame]
 * @param {number} [displayScale]
 */
export function placeBadges(items, frame = MARK_FRAME, displayScale = 1) {
  const scale = displayScale > 0 ? displayScale : 1;
  const sizes = BADGE_SIZES.map((px) => px / scale);
  const pad = 6 / scale;
  const boxes = items.map((item) => {
    const w = Math.min(frame.width, Math.max(8, item.w * frame.width));
    const h = Math.min(frame.height, Math.max(8, item.h * frame.height));
    const x = Math.min(Math.max(0, item.x * frame.width), frame.width - w);
    const y = Math.min(Math.max(0, item.y * frame.height), frame.height - h);
    return { id: item.id, box: { x, y, w, h } };
  });
  const taken = [];
  return boxes.map((item) => {
    let chosen = null;
    let size = BADGE_SIZES[0];
    let leader = false;
    for (const nextSize of sizes) {
      const spots = spotsFor(item.box, nextSize, frame);
      for (let index = 0; index < spots.length; index += 1) {
        const badge = { x: spots[index].x, y: spots[index].y, w: nextSize, h: nextSize };
        const padded = { x: badge.x - pad, y: badge.y - pad, w: badge.w + pad * 2, h: badge.h + pad * 2 };
        if (!inside(badge, frame)) continue;
        if (overlaps(padded, item.box)) continue;
        if (boxes.some((other) => other.id !== item.id && overlaps(padded, other.box))) continue;
        if (taken.some((other) => overlaps(padded, other))) continue;
        chosen = badge;
        size = nextSize;
        leader = index > 0;
        break;
      }
      if (chosen) break;
    }
    if (!chosen) {
      const fallback = 16 / scale;
      chosen = freeSpot(fallback, frame, item.box, boxes.map((entry) => entry.box), taken, pad) ?? {
        x: Math.max(0, frame.width - fallback),
        y: Math.max(0, frame.height - fallback),
        w: fallback,
        h: fallback,
      };
      size = fallback;
      leader = true;
    }
    taken.push(chosen);
    return { id: item.id, box: item.box, badge: chosen, size, leader };
  });
}

/** Scroll offset that moves the issue row inside the issues pane, not the page. */
export function issueScrollTop(paneTop, rowTop, scrollTop) {
  return scrollTop + (rowTop - paneTop) - 8;
}

export function scrollIssueIntoPane(id) {
  const pane = document.getElementById('issues-pane');
  const row = document.getElementById(`issue-${id}`);
  if (!pane || !row) return;
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const top = issueScrollTop(pane.getBoundingClientRect().top, row.getBoundingClientRect().top, pane.scrollTop);
  pane.scrollTo({ top, behavior: still ? 'auto' : 'smooth' });
  row.focus({ preventScroll: true });
}

const NAME_LIMIT = 80;

/**
 * @param {{ role?: string, name?: string }} mark
 */
export function announcedName(mark) {
  if ((mark.role ?? '').toLowerCase() === 'html') {
    return { element: 'Page title / language', text: 'Page title / language', missing: false, truncated: false };
  }
  const raw = (mark.name ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return { element: mark.role || 'element', text: 'No accessible name', missing: true, truncated: false };
  if (raw.length <= NAME_LIMIT) return { element: mark.role || 'element', text: raw, missing: false, truncated: false };
  return {
    element: mark.role || 'element',
    text: `${raw.slice(0, NAME_LIMIT).trimEnd()}…`,
    full: raw,
    missing: false,
    truncated: true,
  };
}

/** Fix the stored keyboard sentence without inventing control names the scan did not record. */
export function keyboardSentence(message) {
  const unreachable = /^(\d+) interactive controls? were not reached by Tab\.$/.exec(message);
  if (unreachable) {
    const n = Number(unreachable[1]);
    return n === 1 ? '1 control was not reached by Tab.' : `${n} controls were not reached by Tab.`;
  }
  const quiet = /^(\d+) focused controls? had no obvious visible focus style\.$/.exec(message);
  if (quiet) {
    const n = Number(quiet[1]);
    return n === 1
      ? '1 focused control had no obvious visible focus style.'
      : `${n} focused controls had no obvious visible focus style.`;
  }
  const reached = /^Tab reached (\d+) controls?\.$/.exec(message);
  if (reached) {
    const n = Number(reached[1]);
    return n === 1 ? 'Tab reached 1 control.' : `Tab reached ${n} controls.`;
  }
  return message;
}

/** Usual fix for a rule. This is guidance, not a repair that exists. */
const USUAL = {
  'color-contrast': 'Usually we change the text or background color so the contrast is strong enough.',
  'image-alt': 'Usually we add a text alternative. A person still has to confirm the words.',
  label: 'Usually we connect a visible label to the control.',
  'select-name': 'Usually we connect a visible label to the control.',
  'button-name': 'Usually we add a name a screen reader can read. A person confirms the words.',
  'link-name': 'Usually we add a name that says where the link goes. A person confirms the words.',
  'html-has-lang': 'Usually we add a language on the page.',
  'html-lang-valid': 'Usually we correct the language code.',
  'document-title': 'Usually we add a page title from the main heading.',
  'page-has-heading-one': 'Usually we mark the main heading as a level-one heading.',
  'heading-order': 'Usually we fix the heading levels without changing how they look.',
  'landmark-one-main': 'Usually we wrap the content in a main region.',
  region: 'Usually we put content inside a landmark.',
  bypass: 'Usually a person adds a way to skip repeated content.',
};

/**
 * @param {string} ruleId
 * @param {import('./api.js').Repair | undefined} repair
 */
export function fixStatus(ruleId, repair) {
  if (!repair) {
    const usual = USUAL[ruleId];
    return usual
      ? `${usual} Not applied yet.`
      : 'Not applied yet. Suggest fixes to see whether this can be applied automatically.';
  }
  if (repair.strategy === 'manual' || repair.status === 'manual-review') {
    return 'Manual fix. A person has to change this. It has not been applied.';
  }
  if (repair.strategy === 'llm' || repair.strategy === 'template' || repair.status === 'needs-input') {
    return repair.status === 'verified'
      ? 'Draft reviewed and applied.'
      : 'Draft to review. It has not been applied until you accept it.';
  }
  if (repair.strategy === 'deterministic') {
    return repair.status === 'verified'
      ? 'Automatic fix. Applied and verified.'
      : 'Automatic fix. It is ready, and it has not been applied until you click Apply verified fixes.';
  }
  return 'Not applied yet.';
}

/**
 * @param {import('./api.js').Violation[]} violations
 */
export function problemColors(violations) {
  const rows = [];
  for (const violation of violations ?? []) {
    const evidence = violation.node?.evidence;
    if (!evidence?.fgColor || !evidence?.bgColor) continue;
    rows.push({ id: violation.id, title: violation.title, fg: evidence.fgColor, bg: evidence.bgColor });
  }
  return rows;
}

export function oneLine(text) {
  const line = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!line) return '';
  const sentence = line.split(/(?<=\.)\s/)[0];
  return sentence.length > 140 ? `${sentence.slice(0, 137).trimEnd()}…` : sentence;
}

export const MARK_FILLS = {
  critical: '#b91c1c',
  serious: '#c2410c',
  moderate: '#92400e',
  minor: '#1d4ed8',
  manual: '#b45309',
};

export const MARK_GLYPH = {
  critical: '⬢',
  serious: '▲',
  minor: '●',
  moderate: '■',
  manual: '✎',
};
