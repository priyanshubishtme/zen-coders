import { cn } from '@/lib/utils.js';

export function Badge({ className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        className,
      )}
      {...props}
    />
  );
}
