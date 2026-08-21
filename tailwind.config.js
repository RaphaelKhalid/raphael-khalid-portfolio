/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  mode: "jit",
  theme: {
    extend: {
      colors: {
        ink: "#07080B",
        panel: "#0E1015",
        "panel-2": "#14171E",
        "panel-3": "#1A1E26",
        line: "#242833",
        "line-soft": "#191C24",
        fg: "#E9EAEF",
        "fg-dim": "#959BA8",
        "fg-faint": "#5B606C",
        amber: "#F2A03D",
        "amber-lo": "#8A5F27",
        cyan: "#4FB6D6",
        rose: "#D9756A",
        green: "#79C08E",
        // kept so existing markup keeps compiling while sections are migrated
        primary: "#07080B",
        secondary: "#959BA8",
        tertiary: "#14171E",
        "black-100": "#0E1015",
        "black-200": "#07080B",
        "white-100": "#E9EAEF",
        "dark-mid": "#0E1015",
        "contact-bg": "#0A0C10",
      },
      fontFamily: {
        display: ["Archivo Expanded", "Archivo", "system-ui", "sans-serif"],
        sans: ["IBM Plex Sans", "system-ui", "-apple-system", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
        soft: "cubic-bezier(0.33, 1, 0.68, 1)",
      },
      boxShadow: {
        card: "0 24px 80px -24px rgba(0,0,0,0.8)",
      },
      screens: { xs: "450px" },
    },
  },
  plugins: [],
};
