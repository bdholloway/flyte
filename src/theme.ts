/**
 * Raw colour values for places that can't take a Tailwind class:
 * lucide icon `color`/`fill` props and react-native-svg fills/strokes.
 * Keep in sync with tailwind.config.js.
 */
export const colors = {
  background: "#080e1f",
  foreground: "#eef2f8",
  card: "#101929",
  primary: "#f5a623",
  primaryForeground: "#080e1f",
  secondary: "#1a2540",
  mutedForeground: "#7a8baa",
  border: "rgba(255, 255, 255, 0.08)",

  // Tailwind palette colours used directly in the UI
  emerald400: "#34d399",
  amber400: "#fbbf24",
  amber200: "#fde68a",
  sky400: "#38bdf8",
  slate400: "#94a3b8",
  red400: "#f87171",
  white: "#ffffff",
} as const;
