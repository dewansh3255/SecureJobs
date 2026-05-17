import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Delete } from 'lucide-react';

interface VirtualKeypadProps {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}

/** Randomized virtual numpad for TOTP entry — defeats keyloggers. */
export default function VirtualKeypad({ value, onChange, maxLength = 6 }: VirtualKeypadProps) {
  // Shuffle 0–9 on every mount (re-shuffles if component remounts after wrong code)
  const [shuffled, setShuffled] = useState<number[]>(() => shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]));

  const reshuffle = useCallback(() => setShuffled(shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 0])), []);

  // Reshuffle on wrong attempt (if value cleared from outside)
  useEffect(() => {
    if (value === '') reshuffle();
  }, [value, reshuffle]);

  const press = (digit: number) => {
    if (value.length < maxLength) onChange(value + digit);
  };

  const backspace = () => onChange(value.slice(0, -1));

  // Arrange in 3×3 + bottom row
  const rows = useMemo(() => [
    shuffled.slice(0, 3),
    shuffled.slice(3, 6),
    shuffled.slice(6, 9),
    [shuffled[9]], // last digit
  ], [shuffled]);

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-2">
          {row.map((digit) => (
            <motion.button
              key={digit}
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={() => press(digit)}
              disabled={value.length >= maxLength}
              className="w-16 h-14 rounded-xl font-bold text-lg transition-all duration-150 focus:outline-none"
              style={{
                background: 'rgba(26,26,46,0.7)',
                border: '1px solid rgba(124,111,224,0.25)',
                color: 'var(--color-text)',
                cursor: value.length >= maxLength ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => {
                if (value.length < maxLength)
                  (e.currentTarget as HTMLElement).style.background = 'rgba(124,111,224,0.18)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(26,26,46,0.7)';
              }}
            >
              {digit}
            </motion.button>
          ))}
          {/* Backspace on last row */}
          {ri === rows.length - 1 && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={backspace}
              disabled={value.length === 0}
              className="w-16 h-14 rounded-xl flex items-center justify-center transition-all duration-150 focus:outline-none"
              style={{
                background: 'rgba(26,26,46,0.5)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'var(--color-muted)',
              }}
            >
              <Delete className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      ))}

      {/* Reshuffle hint */}
      <button
        type="button"
        onClick={reshuffle}
        className="mt-1 text-xs hover:underline focus:outline-none"
        style={{ color: 'var(--color-dim)' }}
      >
        Shuffle keys
      </button>
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
