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
          red: '#E02020',
          'red-dark': '#B81414',
          'red-light': '#FF3B3B',
          'red-pale': '#FFF0F0',
          ink: '#111111',
          'ink-2': '#333333',
        },
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', 'sans-serif'],
        condensed: ['Barlow Condensed', 'sans-serif'],
      },
      boxShadow: {
        'red': '0 8px 32px rgba(224,32,32,0.22)',
      },
    },
  },
  plugins: [],
};
