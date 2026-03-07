/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette
        "gray":        "#04080f",   // page background
        "red":         "#ec0000",   // accent / border
        "mintcream":   "#f7fff7",   // navbar background, light text
        "black":       "#000",
        "crimson":     "#ff1654",   // "MEET OBT" link
        "yellow":      "#fff700",   // accent button
        "white":       "#fff",
        "mediumblue":  "#3b28cc",   // CTA button
        "gainsboro":   "#d9d9d9",   // placeholder card background
      },
      fontFamily: {
        "base-neue-trial": ["Base Neue Trial", "sans-serif"],
      },
      padding: {
        "num-0":  "0px",
        "num-30": "30px",
      },
    },
    fontSize: {
      "num-24": "24px",
    },
  },
  corePlugins: {
    preflight: false,
  },
};
