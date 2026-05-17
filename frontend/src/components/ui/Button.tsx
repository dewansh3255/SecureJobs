import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@utils/index';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center font-semibold
      transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0
      disabled:opacity-40 disabled:cursor-not-allowed
      select-none
    `;

    const variants = {
      primary: `
        text-white font-semibold
        bg-gradient-to-br from-accent-500 to-accent2-500
        hover:from-accent-400 hover:to-accent2-400
        focus:ring-accent-500/50
        shadow-[0_4px_20px_rgba(124,111,224,0.35)]
        hover:shadow-[0_4px_28px_rgba(124,111,224,0.55)]
      `,
      secondary: `
        bg-dark-750 text-dark-100 border border-dark-600
        hover:border-accent-500/40 hover:bg-dark-700 hover:text-white
        focus:ring-accent-500/30
        dark:bg-dark-750 dark:text-dark-100
      `,
      ghost: `
        text-dark-300 hover:bg-dark-750/60 hover:text-white
        focus:ring-dark-600
        dark:text-dark-300 dark:hover:bg-dark-750/60 dark:hover:text-white
      `,
      danger: `
        bg-red-600 text-white hover:bg-red-500
        focus:ring-red-500/50
        shadow-[0_4px_16px_rgba(220,38,38,0.3)]
      `,
      outline: `
        border border-accent-500/50 text-accent-400
        hover:bg-accent-500/10 hover:border-accent-500
        focus:ring-accent-500/30
      `,
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs rounded-lg',
      md: 'px-5 py-2.5 text-sm rounded-xl',
      lg: 'px-7 py-3 text-base rounded-xl',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : leftIcon ? (
          <span className="mr-2">{leftIcon}</span>
        ) : null}
        {children}
        {rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export default Button;
