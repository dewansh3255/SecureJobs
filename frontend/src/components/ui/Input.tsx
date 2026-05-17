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
      w-full px-4 py-3 text-sm rounded-xl border
      transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0
      disabled:opacity-50 disabled:cursor-not-allowed
      font-medium
    `;

    const stateStyles = error
      ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20 bg-red-900/10'
      : [
          'border-dark-600/60 focus:border-accent-500/70 focus:ring-accent-500/15',
          'bg-dark-800/60 text-dark-100 placeholder:text-dark-400',
          'dark:bg-dark-800/60 dark:text-dark-100 dark:placeholder:text-dark-400',
          'hover:border-dark-500',
        ].join(' ');

    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-muted)' }}>
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-dim)' }}>
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
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-dim)' }}>
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs font-medium text-red-400 flex items-center gap-1">
            <span>⚠</span> {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--color-muted)' }}>{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export default Input;
