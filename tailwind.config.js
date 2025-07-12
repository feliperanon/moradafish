/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'sm': '480px',       // Mobile
        'md': '768px',       // Tablet
        'lg': '1024px',      // Desktop
        'xl': '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [],
}
