/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'gradient-start': '#FF6B6B',
        'gradient-end': '#FFD93D'
      }
    },
  },
  plugins: [],
};
