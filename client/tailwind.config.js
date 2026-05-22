/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0d0f14",
          2: "#13161e",
          3: "#1a1e28",
        },
        border: {
          DEFAULT: "#252a38",
          light: "#2e3447",
        },
        accent: {
          DEFAULT: "#4f7cff",
          hover: "#6b91ff",
        },
        success: "#34d399",
        danger: "#f87171",
        warning: "#fbbf24",
        muted: {
          DEFAULT: "#8b91a8",
          2: "#5a6075",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "10px",
        sm: "6px",
        xl: "16px",
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease both",
        "fade-in": "fadeIn 0.3s ease both",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};