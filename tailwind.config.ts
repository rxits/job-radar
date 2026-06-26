import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: { DEFAULT: "var(--surface)", raised: "var(--surface-raised)" },
        hairline: { DEFAULT: "var(--hairline)", strong: "var(--hairline-strong)" },
        ink: { DEFAULT: "var(--ink)", dim: "var(--ink-dim)", faint: "var(--ink-faint)" },
        accent: { DEFAULT: "var(--accent)", hover: "var(--accent-hover)", soft: "var(--accent-soft)" },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: { deck: "var(--ease-deck)" },
    },
  },
  plugins: [],
} satisfies Config;
