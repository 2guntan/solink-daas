import type { Config } from 'tailwindcss';
import { theme as solink } from '../../packages/ui/theme';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { primary: { DEFAULT: solink.primary, foreground: solink.primaryForeground }, accent: solink.accent },
      borderRadius: { lg: solink.radius },
    },
  },
  plugins: [],
} satisfies Config;
