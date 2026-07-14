/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        orange: {
          50:  '#FDF0E8',
          100: '#FAD9C0',
          200: '#F5A96B',
          300: '#F08035',
          400: '#E8600A',
          500: '#C45208',
          600: '#9E4106',
          700: '#7A3205',
          800: '#582403',
          900: '#381602',
        },
      },
      fontFamily: {
        sans: ['Sarabun', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
