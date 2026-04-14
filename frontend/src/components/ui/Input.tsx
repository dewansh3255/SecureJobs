import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@utils/index';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, error, helperText, leftIcon, rightIcon, type = 'text', ...props },
    ref
  ) => {
    const baseStyles = `
      w-full px-4 py-2.5 text-sm rounded-lg border
      transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0
      disabled:opacity-50 disabled:cursor-not-allowed
      bg-white dark:bg-dark-800
      text-gray-900 dark:text-gray-100
      placeholder:text-gray-400 dark:placeholder:text-gray-500
    `;

    const stateStyles = error
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
      : 'border-gray-300 dark:border-dark-600 focus:border-linkedin-500 focus:ring-linkedin-500/20';

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={cn(
              baseStyles,
              stateStyles,
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export default Input;
