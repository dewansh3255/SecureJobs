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
      w-full px-4 py-3 text-sm rounded-xl
      transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0
      disabled:opacity-50 disabled:cursor-not-allowed
      font-medium placeholder:text-[var(--color-dim)]
    `;

    const stateStyles = error
      ? 'focus:ring-red-500/20'
      : 'focus:ring-accent-500/15';

    const inputStyles = error
      ? { background: 'var(--color-input-bg)', border: '1px solid rgba(239,68,68,0.6)', color: 'var(--color-text)' }
      : { background: 'var(--color-input-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

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
            style={inputStyles}
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
