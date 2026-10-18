import { type VariantProps, cva } from 'class-variance-authority';
import React from 'react';
import { cn } from '../../lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center rounded-badge px-2.5 py-0.5 text-xs font-medium border border-transparent transition-colors',
  {
    variants: {
      tone: {
        neutral: 'bg-neutral-tint text-text-muted',
        info: 'bg-primary-tint text-primary border-primary/20',
        primary: 'bg-primary-tint text-primary font-semibold',
        success: 'bg-success-tint text-success-text border-success/20',
        warning: 'bg-warning-tint text-warning-text border-warning/20',
        danger: 'bg-danger-tint text-danger-text border-danger/20',
        outline: 'border-border text-text-muted bg-surface',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export const Badge: React.FC<BadgeProps> = ({ className, tone, ...props }) => {
  return <div className={cn(badgeVariants({ tone }), className)} {...props} />;
};
