import type { Config } from "tailwindcss";

/**
 * Candor design tokens — a dark "research terminal" system.
 * OLED-deep backgrounds, electric blue→violet→cyan intelligence accents,
 * emerald/rose financial semantics, amber for attention/confidence.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base surfaces (near-black with a cold blue tint)
        void: "#05070C",
        ink: "#080B12",
        panel: "#0B0F1A",
        "panel-2": "#0F1524",
        raised: "#131A2B",
        line: "#1B2436",
        "line-soft": "#161E2E",

        // Text ramp
        fg: "#E8EDF6",
        "fg-dim": "#A7B2C8",
        "fg-muted": "#6B7890",
        "fg-faint": "#48546B",

        // Intelligence accents
        accent: {
          DEFAULT: "#5B8CFF",
          soft: "#8AA7FF",
          deep: "#3B63E0",
        },
        violet: {
          DEFAULT: "#9A6BFF",
          soft: "#B79BFF",
        },
        cyan: {
          DEFAULT: "#3DE0E6",
          soft: "#7BEEF2",
        },

        // Financial + status semantics
        bull: "#34D399",
        bear: "#FB6A7E",
        amber: "#FBBF24",
        warn: "#F59E0B",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(91,140,255,0.25), 0 0 32px -4px rgba(91,140,255,0.45)",
        "glow-violet": "0 0 0 1px rgba(154,107,255,0.25), 0 0 32px -4px rgba(154,107,255,0.45)",
        "glow-cyan": "0 0 0 1px rgba(61,224,230,0.22), 0 0 30px -6px rgba(61,224,230,0.4)",
        "glow-bull": "0 0 24px -6px rgba(52,211,153,0.55)",
        "glow-bear": "0 0 24px -6px rgba(251,106,126,0.55)",
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -30px rgba(0,0,0,0.9)",
        "panel-lg": "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 40px 90px -40px rgba(0,0,0,0.95)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, transparent, #05070C 78%), radial-gradient(circle at 50% 0%, rgba(91,140,255,0.08), transparent 60%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "gradient-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        blink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "scan-y": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(400%)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
        "aurora-drift": {
          "0%": { transform: "translate3d(-6%, -2%, 0) rotate(0deg)" },
          "50%": { transform: "translate3d(6%, 3%, 0) rotate(8deg)" },
          "100%": { transform: "translate3d(-6%, -2%, 0) rotate(0deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 2.2s linear infinite",
        "gradient-pan": "gradient-pan 6s ease infinite",
        float: "float 6s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.4s ease-out infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        blink: "blink 1.1s step-end infinite",
        marquee: "marquee 40s linear infinite",
        "scan-y": "scan-y 3.6s ease-in-out infinite",
        "spin-slow": "spin-slow 14s linear infinite",
        "aurora-drift": "aurora-drift 24s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
