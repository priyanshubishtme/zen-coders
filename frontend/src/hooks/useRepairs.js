import { useCallback, useEffect, useRef, useState } from 'react';
import { createRepairs, verifyRepairs } from '@/lib/api.js';
import { applicableRepairs } from '@/lib/score.js';

const idle = () => ({
  phase: 'idle',
  repairs: [],
  summary: null,
  verification: null,
  tokenUsage: null,
  error: null,
});

const OUTCOME_STATUS = {
  resolved: 'verified',
  'still-failing': 'failed',
  regressed: 'regressed',
  'not-applied': 'not-applied',
};

function mergeOutcomes(repairs, verification) {
  const byId = new Map(verification.repairs.map((o) => [o.repairId, o]));
  return repairs.map((r) => {
    const o = byId.get(r.id);
    if (!o) return r;
    if (o.detail === 'The AI draft was rejected.') {
      return {
        ...r,
        strategy: 'template',
        status: 'needs-input',
        draft: null,
        accepted: false,
        verification: { outcome: o.outcome, detail: o.detail },
      };
    }
    return {
      ...r,
      status: OUTCOME_STATUS[o.outcome] ?? r.status,
      verification: { outcome: o.outcome, detail: o.detail },
    };
  });
}

/**
 * Propose, draft placeholders, and apply verified fixes for one scan.
 * @param {string | null} scanId
 * @param {{ useLlm?: boolean }} [opts]
 */
export function useRepairs(scanId, { useLlm = false } = {}) {
  const [state, setState] = useState(idle);
  const [drafts, setDrafts] = useState({});
  const [acceptedIds, setAcceptedIds] = useState(() => new Set());
  const [rejectedIds, setRejectedIds] = useState(() => new Set());
  const gen = useRef(0);
  const controller = useRef(null);
  const seenId = useRef(null);

  useEffect(() => {
    // The first run for a scan must not abort. A click can land before this
    // effect flushes, and aborting it drops the repair request.
    if (seenId.current === scanId) return undefined;
    const previous = seenId.current;
    seenId.current = scanId;
    if (previous == null) return undefined;
    gen.current += 1;
    controller.current?.abort();
    controller.current = null;
    setState(idle());
    setDrafts({});
    setAcceptedIds(new Set());
    setRejectedIds(new Set());
    return undefined;
  }, [scanId]);

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  const run = useCallback(async (fn) => {
    const g = ++gen.current;
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    try {
      const result = await fn(ctrl.signal);
      if (g !== gen.current) return null;
      return result;
    } catch (err) {
      if (err?.name === 'AbortError' || g !== gen.current) return null;
      throw err;
    }
  }, []);

  const propose = useCallback(
    async (violationIds) => {
      if (!scanId) return;
      setState((s) => ({ ...s, phase: 'proposing', error: null }));
      try {
        const res = await run((signal) =>
          createRepairs(
            scanId,
            { useLlm, ...(violationIds ? { violationIds } : {}) },
            signal,
          ),
        );
        if (!res) return;
        const seeded = Object.fromEntries(
          res.repairs.filter((r) => r.draft).map((r) => [r.id, r.draft]),
        );
        setDrafts(seeded);
        setAcceptedIds(new Set());
        setRejectedIds(new Set());
        setState({
          phase: 'ready',
          repairs: res.repairs,
          summary: res.summary,
          verification: null,
          tokenUsage: res.tokenUsage ?? null,
          error: null,
        });
      } catch (err) {
        setState((s) => ({
          ...s,
          phase: s.repairs.length ? 'ready' : 'idle',
          error: err,
        }));
      }
    },
    [run, scanId, useLlm],
  );

  const apply = useCallback(async () => {
    if (!scanId) return;
    const chosen = applicableRepairs(state.repairs, drafts, acceptedIds);
    const rejected = [...rejectedIds];
    if (!chosen.length && !rejected.length) return;
    setState((s) => ({ ...s, phase: 'applying', error: null }));
    const edits = chosen
      .filter((r) => {
        const text = drafts[r.id]?.trim();
        if (!text || text.includes('TODO:')) return false;
        if (r.strategy === 'llm') return text !== (r.draft ?? '');
        return Boolean(r.placeholder);
      })
      .map((r) => ({ repairId: r.id, text: drafts[r.id].trim() }));
    const acceptedRepairIds = chosen.filter((r) => r.strategy === 'llm').map((r) => r.id);
    const repairIds = [...new Set([...chosen.map((r) => r.id), ...rejected])];
    try {
      const verification = await run((signal) =>
        verifyRepairs(
          scanId,
          {
            repairIds,
            ...(edits.length ? { edits } : {}),
            ...(acceptedRepairIds.length ? { acceptedRepairIds } : {}),
            ...(rejected.length ? { rejectedRepairIds: rejected } : {}),
          },
          signal,
        ),
      );
      if (!verification) return;
      setState((s) => ({
        phase: 'applied',
        repairs: mergeOutcomes(s.repairs, verification),
        summary: s.summary,
        verification,
        tokenUsage: s.tokenUsage,
        error: null,
      }));
    } catch (err) {
      setState((s) => ({ ...s, phase: 'ready', error: err }));
    }
  }, [acceptedIds, drafts, rejectedIds, run, scanId, state.repairs]);

  const setDraft = useCallback((id, text) => {
    setDrafts((d) => ({ ...d, [id]: text }));
  }, []);

  const accept = useCallback((id) => {
    setAcceptedIds((s) => new Set(s).add(id));
    setRejectedIds((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }, []);

  const reject = useCallback((id) => {
    setRejectedIds((s) => new Set(s).add(id));
    setAcceptedIds((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    setState((s) => ({
      ...s,
      repairs: s.repairs.map((r) =>
        r.id === id
          ? {
              ...r,
              strategy: 'template',
              status: 'needs-input',
              draft: null,
              accepted: false,
            }
          : r,
      ),
    }));
  }, []);

  return {
    ...state,
    drafts,
    acceptedIds,
    rejectedIds,
    setDraft,
    accept,
    reject,
    propose,
    apply,
  };
}
