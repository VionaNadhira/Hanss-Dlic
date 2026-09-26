/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gamdom: {
          bg: "#080d13",
          surface: "#10151c",
          card: "#10151c",
          cardHover: "#141a22",
          dark: "#080d13",
          input: "#141a22",
          sidebar: "#10151c",
          header: "#10151c",
          border: "#19212a",
          borderLight: "#2b3440",
          green: "#38B9F2",
          greenHover: "#6FD0F7",
          gold: "#fbb01b",
          goldHover: "#ffc74d",
          red: "#ff4d4f",
          purple: "#9B51E0",
          blue: "#38B9F2",
          text: "#9aa7b4",
          textLight: "#FFFFFF",
          textDim: "#6f7d8a",
          lime: "#38B9F2"
        }
      },
      fontFamily: {
        sans: ["var(--font-dlicom)", "Inter", "system-ui", "sans-serif"],
        heading: ["var(--font-dlicom)", "Inter", "sans-serif"]
      },
      boxShadow: {
        'gamdom-green': '0 0 20px -3px rgba(56, 185, 242, 0.45)',
        'gamdom-gold': '0 0 20px -3px rgba(251, 176, 27, 0.35)',
        'gamdom-card': '0 8px 30px -4px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
