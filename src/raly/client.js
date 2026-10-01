import { createAudio } from './audio.js';
import { ralyScreen } from './store.js';

// The page owns input, text and SVG. The worker owns all heavy GPU startup.
export async function createRalyClient(host, drawing, options) {
  const canvas = document.createElement('canvas');
  canvas.className = 'raly-canvas'; canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  const svg = drawing.querySelector('svg'), paths = [...svg.querySelectorAll('path')];
  const viewport = () => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio });
  let disposed = false, worker, frame = 0, last = 0, hits = [], callsInFlight = false, audioDirty = true, startupComplete = false;
  const audio = createAudio(), pending = new Map();
  const fail = error => {
    if (disposed) return;
    startupComplete = true;
    console.warn('raly is using its lightweight drawing', error);
    host.classList.add('is-fallback');
    drawing.classList.remove('is-finished');
    worker?.terminate(); worker = null;
    cancelAnimationFrame(frame); clearTimeout(deadline);
    pending.clear(); audio.disable(); ralyScreen.visible = false;
  };
  const updateScreen = (screen, contours, points) => {
    Object.assign(ralyScreen, screen); hits = points;
    svg.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
    drawing.classList.add('is-projected');
    paths.forEach((path, i) => path.setAttribute('d', contours[i] || ''));
  };
  const status = name => { canvas.classList.add(name); host.classList.add(name); };
  const ready = () => { startupComplete = true; clearTimeout(deadline); host.classList.add('is-ready'); drawing.classList.add('is-finished'); options.onReady?.(); };
  let deadline = document.hidden ? 0 : setTimeout(() => fail('Renderer startup timed out'), 45000);
  if (!canvas.transferControlToOffscreen || typeof Worker === 'undefined') {
    // Unsupported browsers never compile the physical shader on the UI thread.
    try {
      const { createRaly } = await import('./engine.js');
      const engine = createRaly(canvas, { ...options, detailed: false, onReady: ready });
      clearTimeout(deadline);
      const dispose = engine.dispose;
      engine.dispose = () => { disposed = true; dispose(); canvas.remove(); drawing.classList.remove('is-finished'); };
      return engine;
    } catch (error) {
      fail(error);
      return { audio, start() {}, hover: () => false, setFloor() {}, setHeroBias() {}, setPointer() {}, setPace() {}, release() {}, dispose() { disposed = true; canvas.remove(); } };
    }
  }
  const send = data => { if (!disposed && worker) worker.postMessage(data); };
  const queue = (name, ...args) => { if (worker) pending.set(name, args); };
  const hover = (x, y) => ralyScreen.visible && hits.some((px, i) => i % 2 === 0 && Math.hypot(px - x, hits[i + 1] - y) <= Math.max(24, innerHeight * 0.04));
  const resize = () => send({ type: 'viewport', viewport: viewport() });
  const visibility = () => {
    send({ type: 'visibility', hidden: document.hidden });
    clearTimeout(deadline);
    if (!startupComplete && !document.hidden) deadline = setTimeout(() => fail('Renderer startup timed out'), 45000);
  };
  function tick(now) {
    frame = requestAnimationFrame(tick);
    if (document.hidden) { last = 0; return; }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
    audio.update(dt);
    if (!callsInFlight && (pending.size || audio.state.enabled || audioDirty)) {
      callsInFlight = true;
      send({ type: 'calls', calls: [...pending], audio: audio.state });
      pending.clear(); audioDirty = false;
    }
  }
  const disableAudio = audio.disable;
  audio.disable = () => { disableAudio(); audioDirty = true; };

  try {
    worker = new Worker(new URL('./renderer.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (disposed) return;
      if (data.type === 'ack') callsInFlight = false;
      if (data.type === 'screen') updateScreen(data.screen, data.contours, data.hits);
      if (data.type === 'status') status(data.name);
      if (data.type === 'ready') ready();
      if (data.type === 'error') fail(data.message);
    };
    worker.onerror = event => { event.preventDefault(); fail(event.message); };
    const offscreen = canvas.transferControlToOffscreen();
    worker.postMessage({ type: 'init', canvas: offscreen, viewport: viewport(), search: location.search,
      hidden: document.hidden, options: { quality: options.quality, reducedMotion: options.reducedMotion } }, [offscreen]);
    addEventListener('resize', resize); document.addEventListener('visibilitychange', visibility);
    frame = requestAnimationFrame(tick);
  } catch (error) { fail(error); }
  const api = {
    audio, hover,
    touch(x, y) { if (!hover(x, y)) return false; queue('touch', x, y); return true; },
    grab(x, y) { if (!hover(x, y)) return false; queue('grab', x, y); return true; },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); clearTimeout(deadline);
      removeEventListener('resize', resize); document.removeEventListener('visibilitychange', visibility);
      audio.disable(); worker?.terminate(); worker = null; canvas.remove();
      host.classList.remove('is-forming', 'is-ready', 'is-fallback');
      drawing.classList.remove('is-finished', 'is-projected'); ralyScreen.visible = false;
    },
  };
  for (const name of ['start', 'stop', 'setFloor', 'setHeroBias', 'setPointer', 'setPace', 'setLook', 'drag', 'release', 'advance']) api[name] = (...args) => queue(name, ...args);
  return api;
}
