/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        "drop-shadow-500": "var(--drop-shadow-500)",
      },
    },
  },
  plugins: [],
};
