// A tiny handle on the running raly engine, for components elsewhere on the
// page (the nav's music toggle). The engine loads lazily, so callers
// subscribe instead of importing it directly.
/** Where raly is on screen, in CSS pixels, updated every frame by the engine. */
export const ralyScreen = { x: -1e4, y: -1e4, headX: -1e4, headY: -1e4, radius: 0, visible: false, startle: 0, top: -1e4, left: -1e4, right: -1e4, bottom: -1e4 };

let current = null;
const subscribers = new Set();

export function setRaly(engine) {
  current = engine;
  subscribers.forEach(fn => fn(engine));
}

export function onRaly(fn) {
  subscribers.add(fn);
  if (current) fn(current);
  return () => subscribers.delete(fn);
}
