import { useEffect, useState } from 'react';
import { CircleCheck, CircleAlert, CircleDashed } from 'lucide-react';
import { getHealth } from '@/lib/api.js';

const STATES = {
  checking: { Icon: CircleDashed, label: 'Checking API', className: 'text-muted-foreground' },
  ok: { Icon: CircleCheck, label: 'API online', className: 'text-verified' },
  degraded: { Icon: CircleAlert, label: 'API online, scanner offline', className: 'text-moderate' },
  down: { Icon: CircleAlert, label: 'API unreachable', className: 'text-critical' },
};

/** Status is always icon + text, never color alone. */
export function ApiStatus() {
  const [state, setState] = useState('checking');

  useEffect(() => {
    let active = true;
    getHealth()
      .then((h) => active && setState(h.status === 'ok' ? 'ok' : 'degraded'))
      .catch(() => active && setState('down'));
    return () => {
      active = false;
    };
  }, []);

  const { Icon, label, className } = STATES[state];
  return (
    <p role="status" className={`flex items-center gap-1.5 text-sm ${className}`}>
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </p>
  );
}
