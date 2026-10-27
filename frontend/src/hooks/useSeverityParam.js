import { useCallback, useState } from 'react';
import { SEVERITIES } from '@/lib/severity.js';

const VALID = new Set(SEVERITIES.map((s) => s.value));

function read() {
  const raw = new URLSearchParams(window.location.search).get('severity') ?? '';
  return raw.split(',').filter((s) => VALID.has(s));
}

/** Severity filter kept in `?severity=critical,serious` so a filtered view can be shared. */
export function useSeverityParam() {
  const [selected, setSelected] = useState(read);

  const update = useCallback((next) => {
    setSelected(next);
    const url = new URL(window.location.href);
    if (next.length) url.searchParams.set('severity', next.join(','));
    else url.searchParams.delete('severity');
    window.history.replaceState(null, '', url);
  }, []);

  return [selected, update];
}
