import { createContext, proposeRepairs } from './index.js';

/** One LLM task per pattern, even when the same pattern appears on several pages. */
export function mergeTasksBySignature(lists) {
  const tasks = [];
  const bySig = new Map();
  for (const list of lists) {
    for (const task of list) {
      const hit = bySig.get(task.signature);
      if (hit) {
        for (const id of task.repairIds) {
          if (!hit.repairIds.includes(id)) hit.repairIds.push(id);
        }
      } else {
        bySig.set(task.signature, task);
        tasks.push(task);
      }
    }
  }
  return tasks;
}

/**
 * A pattern is verified only when every page it was written to verified.
 * A failed page is never counted as fixed.
 * @param {{ url: string, repairs: { id: string, signature?: string, ruleId: string, status: string }[] }[]} pages
 */
export function patternReport(pages) {
  const bySig = new Map();
  for (const page of pages) {
    for (const repair of page.repairs) {
      const signature = repair.signature || repair.ruleId;
      const rows = bySig.get(signature) ?? [];
      rows.push({ url: page.url, repairId: repair.id, status: repair.status });
      bySig.set(signature, rows);
    }
  }
  return [...bySig].map(([signature, rows]) => ({
    signature,
    verified: rows.length > 0 && rows.every((row) => row.status === 'verified'),
    pages: rows,
  }));
}

const BUDGET_NOTE = {
  ceiling: 'Daily token ceiling reached; template used.',
  'over-budget': 'Model over budget; template used.',
};

/** @param {object} repair @param {{ status?: string, text?: string } | undefined} out */
export function noteBudget(repair, out) {
  const note = BUDGET_NOTE[out?.status];
  if (!note) return repair;
  return { ...repair, notes: [...new Set([...(repair.notes ?? []), note])] };
}

/**
 * Propose once per page (context-dependent fixes stay per page), call the model
 * once per pattern, then verify the written patch on every page.
 */
export async function proposeAcrossPages({
  scan,
  sourceCache,
  buildTasks,
  complete,
  verify,
  applyDraft,
  useLlm,
  llm,
  ip,
  plan,
  model,
}) {
  const prepared = [];
  for (const page of scan.pages ?? []) {
    if (page.status !== 'completed' || page.cacheIndex == null) continue;
    const cached = sourceCache.get(`${scan.id}#${page.cacheIndex}`);
    if (!cached?.source) continue;
    const pageScan = { ...scan, input: { type: 'url', url: page.url }, violations: page.violations ?? [] };
    const repairs = proposeRepairs({ scan: pageScan, source: cached.source, violations: page.violations ?? [] }).map(
      (repair) => {
        const finding = (page.violations ?? []).find((v) => v.id === repair.violationId);
        return { ...repair, signature: finding?.signature ?? repair.ruleId, pageUrl: page.url };
      },
    );
    prepared.push({
      page,
      cached,
      pageScan,
      repairs,
      ctx: createContext({ source: cached.source, scan: pageScan }),
    });
  }

  let llmRes = null;
  const taskLists = [];
  if (useLlm && llm?.enabled) {
    for (const item of prepared) {
      taskLists.push(buildTasks(item.repairs, { ctx: item.ctx, cached: item.cached, model, byPattern: true }));
    }
    const tasks = mergeTasksBySignature(taskLists);
    llmRes = await complete(tasks, { ip, scanBudget: undefined, ownerId: scan.ownerId, plan });
    for (const item of prepared) {
      item.repairs = item.repairs.map((repair) => {
        const task = tasks.find((t) => t.repairIds.includes(repair.id));
        const out = task && llmRes.results.get(task.key);
        const noted = noteBudget(repair, out);
        if (!out?.text) return noted;
        return applyDraft(noted, out.text, out.confidence, { scan: item.pageScan, source: item.cached.source });
      });
    }
  }

  let scansRun = 0;
  const pageReports = [];
  for (const item of prepared) {
    const candidates = item.repairs.filter((r) => r.status === 'proposed');
    if (!candidates.length) {
      pageReports.push({ url: item.page.url, repairs: item.repairs });
      continue;
    }
    const result = await verify({ scan: item.pageScan, cached: item.cached, repairs: candidates });
    scansRun += result.scansRun;
    const outcomes = result.outcomes;
    item.repairs = item.repairs.map((repair) => {
      const outcome = outcomes.get(repair.id);
      if (!outcome) return repair;
      const status =
        outcome.outcome === 'resolved'
          ? 'verified'
          : outcome.outcome === 'still-failing'
            ? 'failed'
            : outcome.outcome === 'regressed'
              ? 'regressed'
              : 'not-applied';
      return { ...repair, status, verification: { outcome: outcome.outcome, detail: outcome.detail ?? null } };
    });
    pageReports.push({ url: item.page.url, repairs: item.repairs });
  }

  return {
    repairs: prepared.flatMap((item) => item.repairs),
    scansRun,
    llmRes,
    patterns: patternReport(pageReports),
    pageCount: prepared.length,
  };
}

/** Re-check the chosen repairs on every page they were written to. */
export async function verifyPages({ scan, sourceCache, candidates, verify }) {
  const groups = [];
  for (const page of scan.pages ?? []) {
    if (page.status !== 'completed' || page.cacheIndex == null) continue;
    const cached = sourceCache.get(`${scan.id}#${page.cacheIndex}`);
    if (!cached?.source) continue;
    const repairs = candidates.filter((repair) => repair.pageUrl === page.url);
    if (!repairs.length) continue;
    const result = await verify({
      scan: { ...scan, input: { type: 'url', url: page.url }, violations: page.violations ?? [] },
      cached,
      repairs,
    });
    groups.push({ url: page.url, result });
  }
  return groups;
}
