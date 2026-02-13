/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fdf8e8',
          100: '#faefc5',
          200: '#f5df8c',
          300: '#f0c94e',
          400: '#e8b420',
          500: '#d4960f',
          600: '#b7740a',
          700: '#92550c',
          800: '#794412',
          900: '#673815',
        },
        obsidian: {
          50: '#f4f3f2',
          100: '#e3e1de',
          200: '#c9c4be',
          300: '#a9a197',
          400: '#908578',
          500: '#7f7567',
          600: '#6c6157',
          700: '#584e48',
          800: '#4c433f',
          900: '#1a1714',
          950: '#0d0b09',
        },
        crimson: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#dc2626',
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#450a0a',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
