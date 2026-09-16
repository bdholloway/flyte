/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.js", "./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#080e1f",
        foreground: "#eef2f8",
        card: "#101929",
        "card-foreground": "#eef2f8",
        popover: "#101929",
        "popover-foreground": "#eef2f8",
        primary: "#f5a623",
        "primary-foreground": "#080e1f",
        secondary: "#1a2540",
        "secondary-foreground": "#eef2f8",
        muted: "#1a2540",
        "muted-foreground": "#7a8baa",
        accent: "#f5a623",
        "accent-foreground": "#080e1f",
        destructive: "#e05a4e",
        border: "rgba(255, 255, 255, 0.08)",
        input: "#1a2540",
      },
      fontFamily: {
        mono: ["monospace"],
      },
    },
  },
  plugins: [],
};
