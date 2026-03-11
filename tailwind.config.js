// tailwind.config.js
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{html,js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        blob: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "25%": { transform: "translate(30px, -40px) scale(1.1)" },
          "50%": { transform: "translate(-20px, 20px) scale(0.95)" },
          "75%": { transform: "translate(20px, 30px) scale(1.05)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) scale(1)", opacity: "0.3" },
          "50%": { transform: "translateY(-30px) scale(1.3)", opacity: "0.6" },
        },
        aurora: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.5s ease-out forwards",
        blob: "blob 12s ease-in-out infinite",
        float: "float 8s ease-in-out infinite",
        aurora: "aurora 15s ease-in-out infinite",
      },
      fontFamily: {
        // Body default
        sans: ["var(--font-roboto-condensed)", "ui-sans-serif", "system-ui", "sans-serif"],
        // 🏁 Sporty headline stacks
        "exo2": ["var(--font-exo2)", "ui-sans-serif", "system-ui", "sans-serif"],
        "ubuntu-condensed": ["var(--font-ubuntu-condensed)", "ui-sans-serif", "system-ui", "sans-serif"],
        "noto-sans": ["var(--font-noto-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  };
