/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
    './quasar.config.js',
    './node_modules/quasar/src/**/*.js',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  prefix: 'tw-'
}