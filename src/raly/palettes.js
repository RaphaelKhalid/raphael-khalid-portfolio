import * as THREE from 'three';
import { lookIndex } from './looks.js';

// raly's appearances: the natural skin in five key palettes, interleaved with
// its art styles (see looks.js). Each palette maps the skin's zones (spine,
// mid-body, frilled edge) to three colors while keeping the pattern's
// lightness; reef is the original skin. raly holds each appearance for a
// while, then moves to the next: palettes glide into each other, and a new
// art style sweeps down the body from head to tail.
export const PALETTES = {
  reef: { weight: 0, ramp: ['#1f2f9e', '#b3135c', '#f2a33a'] },
  'whale shark': { weight: 1, ramp: ['#16304f', '#2d6a8a', '#9cc7d3'] },
  ember: { weight: 1, ramp: ['#5c0d1c', '#d4402a', '#f4b53f'] },
  lichen: { weight: 1, ramp: ['#173f31', '#4f8a3c', '#cfd66b'] },
  nudibranch: { weight: 1, ramp: ['#1d0f4a', '#6b2fb8', '#c9a6ff'] },
};

export const APPEARANCES = [
  { look: 'natural', palette: 'reef' },
  { look: 'ink' },
  { look: 'natural', palette: 'whale shark' },
  { look: 'watercolor' },
  { look: 'natural', palette: 'ember' },
  { look: 'porcelain' },
  { look: 'natural', palette: 'lichen' },
  { look: 'fabric' },
  { look: 'natural', palette: 'nudibranch' },
  { look: 'oil' },
  { look: 'cosmic' },
  { look: 'cartoon' },
];

const HOLD = 30, BLEND = 5;
const smooth = t => t * t * (3 - 2 * t);

/** Cycles raly's appearance. `look` names one to show and hold (for previews). */
export function createAppearanceCycle(shared, { look, canTransition = () => true } = {}) {
  const colors = Object.fromEntries(Object.entries(PALETTES).map(([name, p]) => [name, p.ramp.map(hex => new THREE.Color(hex))]));
  const asked = look ? APPEARANCES.findIndex(a => a.look === look) : -1;
  let from = Math.max(0, asked), to = from, t = 1, held = 0, blend = BLEND;
  const paused = asked >= 0;
  let requested = false, quickRequested = false;

  function setPalette(name, other = name, k = 0) {
    const a = PALETTES[name], b = PALETTES[other];
    shared.rampWeight.value = a.weight + (b.weight - a.weight) * k;
    for (let i = 0; i < 3; i++) {
      const out = shared.ramp.value[i];
      // Into or out of reef only the weight fades; between palettes the colors glide.
      if (a.weight === 0) out.copy(colors[other][i]);
      else if (b.weight === 0) out.copy(colors[name][i]);
      else out.copy(colors[name][i]).lerp(colors[other][i], k);
    }
  }

  function apply() {
    const a = APPEARANCES[from], b = APPEARANCES[to], k = smooth(t);
    if (a.look === 'natural' && b.look === 'natural') {
      setPalette(a.palette, b.palette, k);
      shared.look.value.set(0, 0, 0);
      return;
    }
    // The natural side (if any) keeps its own palette through the sweep.
    const natural = a.look === 'natural' ? a : b.look === 'natural' ? b : null;
    if (natural) setPalette(natural.palette);
    shared.look.value.set(lookIndex(a.look), lookIndex(b.look), k);
  }
  apply();

  return {
    get name() { const a = APPEARANCES[t < 0.5 ? from : to]; return a.palette ?? a.look; },
    /** The art styles the next transition will show, so they can be prepared ahead. */
    get upcoming() { return [lookIndex(APPEARANCES[to].look), lookIndex(APPEARANCES[(to + 1) % APPEARANCES.length].look)]; },
    /** Coalesce clicks while loading; never cut an in-progress sweep short. */
    next({ quick = false } = {}) {
      if (t < 1) return false;
      requested = true;
      quickRequested ||= quick;
      return true;
    },
    update(dt) {
      if (t < 1) { t = Math.min(1, t + dt / blend); apply(); return; }
      held += dt;
      if (!requested && (paused || held <= HOLD)) return;
      const next = (to + 1) % APPEARANCES.length;
      const looks = [lookIndex(APPEARANCES[to].look), lookIndex(APPEARANCES[next].look)];
      // Keep every visible uniform unchanged until the whole transition is ready.
      if (!canTransition(looks)) return;
      from = to; to = next; t = 0; held = 0;
      blend = quickRequested ? 1.4 : BLEND;
      requested = quickRequested = false;
      apply();
    },
  };
}
