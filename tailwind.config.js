/** @type {import('tailwindcss').Config} */
// The field journal. The old dark-theme token names are kept and remapped to
// paper, ink and hairlines, so the demo labs written against them follow the
// new theme without edits.
// Theme colours come from CSS variables (src/index.css), so night mode is a
// swap of variables rather than a second set of classes.
const c = name => `rgb(var(--${name}-rgb) / <alpha-value>)`;

module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  mode: "jit",
  theme: {
    extend: {
      colors: {
        paper: c("paper"),
        raised: c("raised"),
        "ink-text": c("ink"),
        muted: c("muted"),
        hair: c("hair"),
        "hair-soft": c("hair-soft"),
        cobalt: c("cobalt"),
        magenta: c("magenta"),
        coral: c("coral"),
        gold: c("gold"),

        ink: c("paper"),
        panel: c("raised"),
        "panel-2": c("panel-2"),
        "panel-3": c("panel-3"),
        line: c("hair"),
        "line-soft": c("hair-soft"),
        fg: c("ink"),
        "fg-dim": c("ink-dim"),
        "fg-faint": c("muted"),
        amber: c("amber"),
        "amber-lo": c("amber-lo"),
        cyan: c("cobalt"),
        rose: c("magenta"),
        green: c("green"),
        primary: c("paper"),
        secondary: c("ink-dim"),
        tertiary: c("panel-3"),
        "black-100": c("raised"),
        "black-200": c("paper"),
        "white-100": c("ink"),
        "dark-mid": c("raised"),
        "contact-bg": c("paper"),
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
        card: "0 18px 50px -30px rgb(var(--shadow-rgb) / 0.35)",
        plate: "0 1px 0 rgb(var(--shadow-rgb) / 0.04), 0 22px 40px -32px rgb(var(--shadow-rgb) / 0.28)",
      },
      screens: { xs: "450px" },
    },
  },
  plugins: [],
};
