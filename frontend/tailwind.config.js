/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0b0e',
          800: '#12141c',
          700: '#1a1d28',
          600: '#252938',
          500: '#343a4e',
        },
        brand: {
          red: '#e50914',
          coral: '#ff4d5a',
          purple: '#8b5cf6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
