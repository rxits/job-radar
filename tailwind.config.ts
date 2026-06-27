import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: { DEFAULT: "var(--surface)", raised: "var(--surface-raised)" },
        hairline: { DEFAULT: "var(--hairline)", strong: "var(--hairline-strong)" },
        ink: { DEFAULT: "var(--ink)", dim: "var(--ink-dim)", faint: "var(--ink-faint)" },
        accent: { DEFAULT: "var(--accent)", hover: "var(--accent-hover)", soft: "var(--accent-soft)" },
        positive: { DEFAULT: "var(--positive)", soft: "var(--positive-soft)" },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "soft-sm": "var(--shadow-sm)",
        "soft-md": "var(--shadow-md)",
        "soft-lg": "var(--shadow-lg)",
      },
      transitionTimingFunction: { deck: "var(--ease-deck)" },
    },
  },
  plugins: [],
} satisfies Config;
