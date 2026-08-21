// One requestAnimationFrame loop for every decorative card canvas on the page.
//
// Before this, ProjectAnim mounted its own rAF per card — seventeen independent
// loops, all running whether or not the card was on screen, and all running in
// a background tab. Each browser rAF callback carries fixed overhead, so N loops
// cost meaningfully more than one loop doing N draws.
//
// Decorative texture does not need 60fps. Halving to 30 halves the draw work and
// is imperceptible on slow-moving blobs — the demos get the other half.

const subscribers = new Set();
const FRAME_MS = 1000 / 30;
let raf = 0;
let last = 0;

// Work per frame is budgeted, not unbounded. Drawing every visible card in one
// callback is what produced the 33ms spikes: six cards x a full-canvas fill
// does not fit in a frame on a modest GPU. Instead we draw round-robin until
// the budget is spent and resume where we left off next tick, so a frame costs
// the same whether two cards are visible or twelve. The factories are all
// parameterised by absolute time, so an uneven update rate is safe — a card
// that misses a turn simply draws its correct state a frame later.
const BUDGET_MS = 5;
let cursor = 0;

function tick(ts) {
  raf = requestAnimationFrame(tick);
  if (ts - last < FRAME_MS) return;
  last = ts;

  const list = [...subscribers];
  if (!list.length) return;

  const started = performance.now();
  let drawn = 0;
  while (drawn < list.length) {
    list[(cursor + drawn) % list.length](ts);
    drawn += 1;
    if (performance.now() - started > BUDGET_MS) break;
  }
  cursor = (cursor + drawn) % list.length;
}

function start() {
  if (!raf && subscribers.size && !document.hidden) {
    last = 0;
    raf = requestAnimationFrame(tick);
  }
}

function stop() {
  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
}

export function subscribe(fn) {
  subscribers.add(fn);
  start();
  return () => {
    subscribers.delete(fn);
    if (!subscribers.size) stop();
  };
}

export const activeCount = () => subscribers.size;
