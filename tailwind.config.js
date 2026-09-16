/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: { md: { raw: '(min-width: 768px) and (min-height: 500px)' } },
    extend: {
      colors: { brand: {
        bg: '#0b1220', panel: '#131c2e', soft: '#1b2740', line: 'rgba(255,255,255,.09)',
        text: '#e8edf5', dim: '#8a97ad', accent: '#10b981', 'accent-soft': '#34d399',
        'accent-2': '#fbbf24', danger: '#e0524d',
      } },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Manrope', 'sans-serif'], mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
