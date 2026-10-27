import { CircleAlert, CircleCheck, CircleDashed } from 'lucide-react';

const STATES = {
  checking: { Icon: CircleDashed, label: 'Checking API', className: 'text-muted-foreground' },
  ok: { Icon: CircleCheck, label: 'API online', className: 'text-verified' },
  degraded: { Icon: CircleAlert, label: 'API online, scanner offline', className: 'text-moderate' },
  down: { Icon: CircleAlert, label: 'API unreachable', className: 'text-critical' },
};

/**
 * Status is always icon + text, never colour alone.
 * @param {{ state: keyof typeof STATES }} props
 */
export function ApiStatus({ state }) {
  const { Icon, label, className } = STATES[state];
  return (
    <p role="status" className={`flex items-center gap-1.5 text-sm ${className}`}>
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </p>
  );
}
