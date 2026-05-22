/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1C75BC',
          'blue-dark': '#14507F',
          'blue-light': '#29ABE2',
          'blue-pale': '#EAF4FB',
          ink: '#0F1B3C',
          'ink-2': '#2A3556',
        },
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', 'sans-serif'],
        condensed: ['Barlow Condensed', 'sans-serif'],
      },
      boxShadow: {
        'blue': '0 8px 32px rgba(28,117,188,0.28)',
      },
    },
  },
  plugins: [],
};
