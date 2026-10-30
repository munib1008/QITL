import type { Config } from "tailwindcss";
import { TOKENS } from "./src/styles/tokens.generated";

/** Every Tailwind value maps to a CSS variable from tokens.css, so themes switch with [data-theme]. */
const v = (names: readonly string[], strip = "") =>
  Object.fromEntries(names.map((n) => [n.replace(strip, ""), `var(--${n})`]));

export const qitlPreset: Partial<Config> = {
  theme: {
    screens: { sm: TOKENS.breakpoints.sm, md: TOKENS.breakpoints.md, lg: TOKENS.breakpoints.lg, xl: TOKENS.breakpoints.xl },
    extend: {
      colors: v(TOKENS.colors),
      spacing: v(TOKENS.spacing, "space-"),
      borderRadius: v(TOKENS.radius, "radius-"),
      boxShadow: v(TOKENS.shadows, "shadow-"),
      zIndex: v(TOKENS.zIndex, "z-"),
      fontFamily: Object.fromEntries(TOKENS.families.map((f) => [f, `var(--font-${f})`])),
      maxWidth: { reading: "var(--measure-reading)", arabic: "var(--measure-arabic)" },
    },
  },
};

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [qitlPreset as Config],
  corePlugins: { preflight: true },
};
export default config;
