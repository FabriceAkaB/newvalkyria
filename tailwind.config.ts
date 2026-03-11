import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-ink)",
        surface: "var(--color-surface)",
        accent: "var(--color-accent)",
        "accent-soft": "var(--color-accent-soft)",
        mist: "var(--color-mist)"
      },
      boxShadow: {
        halo: "0 0 0 1px rgba(196, 164, 228, 0.25), 0 18px 40px rgba(16, 13, 25, 0.35)"
      },
      borderRadius: {
        soft: "1.25rem"
      }
    }
  },
  plugins: []
};

export default config;
