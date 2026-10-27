import { useEffect, useState } from 'react';
import { getHealth } from '@/lib/api.js';

/** @returns {{ state: 'checking' | 'ok' | 'degraded' | 'down', health: import('@/lib/api.js').Health | null }} */
export function useHealth() {
  const [value, setValue] = useState({ state: 'checking', health: null });

  useEffect(() => {
    let active = true;
    getHealth()
      .then((h) => active && setValue({ state: h.status === 'ok' ? 'ok' : 'degraded', health: h }))
      .catch(() => active && setValue({ state: 'down', health: null }));
    return () => {
      active = false;
    };
  }, []);

  return value;
}
