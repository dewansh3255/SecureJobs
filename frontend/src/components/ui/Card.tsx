import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@utils/index';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hover' | 'interactive';
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const baseStyles = `
      bg-white dark:bg-dark-800 rounded-xl
      dark:border dark:border-dark-700
    `;

    const variants = {
      default: 'shadow-soft',
      hover: 'shadow-soft transition-all duration-200 hover:shadow-soft-lg hover:-translate-y-0.5',
      interactive: 'shadow-soft transition-all duration-200 hover:shadow-soft-lg hover:-translate-y-0.5 cursor-pointer',
    };

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-4 py-3 border-b border-gray-100 dark:border-dark-700', className)}
      {...props}
    >
      {children}
    </div>
  )
);

CardHeader.displayName = 'CardHeader';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-4 py-3', className)}
      {...props}
    >
      {children}
    </div>
  )
);

CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-4 py-3 border-t border-gray-100 dark:border-dark-700', className)}
      {...props}
    >
      {children}
    </div>
  )
);

CardFooter.displayName = 'CardFooter';

export { Card };
export default Card;
