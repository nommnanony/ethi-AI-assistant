import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export function Badge({ className, variant = 'default', size = 'md', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-surface-elevated text-text-secondary border-border',
    primary: 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/50',
    secondary: 'bg-accent-purple/20 text-accent-purple border-accent-purple/50',
    success: 'bg-accent-green/20 text-accent-green border-accent-green/50',
    warning: 'bg-accent-orange/20 text-accent-orange border-accent-orange/50',
    danger: 'bg-red-500/20 text-red-400 border-red-500/50',
    outline: 'bg-transparent text-text-secondary border-border',
  };

  const sizes = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
