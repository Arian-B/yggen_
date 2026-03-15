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
        'yggen-teal': '#00ADB5',
        'yggen-dim-teal': 'rgba(0, 173, 181, 0.1)',
        'yggen-black': '#050505',
        'yggen-grid': '#1a1a1a',
      },
      backgroundImage: {
        'grid-pattern': "radial-gradient(#1a1a1a 1px, transparent 1px)",
      },
      backgroundSize: {
        'grid-sm': '20px 20px',
      }
    },
  },
  plugins: [],
}
