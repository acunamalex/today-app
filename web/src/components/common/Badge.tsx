import { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-slate-100 text-slate-700',
      success: 'bg-success-100 text-success-600',
      warning: 'bg-warning-100 text-warning-600',
      danger: 'bg-danger-100 text-danger-600',
      info: 'bg-primary-100 text-primary-600',
      outline: 'bg-transparent border border-slate-300 text-slate-600',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
    };

    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center font-medium rounded-full',
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
);

Badge.displayName = 'Badge';

// Status badge for route/stop status
export type StatusType = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'planning' | 'active' | 'cancelled';

const statusConfig: Record<StatusType, { label: string; variant: BadgeProps['variant'] }> = {
  pending: { label: 'Pending', variant: 'default' },
  planning: { label: 'Planning', variant: 'default' },
  in_progress: { label: 'In Progress', variant: 'info' },
  active: { label: 'Active', variant: 'info' },
  completed: { label: 'Completed', variant: 'success' },
  skipped: { label: 'Skipped', variant: 'warning' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
};

export function StatusBadge({ status, size = 'md' }: { status: StatusType; size?: BadgeProps['size'] }) {
  const config = statusConfig[status] || { label: status, variant: 'default' as const };

  return (
    <Badge variant={config.variant} size={size}>
      {config.label}
    </Badge>
  );
}
