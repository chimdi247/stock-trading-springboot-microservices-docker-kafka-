/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: { 950: '#070b14', 900: '#0b1220', 850: '#0f1829', 800: '#131e33', 700: '#1b2942', 600: '#26374f' },
        brand: { 400: '#5eead4', 500: '#2dd4bf', 600: '#14b8a6' },
        gain: '#22c55e',
        loss: '#ef4444',
      },
      boxShadow: { glow: '0 0 0 1px rgba(45,212,191,.25), 0 8px 30px -8px rgba(45,212,191,.25)' },
      keyframes: {
        flashUp: { '0%': { backgroundColor: 'rgba(34,197,94,.35)' }, '100%': { backgroundColor: 'transparent' } },
        flashDown: { '0%': { backgroundColor: 'rgba(239,68,68,.35)' }, '100%': { backgroundColor: 'transparent' } },
        slideIn: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      },
      animation: { flashUp: 'flashUp 0.9s ease-out', flashDown: 'flashDown 0.9s ease-out', slideIn: 'slideIn .25s ease-out' },
    },
  },
  plugins: [],
}
