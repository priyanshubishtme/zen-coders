import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';

export const buttonVariants = cva(
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-[background-color,filter,transform] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:brightness-110',
        outline: 'border border-input bg-background text-foreground hover:bg-raised',
        ghost: 'text-foreground hover:bg-raised',
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
