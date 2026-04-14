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
      inline-flex items-center justify-center font-medium rounded-lg
      transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
    `;

    const variants = {
      primary: `
        bg-linkedin-500 text-white hover:bg-linkedin-600
        focus:ring-linkedin-500
        dark:bg-linkedin-600 dark:hover:bg-linkedin-700
      `,
      secondary: `
        bg-gray-100 text-gray-900 hover:bg-gray-200
        focus:ring-gray-500
        dark:bg-dark-700 dark:text-gray-100 dark:hover:bg-dark-600
      `,
      ghost: `
        text-gray-600 hover:bg-gray-100 hover:text-gray-900
        focus:ring-gray-500
        dark:text-gray-300 dark:hover:bg-dark-800 dark:hover:text-white
      `,
      danger: `
        bg-red-600 text-white hover:bg-red-700
        focus:ring-red-500
      `,
      outline: `
        border-2 border-linkedin-500 text-linkedin-500 hover:bg-linkedin-50
        focus:ring-linkedin-500
        dark:border-linkedin-400 dark:text-linkedin-400 dark:hover:bg-linkedin-900/20
      `,
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
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
