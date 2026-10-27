import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';

const alertVariants = cva('flex gap-3 rounded-lg border p-4 text-sm', {
  variants: {
    tone: {
      error: 'border-critical bg-surface text-foreground',
      warning: 'border-moderate bg-surface text-foreground',
      info: 'border-border bg-surface text-foreground',
    },
  },
  defaultVariants: { tone: 'info' },
});

/** `role` defaults to "alert" for errors and "status" otherwise. */
export function Alert({ tone = 'info', icon: Icon, title, children, className, role, action }) {
  return (
    <div
      role={role ?? (tone === 'error' ? 'alert' : 'status')}
      className={cn(alertVariants({ tone }), className)}
    >
      {Icon && <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-muted-foreground">{children}</div>
      </div>
      {action}
    </div>
  );
}
