import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@utils/index';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  dot?: boolean;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    { className, variant = 'default', size = 'md', dot = false, children, ...props },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center font-medium rounded-full
    `;

    const variants = {
      default: 'bg-gray-100 text-gray-800 dark:bg-dark-700 dark:text-gray-200',
      primary: 'bg-linkedin-500/10 text-linkedin-600 dark:bg-linkedin-500/20 dark:text-linkedin-400',
      success: 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400',
      warning: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
      error: 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400',
      info: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-xs',
    };

    return (
      <span
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full mr-1.5',
              variant === 'success' && 'bg-green-500',
              variant === 'warning' && 'bg-amber-500',
              variant === 'error' && 'bg-red-500',
              variant === 'info' && 'bg-blue-500',
              variant === 'primary' && 'bg-linkedin-500',
              variant === 'default' && 'bg-gray-500'
            )}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
export default Badge;
