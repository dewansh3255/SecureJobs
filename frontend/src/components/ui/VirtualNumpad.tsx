/**
 * VirtualNumpad
 * Secure randomised on-screen numpad for TOTP entry.
 * Digit positions are shuffled once on mount to prevent shoulder-surfing
 * and defeat automated screen-capture attacks that infer digits from
 * the spatial position of taps.
 */

import { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';

interface VirtualNumpadProps {
  value: string;
  onChange: (val: string) => void;
  maxLength?: number;
  disabled?: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function VirtualNumpad({
  value,
  onChange,
  maxLength = 6,
  disabled = false,
}: VirtualNumpadProps) {
  // Shuffle once per mount — same layout for the whole session
  const digits = useMemo(() => shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), []);

  const press = useCallback(
    (d: number) => {
      if (disabled || value.length >= maxLength) return;
      onChange(value + String(d));
    },
    [disabled, value, maxLength, onChange]
  );

  const backspace = useCallback(() => {
    if (disabled) return;
    onChange(value.slice(0, -1));
  }, [disabled, value, onChange]);

  const clear = useCallback(() => {
    if (disabled) return;
    onChange('');
  }, [disabled, onChange]);

  const btnBase =
    'flex items-center justify-center w-full aspect-square rounded-xl text-xl font-bold ' +
    'transition-all duration-100 select-none outline-none ' +
    'bg-white dark:bg-dark-700 border-2 border-gray-200 dark:border-dark-600 ' +
    'text-gray-900 dark:text-white shadow-sm ' +
    'hover:border-linkedin-400 hover:bg-linkedin-50 dark:hover:bg-dark-600 ' +
    'active:scale-95 active:border-linkedin-600 active:bg-linkedin-100 dark:active:bg-dark-500 ' +
    'focus:ring-2 focus:ring-linkedin-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-dark-800 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100';

  const altBtnBase =
    'flex items-center justify-center w-full aspect-square rounded-xl text-base font-semibold ' +
    'transition-all duration-100 select-none outline-none ' +
    'bg-gray-100 dark:bg-dark-600 border-2 border-gray-200 dark:border-dark-500 ' +
    'text-gray-500 dark:text-gray-300 shadow-sm ' +
    'hover:border-gray-400 hover:bg-gray-200 dark:hover:bg-dark-500 ' +
    'active:scale-95 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="w-full max-w-[17rem] mx-auto space-y-4">
      {/* Digit display — dots, not actual digits */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: maxLength }).map((_, i) => (
          <motion.div
            key={i}
            animate={i < value.length ? { scale: [1, 1.25, 1] } : { scale: 1 }}
            transition={{ duration: 0.15 }}
            className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${
              i < value.length
                ? 'border-linkedin-500 bg-linkedin-50 dark:bg-linkedin-900/20'
                : 'border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-800'
            }`}
          >
            {i < value.length && (
              <div className="w-3 h-3 rounded-full bg-linkedin-600 dark:bg-linkedin-400" />
            )}
          </motion.div>
        ))}
      </div>

      {/* 3 × 4 grid: first 9 shuffled digits, then [CLR] [10th digit] [⌫] */}
      <div className="grid grid-cols-3 gap-2">
        {digits.slice(0, 9).map((d) => (
          <button
            key={`digit-${d}`}
            type="button"
            onClick={() => press(d)}
            disabled={disabled || value.length >= maxLength}
            className={btnBase}
            aria-label={`Digit ${d}`}
          >
            {d}
          </button>
        ))}

        {/* Bottom row */}
        <button
          type="button"
          onClick={clear}
          disabled={disabled || value.length === 0}
          className={altBtnBase + ' text-red-500 dark:text-red-400'}
          aria-label="Clear all"
        >
          CLR
        </button>

        <button
          key={`digit-${digits[9]}`}
          type="button"
          onClick={() => press(digits[9])}
          disabled={disabled || value.length >= maxLength}
          className={btnBase}
          aria-label={`Digit ${digits[9]}`}
        >
          {digits[9]}
        </button>

        <button
          type="button"
          onClick={backspace}
          disabled={disabled || value.length === 0}
          className={altBtnBase}
          aria-label="Backspace"
        >
          ⌫
        </button>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        🔀 Keys randomly shuffled for your security
      </p>
    </div>
  );
}
