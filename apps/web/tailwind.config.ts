import type { Config } from 'tailwindcss';
import { theme as solink } from '../../packages/ui/theme';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: solink.primary, foreground: solink.primaryForeground },
        accent: solink.accent,
        background: solink.background,
        surface: solink.surface,
        // Une seule échelle de gris pour toute l'application.
        neutral: solink.neutral,
        gray: solink.neutral,
        slate: solink.neutral,
      },
      borderColor: { DEFAULT: solink.neutral[200] },
      borderRadius: { md: '8px', lg: solink.radius, xl: '12px', '2xl': solink.radiusCard, '3xl': '24px' },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.03), 0 0 0 1px rgba(0,0,0,0.04)',
        pop: '0 12px 32px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
      },
      letterSpacing: { tightest: '-0.03em' },
      transitionTimingFunction: { apple: 'cubic-bezier(0.25, 0.1, 0.25, 1)' },
      keyframes: { 'fade-up': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } } },
      animation: { 'fade-up': 'fade-up 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) both' },
    },
  },
  plugins: [],
} satisfies Config;
