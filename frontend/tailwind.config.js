/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  corePlugins: {
    // Не трогаем глобальные стили приложения (theme.css, app-layout.css)
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
