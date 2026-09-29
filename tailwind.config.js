/** @type {import('tailwindcss').Config} */
// The field journal. The old dark-theme token names are kept and remapped to
// paper, ink and hairlines, so the demo labs written against them follow the
// new theme without edits.
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  mode: "jit",
  theme: {
    extend: {
      colors: {
        paper: "#F4EBDF",
        raised: "#FAF5EE",
        "ink-text": "#2E2826",
        muted: "#86796F",
        hair: "#D9CFC2",
        "hair-soft": "#E6DCCF",
        cobalt: "#1F2F9E",
        magenta: "#B3135C",
        coral: "#E0552F",
        gold: "#C98A22",

        ink: "#F4EBDF",
        panel: "#FAF5EE",
        "panel-2": "#F6EEE3",
        "panel-3": "#EFE5D8",
        line: "#D9CFC2",
        "line-soft": "#E6DCCF",
        fg: "#2E2826",
        "fg-dim": "#5E534C",
        "fg-faint": "#86796F",
        amber: "#C4502B",
        "amber-lo": "#D9A28C",
        cyan: "#1F2F9E",
        rose: "#B3135C",
        green: "#3F7A55",
        primary: "#F4EBDF",
        secondary: "#5E534C",
        tertiary: "#EFE5D8",
        "black-100": "#FAF5EE",
        "black-200": "#F4EBDF",
        "white-100": "#2E2826",
        "dark-mid": "#FAF5EE",
        "contact-bg": "#F4EBDF",
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["IBM Plex Sans", "system-ui", "-apple-system", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
        soft: "cubic-bezier(0.33, 1, 0.68, 1)",
      },
      boxShadow: {
        card: "0 18px 50px -30px rgba(46,40,38,0.35)",
        plate: "0 1px 0 rgba(46,40,38,0.04), 0 22px 40px -32px rgba(46,40,38,0.28)",
      },
      screens: { xs: "450px" },
    },
  },
  plugins: [],
};
