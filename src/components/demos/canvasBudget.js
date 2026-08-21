// ctx.shadowBlur is the most expensive property in Canvas 2D — its cost scales
// with the blur radius and it is applied per drawn primitive. The labs use it
// for glow on boids, lidar rays and landmarks, at radii up to 18, hundreds of
// times per frame. Clamping once at the context keeps the look and removes most
// of the paint cost, without editing three simulations.
const SHADOW_CAP = 5;

export function clampShadow(ctx) {
  if (!ctx || ctx.__clamped) return ctx;
  const desc = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(ctx),
    "shadowBlur"
  );
  if (!desc || !desc.set) return ctx;
  Object.defineProperty(ctx, "shadowBlur", {
    configurable: true,
    get: () => desc.get.call(ctx),
    set(v) {
      desc.set.call(ctx, v > SHADOW_CAP ? SHADOW_CAP : v);
    },
  });
  ctx.__clamped = true;
  return ctx;
}

// These simulations are legible at 30fps and cost twice as much at 60. The
// expense is not the physics — it is that a changed canvas has to be rasterised
// and composited again. Updating every other frame halves that, and leaves the
// other half of the budget for the page to scroll smoothly while a demo runs.
export function makeFrameGate(fps = 30) {
  const interval = 1000 / fps;
  let last = 0;
  return function schedule(ref, fn) {
    const tick = (ts) => {
      if (ts - last >= interval) {
        last = ts;
        fn(ts);
      } else {
        ref.current = requestAnimationFrame(tick);
      }
    };
    ref.current = requestAnimationFrame(tick);
  };
}
