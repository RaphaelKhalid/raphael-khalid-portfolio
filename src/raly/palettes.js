import * as THREE from 'three';

// raly's key palettes. Each maps the skin's zones (spine, mid-body, frilled
// edge) to three colors; the pattern's lightness is kept, so spots, bars and
// veins read the same in every palette. Reef is the original skin.
export const PALETTES = [
  { name: 'reef', weight: 0, ramp: ['#1f2f9e', '#b3135c', '#f2a33a'] },
  { name: 'whale shark', weight: 1, ramp: ['#16304f', '#2d6a8a', '#9cc7d3'] },
  { name: 'ember', weight: 1, ramp: ['#5c0d1c', '#d4402a', '#f4b53f'] },
  { name: 'lichen', weight: 1, ramp: ['#173f31', '#4f8a3c', '#cfd66b'] },
  { name: 'nudibranch', weight: 1, ramp: ['#1d0f4a', '#6b2fb8', '#c9a6ff'] },
];

const HOLD = 32, BLEND = 6;
const smooth = t => t * t * (3 - 2 * t);

export function createPaletteCycle(shared, { start = 0 } = {}) {
  const colors = PALETTES.map(p => p.ramp.map(hex => new THREE.Color(hex)));
  let from = start % PALETTES.length, to = from, t = 1, held = 0;

  function apply() {
    const a = PALETTES[from], b = PALETTES[to], k = smooth(t);
    shared.rampWeight.value = a.weight + (b.weight - a.weight) * k;
    // Blending into or out of reef keeps the other palette's ramp, so only
    // its weight fades; between two palettes the colors themselves glide.
    for (let i = 0; i < 3; i++) {
      const out = shared.ramp.value[i];
      if (a.weight === 0) out.copy(colors[to][i]);
      else if (b.weight === 0) out.copy(colors[from][i]);
      else out.copy(colors[from][i]).lerp(colors[to][i], k);
    }
  }
  apply();

  return {
    get name() { return PALETTES[t < 0.5 ? from : to].name; },
    /** Start blending toward the next palette now. */
    next() {
      if (t < 1) return; // let a blend finish rather than snapping mid-way
      from = to;
      to = (to + 1) % PALETTES.length; t = 0; held = 0;
    },
    update(dt) {
      if (t < 1) { t = Math.min(1, t + dt / BLEND); apply(); return; }
      held += dt;
      if (held > HOLD) this.next();
    },
  };
}
