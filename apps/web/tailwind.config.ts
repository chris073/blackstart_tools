import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bsl: {
          bg: "#07090C",
          panel: "#0C111A",
          panel2: "#0A0F17",
          text: "#E7EEF8",
          muted: "#9FB0C6",
          border: "rgba(255,255,255,0.08)",
          accent: "#7C3AED",
          accent2: "#22D3EE"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,58,237,0.25), 0 10px 40px rgba(124,58,237,0.18)"
      }
    }
  },
  plugins: []
} satisfies Config;

