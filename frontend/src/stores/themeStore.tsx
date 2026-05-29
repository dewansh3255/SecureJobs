import { create } from 'zustand';
import { useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'light',
  isDark: false,
  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    set({ theme: newTheme, isDark: newTheme === 'dark' });
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    localStorage.setItem('theme', newTheme);
  },
  setTheme: (theme) => {
    set({ theme, isDark: theme === 'dark' });
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  },
}));

// Initialize theme from localStorage — default to light (LinkedIn-style is the primary design)
const initializeTheme = () => {
  const savedTheme = localStorage.getItem('theme') as Theme | null;
  // Default to light if no preference saved
  const initialTheme: Theme = savedTheme || 'light';

  document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  useThemeStore.setState({ theme: initialTheme, isDark: initialTheme === 'dark' });
};

// Theme provider component
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    initializeTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme) {
        const newTheme = e.matches ? 'dark' : 'light';
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        useThemeStore.setState({ theme: newTheme, isDark: newTheme === 'dark' });
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return <>{children}</>;
};

// Custom hook for using theme
export const useTheme = () => {
  const { theme, isDark, toggleTheme, setTheme } = useThemeStore();

  return {
    theme,
    isDark,
    toggleTheme,
    setTheme,
  };
};

// Theme toggle button component
export const ThemeToggle = () => {
  const { isDark, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover-shade"
      style={{
        border: '1px solid var(--color-border)',
        background: 'var(--color-card)',
        color: 'var(--color-muted)',
      }}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        /* Sun — shown in dark mode */
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        /* Moon — shown in light mode */
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
};

export default useThemeStore;
