/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Spatial Dark — primary accent (purple)
        accent: {
          50:  '#f3f1ff',
          100: '#e9e5ff',
          200: '#d5cfff',
          300: '#b7aaff',
          400: '#9d94f0',
          500: '#7c6fe0', // primary
          600: '#6b5fd0',
          700: '#5a4fc0',
          800: '#4a40a0',
          900: '#3a3080',
          950: '#1e1a50',
        },
        // Spatial accent 2 (pink)
        accent2: {
          400: '#f08dd0',
          500: '#e06fbc',
          600: '#c85aa8',
        },
        // LinkedIn kept for backward compat (maps to accent purple now)
        linkedin: {
          50:  '#f3f1ff',
          100: '#e9e5ff',
          200: '#d5cfff',
          300: '#b7aaff',
          400: '#9d94f0',
          500: '#7c6fe0',
          600: '#6b5fd0',
          700: '#5a4fc0',
          800: '#4a40a0',
          900: '#3a3080',
        },
        // Reaction colors
        reaction: {
          like:       '#7c6fe0',
          celebrate:  '#e0b86f',
          support:    '#6fe0a0',
          love:       '#e06fbc',
          insightful: '#6fcde0',
          curious:    '#f97316',
        },
        // Spatial Dark palette
        dark: {
          50:  '#f3f3f8',
          100: '#e8e8f0',
          200: '#c8c8d8',
          300: '#9898b8',
          400: '#6a6a8a',
          500: '#4a4a6a',
          600: '#2d2d50',
          700: '#1f1f38',
          750: '#1a1a2e',
          800: '#13131f',
          850: '#0e0e18',
          900: '#0c0c14',
          950: '#060608',
        },
        // Border
        border: 'rgba(255,255,255,0.07)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in':       'fadeIn 0.3s ease-in-out',
        'slide-up':      'slideUp 0.4s ease-out',
        'slide-down':    'slideDown 0.4s ease-out',
        'slide-in-right':'slideInRight 0.3s ease-out',
        'scale-in':      'scaleIn 0.2s ease-out',
        'pulse-slow':    'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounceSubtle 0.5s ease-in-out infinite',
        'spin-slow':     'spin 3s linear infinite',
        'ambient-drift': 'ambientDrift 20s ease-in-out infinite alternate',
        'ambient-drift2':'ambientDrift 22s ease-in-out infinite alternate-reverse',
      },
      keyframes: {
        fadeIn:       { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:      { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideDown:    { '0%': { transform: 'translateY(-20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideInRight: { '0%': { transform: 'translateX(20px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        scaleIn:      { '0%': { transform: 'scale(0.95)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        bounceSubtle: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
        ambientDrift: { '0%': { transform: 'translate(0,0) scale(1)' }, '100%': { transform: 'translate(40px,30px) scale(1.06)' } },
      },
      boxShadow: {
        'soft':    '0 2px 15px -3px rgba(0,0,0,0.3), 0 10px 20px -2px rgba(0,0,0,0.2)',
        'soft-lg': '0 10px 40px -10px rgba(0,0,0,0.5), 0 20px 25px -5px rgba(0,0,0,0.3)',
        'glow':    '0 0 24px rgba(124,111,224,0.35)',
        'glow-sm': '0 0 12px rgba(124,111,224,0.25)',
        'card':    '0 4px 24px rgba(0,0,0,0.4)',
      },
      backdropBlur: {
        'xs': '4px',
      },
      spacing: {
        '18':  '4.5rem',
        '68':  '17rem',
        '88':  '22rem',
        '100': '25rem',
        '112': '28rem',
        '128': '32rem',
      },
    },
  },
  plugins: [],
}
