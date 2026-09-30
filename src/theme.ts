/**
 * Raw colour values for places that can't take a Tailwind class:
 * lucide icon `color`/`fill` props and react-native-svg fills/strokes.
 * Keep in sync with tailwind.config.js.
 */
export const colors = {
  background: "#080e1f",
  primary: "#f5a623",
  mutedForeground: "#7a8baa",

  // Tailwind palette colours used directly in the UI
  emerald400: "#34d399",
  amber400: "#fbbf24",
  sky400: "#38bdf8",
  slate400: "#94a3b8",
  red400: "#f87171",
} as const;
