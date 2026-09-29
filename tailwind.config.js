/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.js", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#080e1f",
        foreground: "#eef2f8",
        card: "#101929",
        primary: "#f5a623",
        secondary: "#1a2540",
        "muted-foreground": "#7a8baa",
        border: "rgba(255, 255, 255, 0.08)",
      },
      fontFamily: {
        mono: ["monospace"],
      },
    },
  },
  plugins: [],
};
