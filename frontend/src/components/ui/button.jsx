import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';

export const buttonVariants = cva(
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:opacity-90',
        outline: 'border border-input bg-background hover:bg-surface',
        ghost: 'hover:bg-surface',
      },
      size: { md: 'min-h-10 px-4', sm: 'min-h-8 px-3 text-xs' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export function Button({ className, variant, size, type = 'button', ...props }) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
