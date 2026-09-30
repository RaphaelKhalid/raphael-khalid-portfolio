// raly as a guide: it swims the visitor through the page, stopping at each
// section. A hairline mark draws itself around the thing raly is showing, with
// a museum-style caption beside it, and raly circles nearby. At the demos it
// selects the Waymo simulation and presses Play.
//
// Any real input (a scroll, a key, a click, a touch) ends the tour at once and
// hands the page back.

const WAYMO_ORIGIN = "https://waymoemergencyresponsedemo.vercel.app";
const $ = selector => document.querySelector(selector);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Each step: where to scroll, what to mark, where raly waits (from the mark's
// rect), what the caption says, and anything raly does there.
const STEPS = [
  {
    mark: () => $("#top h1"),
    near: r => [r.right - r.width * 0.2, r.bottom + 40],
    say: "i'm raly. let me show you around.",
    ms: 5200,
  },
  {
    scroll: ['nav[aria-label="Demos"]', 150],
    mark: () => $('[data-demo="waymo"]'),
    near: r => [r.right + 90, r.top + 10],
    say: "first, a live one: the waymo emergency response",
    ms: 3400,
    act: tour => tour.tap($('[data-demo="waymo"]'), 0.5, 0.5, el => el.getAttribute("aria-pressed") !== "true" && el.click()),
  },
  {
    scroll: [".panel-demo", 70],
    mark: () => $('iframe[src^="' + WAYMO_ORIGIN + '"]'),
    near: r => [r.left - 40, r.top + 140],
    say: "pressing play: 72 hours of a hijacked fleet",
    ms: 8200,
    act: tour => tour.pressWaymo(),
  },
  {
    scroll: [".plate", 190],
    mark: () => $(".plate"),
    // Waits in the open paper above the plate, right of the section's text.
    near: r => [r.right - r.width * 0.22, r.top - 90],
    say: "projects: autolabs first, then the rest of the work",
    ms: 5200,
  },
  {
    scroll: "#experience",
    mark: () => $("#experience")?.parentElement?.querySelector("h2"),
    near: r => [r.right + 160, r.top + 30],
    say: "experience: where he has worked",
    ms: 4400,
  },
  {
    scroll: "#photographs",
    mark: () => $('[data-photo="2"]'),
    near: r => [r.right + 120, r.top - 30],
    say: "photography: his pictures",
    ms: 6400,
    act: tour => {
      // Bring a print to the middle of the strip, open it, then put it back.
      const strip = $("#photo-strip"), print = $('[data-photo="2"]');
      if (!strip || !print) return;
      strip.scrollTo({ left: print.offsetLeft - (strip.clientWidth - print.offsetWidth) / 2, behavior: "smooth" });
      tour.later(900, () => tour.tap(print.querySelector("button"), 0.5, 0.5, el => el.click()));
      tour.later(4400, () => dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    },
  },
  {
    scroll: "#contact",
    mark: () => $("#contact")?.parentElement?.querySelector("form") || $("#sunlit-floor"),
    near: r => [r.right + 80, r.top + 60],
    say: "and if you'd like to say hello, it starts here",
    ms: 5200,
  },
];

// Captions appear in raly's own doodled speech bubble (bubble.js), beside
// the marked thing with the tail pointing at it.
export function createTour({ getEngine, mark, bubble, bubbleEl, tapRing, onChange }) {
  let active = false, step = -1, stepTimer = 0, timers = [];
  const guide = { x: innerWidth * 0.7, y: innerHeight * 0.5, ready: false };
  let placement = 'up';

  // Headings are block-wide; the mark hugs their text instead.
  function bounds(el) {
    if (!/^H[23]$/.test(el.tagName)) return el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect();
  }

  function later(ms, fn) { timers.push(setTimeout(() => active && fn(), ms)); }

  // A step scrolls to a selector (to a section's anchor), or to [selector, gap
  // above it] to land on something inside a section.
  function scrollToSection(target) {
    const [selector, gap] = Array.isArray(target) ? target : [target, 20];
    const el = $(selector);
    if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + scrollY - gap), behavior: "smooth" });
  }

  // A small ring where raly "presses", then the press itself.
  function tap(el, fx, fy, then, dx = 0, dy = 0) {
    if (!el) return;
    later(900, () => {
      const r = el.getBoundingClientRect();
      const x = dx ? r.left + dx : r.left + r.width * fx, y = dy ? r.top + dy : r.top + r.height * fy;
      tapRing.style.transform = `translate3d(${x - 18}px, ${y - 18}px, 0)`;
      tapRing.classList.remove("on"); void tapRing.offsetWidth; tapRing.classList.add("on");
      guide.x = x; guide.y = y;
      then?.(el);
    });
  }

  // The Waymo replay listens for a play message from its host page; it is
  // cross-origin, so this is the only way in. Sent a few times while it loads.
  function pressWaymo() {
    const find = () => $('iframe[src^="' + WAYMO_ORIGIN + '"]');
    tap(find(), 0, 0, () => {
      for (let k = 0; k < 8; k++) later(k * 600, () => find()?.contentWindow?.postMessage({ type: "replay:play" }, WAYMO_ORIGIN));
    }, 84, 84);
  }

  const api = { tap, later, pressWaymo };

  function go(i) {
    clearTimeout(stepTimer);
    step = i;
    if (i >= STEPS.length) return stop(true);
    const s = STEPS[i];
    mark.classList.remove("on");
    bubble.hide();
    onChange?.({ active: true, step: i, total: STEPS.length });
    const settle = s.scroll ? 1100 : 250;
    if (s.scroll) scrollToSection(s.scroll);
    later(settle, () => {
      // Below the marked thing if there is room, otherwise above it.
      const el = s.mark();
      const r = el ? bounds(el) : { bottom: 0 };
      placement = r.bottom + 150 < innerHeight ? 'up' : 'down';
      bubble.say(s.say, { tail: placement });
      mark.classList.add("on");
      s.act?.(api);
    });
    stepTimer = setTimeout(() => active && go(i + 1), settle + s.ms);
  }

  function start() {
    if (active) return;
    active = true; guide.ready = false;
    document.documentElement.classList.add("raly-touring");
    getEngine()?.setPace(1.9);
    go(0);
  }

  function stop(finished = false) {
    if (!active) return;
    active = false;
    clearTimeout(stepTimer); timers.forEach(clearTimeout); timers = [];
    mark.classList.remove("on");
    bubble.hide();
    document.documentElement.classList.remove("raly-touring");
    getEngine()?.setPace(1);
    getEngine()?.setPointer(null);
    try { localStorage.setItem("raly-toured", "1"); } catch { /* storage may be unavailable */ }
    onChange?.({ active: false, finished });
  }

  // Called every frame by raly's layer: keeps the mark on its element and
  // leads raly toward its waiting spot.
  function frame() {
    if (!active) return;
    const s = STEPS[step];
    const el = s?.mark();
    const engine = getEngine();
    if (!el || !engine) return;
    const r = bounds(el);
    const pad = 10;
    mark.style.transform = `translate3d(${r.left - pad}px, ${r.top - pad}px, 0)`;
    mark.style.width = `${r.width + pad * 2}px`;
    mark.style.height = `${r.height + pad * 2}px`;
    // The bubble sits under the mark (tail up) or over it (tail down).
    if (bubble.visible) {
      bubble.frame(performance.now());
      const w = bubbleEl.offsetWidth, h = bubbleEl.offsetHeight;
      const bx = clamp(r.left + 4, 12, innerWidth - w - 40);
      const by = clamp(placement === 'up' ? r.bottom + pad + 26 : r.top - pad - h - 26, 80, innerHeight - h - 28);
      bubbleEl.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0)`;
    }
    const [nx, ny] = s.near(r);
    const tx = clamp(nx, 60, innerWidth - 60), ty = clamp(ny, 110, innerHeight - 60);
    if (!guide.ready) { guide.x = tx; guide.y = ty; guide.ready = true; }
    guide.x += (tx - guide.x) * 0.05; guide.y += (ty - guide.y) * 0.05;
    engine.setPointer(guide.x, guide.y);
  }

  return {
    start, stop, frame,
    get active() { return active; },
  };
}
