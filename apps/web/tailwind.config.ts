import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ROYA identity — Roya Blue. Re-pointed from the previous emerald
        // scale to the new brand palette so all existing `brand-*` usages
        // (~420 across the app) re-skin to Roya Blue with zero call-site
        // changes. Values mirror the brand guide's `--primary-*` scale.
        brand: {
          50: '#F2F7FF',
          100: '#E3ECF9',
          200: '#CCD8EC',
          300: '#A2BCE5',
          400: '#6A98E4',
          500: '#3E77D6',
          600: '#285FB9',
          700: '#0D47A1', // Roya Blue — the primary brand color
          800: '#1E3C6C',
          900: '#1B2E4C',
          950: '#121B28',
        },
        // Warm gold/sand accent (the "ومضة" in the mark + Nusuk-card warmth).
        accent: {
          50: '#FFF6E6',
          100: '#FEE8C4',
          200: '#F3D29C',
          300: '#E1B25F',
          400: '#C28E25',
          500: '#9A7326',
        },
      },
    },
  },
  plugins: [],
};

export default config;
