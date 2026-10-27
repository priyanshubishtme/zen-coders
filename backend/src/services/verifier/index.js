import { createContext, render } from '../repair/index.js';
import { applyEdits, compatible, insertAt } from '../repair/edits.js';
import { compare } from './compare.js';

/** Upper bound on re-scans for one verification, bisection included. */
const DEFAULT_MAX_SCANS = 10;

/**
 * Verifier: apply repairs to a COPY of the source, re-scan it offline
 * (captured responses only), and judge each repair:
 *   resolved      its violation is gone
 *   still-failing it is still there
 *   regressed     it caused a new violation (found by marker, else by bisection)
 *   not-applied   it conflicts with another repair, or could not be reproduced
 * The original source is never mutated.
 *
 * @param {{ scanner: object, maxScans?: number }} deps
 */
export function createVerifier({ scanner, maxScans = DEFAULT_MAX_SCANS }) {
  /**
   * @param {{ scan: object, cached: { source: string, resources: Map, mainUrl: string | null },
   *   repairs: object[] }} input  repairs carry server-side _edits/_css/_markPos
   */
  async function verify({ scan, cached, repairs }) {
    const { source } = cached;
    const ctx = createContext({ source, scan });
    let scansRun = 0;

    // One marker per touched element, shared by every repair on that element.
    const markerAt = new Map();
    for (const r of repairs) {
      if (r._markPos !== null && !markerAt.has(r._markPos)) markerAt.set(r._markPos, String(markerAt.size));
    }
    const markerOf = (r) => (r._markPos === null ? null : markerAt.get(r._markPos));
    const markerEdits = [...markerAt].map(([pos, k]) => insertAt(pos, ` data-afx-v="${k}"`));

    const replay = async (html) => {
      scansRun += 1;
      const input =
        scan.input.type === 'html' ? { type: 'html', html } : { type: 'url', url: cached.mainUrl };
      return scanner.scan(input, scan.options, {
        replay: { resources: cached.resources, mainHtml: scan.input.type === 'url' ? html : undefined },
      });
    };
    const editsOf = (group) => group.flatMap((r) => r._edits);
    const cssOf = (group) => group.flatMap((r) => r._css);
    const run = (group) => replay(render(ctx, [...markerEdits, ...editsOf(group)], cssOf(group)));

    const outcomes = new Map();
    const accepted = [];
    for (const r of repairs) {
      if (compatible(source, [...markerEdits, ...editsOf(accepted)], r._edits)) accepted.push(r);
      else outcomes.set(r.id, { outcome: 'not-applied', detail: 'It changes the same code as another fix.' });
    }

    const baselineRaw = await replay(applyEdits(source, markerEdits));
    let afterRaw = baselineRaw;
    let finalSet = [];

    if (accepted.length) {
      const combinedRaw = await run(accepted);
      const diff = compare(baselineRaw, combinedRaw);
      const has = (items, r) => {
        const m = markerOf(r);
        return items.some((i) => i.ruleId === r.ruleId && (m === null || i.marker === m));
      };

      // Pin regressions on repairs: marker first, then bisection for the rest.
      const culprits = new Set(
        accepted.filter((r) => markerOf(r) !== null && diff.regressions.some((i) => i.marker === markerOf(r))),
      );
      if (diff.regressions.some((i) => i.marker === null)) {
        const isolate = async (group) => {
          if (scansRun >= maxScans) return group;
          const d = compare(baselineRaw, await run(group));
          if (!d.regressions.length) return [];
          if (group.length === 1) return group;
          const mid = Math.ceil(group.length / 2);
          const found = [...(await isolate(group.slice(0, mid))), ...(await isolate(group.slice(mid)))];
          return found.length ? found : group; // only fails in combination
        };
        const suspects = accepted.length === 1 ? accepted : await isolate(accepted);
        suspects.forEach((r) => culprits.add(r));
      }

      for (const r of accepted) {
        if (culprits.has(r)) {
          outcomes.set(r.id, { outcome: 'regressed', detail: 'It introduced a new accessibility problem, so it was not applied.' });
        } else if (!has(diff.base, r)) {
          outcomes.set(r.id, {
            outcome: 'not-applied',
            detail: 'The issue did not show up in the offline re-render, so this fix could not be verified.',
          });
        } else if (has(diff.remaining, r)) {
          outcomes.set(r.id, { outcome: 'still-failing', detail: 'The issue is still reported after the fix.' });
        } else {
          outcomes.set(r.id, { outcome: 'resolved', detail: null });
        }
      }

      finalSet = accepted.filter((r) => outcomes.get(r.id).outcome === 'resolved');
      afterRaw =
        finalSet.length === accepted.length
          ? combinedRaw
          : finalSet.length
            ? await run(finalSet)
            : baselineRaw;
    }

    return {
      outcomes,
      baselineRaw,
      afterRaw,
      applied: finalSet,
      scansRun,
      patchedHtml: render(ctx, editsOf(finalSet), cssOf(finalSet)),
    };
  }

  return { verify };
}
