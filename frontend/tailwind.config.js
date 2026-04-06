/** @type {import('tailwindcss').Config} */
export default {
  // Scan all source files for class names
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Custom animation for the typing indicator (pulsing dots)
      keyframes: {
        bounce: {
          "0%, 80%, 100%": { transform: "scale(0)" },
          "40%": { transform: "scale(1)" },
        },
      },
      animation: {
        "typing-dot": "bounce 1.4s infinite ease-in-out",
      },
      // Custom font family using Inter from Google Fonts (loaded in index.html)
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
