// Day (the paper journal) or night (dark water, for sitting with raly). The
// choice is remembered on this device; index.html applies it before the first
// paint so the page never flashes the other one. Canvases that paint their
// own colors (the headline, the plate wall, the sunlit floor) read it too.

const KEY = "theme";
const BAR = { light: "#F4EBDF", dark: "#0E131B" };

export const isDark = () => document.documentElement.dataset.theme === "dark";

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR[theme]);
  try { localStorage.setItem(KEY, theme); } catch { /* no storage */ }
  dispatchEvent(new Event("themechange"));
}

/** Calls `fn(dark)` now and on every change; returns an unsubscribe. */
export function onTheme(fn) {
  const changed = () => fn(isDark());
  addEventListener("themechange", changed);
  changed();
  return () => removeEventListener("themechange", changed);
}
