/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#D40029',
          700: '#B80023',
          800: '#9A001D',
          900: '#7F0018',
        },
        ace: {
          red: '#D40029',
          darkred: '#B80023',
          black: '#1a1a1a',
          gray: '#333333',
        },
      },
    },
  },
  plugins: [],
}
