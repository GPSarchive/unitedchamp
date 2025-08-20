// tailwind.config.js
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{html,js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      keyframes: { fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } } },
      animation: { fadeIn: "fadeIn 0.5s ease-out forwards" },
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
  plugins: [require("@tailwindcss/line-clamp")],
};
