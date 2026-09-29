import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from 'three';

// Study 06/07 anatomy. Every visitor gets a specimen grown from a seed: the same
// art direction (ruffled mantle, under-frill, trailing ribbons), with its own
// proportions, twist, ribbon count and skin fingerprint.
//
// Two coordinate systems matter:
//  * Rest space: the organism's local sculpted pose (x right, y up, z toward
//    the viewer), as in study 05.
//  * Body space: position along the mantle's muscle line (arc length) plus an
//    offset from it. At runtime the muscle line bends to follow the path the
//    head actually swam; everything anchored to it bends along.
//
// Mantle and frill vertices carry aBody = (offset from spine, spine arc).
// Ribbons are simulated chains. Their vertices carry aRib = offset from the
// ribbon's own rest centerline, and aSurf.w = u along that ribbon.

const PI = Math.PI;
export const KIND = { mantle: 0, frill: 1, ribbon: 2 };
export const SPINE_SAMPLES = 48;
export const RIBBON_NODES = 32;

export function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const baseMantle = {
  name: 'Mantle', kind: KIND.mantle, segments: 420, across: 84,
  points: [[-3.7, 1.5, -0.35], [-2.85, 1.18, 0.12], [-1.9, 0.78, 0.34], [-0.9, 0.36, 0.26], [0.1, 0.02, 0.06],
    [1.1, -0.34, 0.1], [2.1, -0.74, 0.28], [3.0, -1.05, 0.2], [3.75, -1.28, -0.05]],
  widths: [[0, 1.45], [0.1, 2.1], [0.22, 1.95], [0.38, 1.35], [0.52, 1.2], [0.66, 1.6], [0.8, 1.85], [0.92, 1.45], [1, 1.0]],
  rolls: [[0, -0.35], [0.2, -0.2], [0.4, 0.2], [0.55, 0.75], [0.7, 1.15], [0.86, 1.0], [1, 0.7]],
  fans: [[0, 0.5], [0.3, 0.6], [0.55, 0.95], [0.8, 1.15], [1, 0.9]],
  fanWave: 0.18, fold: 0.22, endPower: 0.32,
};
const baseFrill = {
  name: 'Under-frill', kind: KIND.frill, segments: 300, across: 56,
  points: [[-3.1, 0.85, -0.6], [-2.1, 0.26, -0.5], [-1.05, -0.16, -0.55], [0.0, -0.46, -0.6], [1.0, -0.82, -0.52],
    [2.0, -1.2, -0.42], [2.95, -1.55, -0.48]],
  widths: [[0, 0.95], [0.2, 1.3], [0.5, 1.05], [0.78, 1.25], [1, 0.8]],
  rolls: [[0, 0.2], [0.5, 0.4], [1, 0.85]],
  fans: [[0, 0.95], [1, 0.95]],
  fanWave: 0.25, fold: 0.3, endPower: 0.4,
};
const ribbonDesigns = [
  {
    name: 'Upper ribbon', required: true,
    points: [[-0.9, 0.42, -0.28], [-0.2, 1.28, -0.36], [0.8, 1.94, -0.3], [2.0, 1.82, -0.2], [3.1, 1.22, 0.0],
      [3.9, 0.36, 0.15], [4.28, -0.46, 0.25], [4.14, -0.96, 0.3], [3.9, -1.06, 0.3]],
    widths: [[0, 0.27], [0.3, 0.25], [0.62, 0.17], [0.86, 0.08], [1, 0.012]],
    rolls: [[0, 0], [0.3, 1.5], [0.62, 3.3], [1, 4.9]],
  },
  {
    name: 'Trailing ribbon',
    points: [[1.6, -0.4, -0.15], [2.5, 0.26, -0.3], [3.4, 0.36, -0.2], [4.1, -0.2, 0.0], [4.52, -1.0, 0.15],
      [4.46, -1.7, 0.2], [4.2, -1.92, 0.25]],
    widths: [[0, 0.24], [0.35, 0.22], [0.7, 0.13], [1, 0.01]],
    rolls: [[0, 0.4], [0.35, -1.2], [0.7, -2.9], [1, -4.1]],
  },
  {
    name: 'Lower ribbon', required: true,
    points: [[-0.6, -0.1, -0.22], [-1.3, -0.92, -0.1], [-2.1, -1.6, 0.1], [-3.1, -1.76, 0.2], [-3.9, -1.36, 0.25],
      [-4.4, -0.8, 0.2], [-4.56, -0.36, 0.15]],
    widths: [[0, 0.26], [0.3, 0.24], [0.66, 0.15], [1, 0.01]],
    rolls: [[0, -0.2], [0.3, 1.2], [0.66, 2.9], [1, 4.3]],
  },
  {
    name: 'Short ribbon',
    points: [[0.6, -0.5, -0.32], [0.3, -1.3, -0.22], [-0.3, -2.0, 0.0], [-1.2, -2.26, 0.2], [-1.9, -2.05, 0.25]],
    widths: [[0, 0.2], [0.4, 0.17], [0.75, 0.1], [1, 0.01]],
    rolls: [[0, 0.3], [0.5, -1.6], [1, -3.2]],
  },
  {
    name: 'Tail streamer', required: true,
    points: [[2.6, -0.9, -0.2], [3.4, -1.45, -0.12], [4.2, -1.66, 0.08], [5.0, -1.42, 0.2], [5.6, -0.95, 0.22], [5.9, -0.6, 0.2]],
    widths: [[0, 0.22], [0.4, 0.19], [0.75, 0.1], [1, 0.01]],
    rolls: [[0, 0.1], [0.5, 2.0], [1, 3.6]],
  },
];

function keyed(keys, u) {
  for (let i = 1; i < keys.length; i++) {
    if (u <= keys[i][0]) {
      const t = (u - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]);
      return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * t * t * (3 - 2 * t);
    }
  }
  return keys.at(-1)[1];
}

const jitterKeys = (keys, random, amount, additive = false) =>
  keys.map(([u, v]) => [u, additive ? v + (random() * 2 - 1) * amount : v * (1 + (random() * 2 - 1) * amount)]);

// Arc-length samples with a rotation-minimizing frame.
function spineFrames(points, count) {
  const curve = new CatmullRomCurve3(points.map(p => new Vector3(...p)), false, 'centripetal');
  const pts = [], tangents = [], normals = [];
  for (let i = 0; i <= count; i++) {
    pts.push(curve.getPointAt(i / count));
    tangents.push(curve.getTangentAt(i / count).normalize());
  }
  const toward = new Vector3(0, 0, 1);
  normals.push(toward.clone().addScaledVector(tangents[0], -toward.dot(tangents[0])).normalize());
  for (let i = 1; i <= count; i++) {
    const n = normals[i - 1].clone();
    n.addScaledVector(tangents[i], -n.dot(tangents[i])).normalize();
    normals.push(n);
  }
  return { curve, points: pts, tangents, normals, length: curve.getLength() };
}

function sectionPoint(profile, frame, i, u, s, out) {
  const e = Math.abs(s);
  const envelope = profile.endPower ? 0.01 + 0.99 * Math.pow(Math.sin(PI * u), profile.endPower) : 1;
  const width = keyed(profile.widths, u) * envelope;
  const roll = keyed(profile.rolls, u);
  const fan = keyed(profile.fans, u) + profile.fanWave * Math.sin(u * PI * 2.6 + profile.seed);
  const side = new Vector3().crossVectors(frame.tangents[i], frame.normals[i]).normalize();
  const face = frame.normals[i];
  const rolledSide = side.clone().multiplyScalar(Math.cos(roll)).addScaledVector(face, Math.sin(roll));
  const rolledFace = face.clone().multiplyScalar(Math.cos(roll)).addScaledVector(side, -Math.sin(roll));
  const across = width * Math.sin(s * fan) / fan;
  let depth = -width * (1 - Math.cos(s * fan)) / fan;
  depth += profile.fold * width * e * e * Math.sin(u * PI * 2.4 + Math.sign(s) * 1.1 + profile.seed);
  return { point: out.copy(frame.points[i]).addScaledVector(rolledSide, across).addScaledVector(rolledFace, depth), width, face: rolledFace, side: rolledSide, fan };
}

// Piecewise-linear lookup matching the vertex shader's interpolation.
function linear(samples, t, out) {
  const n = samples.length - 1, x = Math.min(Math.max(t, 0), 1) * n;
  const i = Math.min(Math.floor(x), n - 1), f = x - i;
  return out.copy(samples[i]).lerp(samples[i + 1], f);
}

function nearestArc(spine, point) {
  let best = Infinity, bestArc = 0;
  const a = new Vector3(), b = new Vector3(), ab = new Vector3(), ap = new Vector3();
  for (let k = 0; k < spine.samples.length - 1; k++) {
    a.copy(spine.samples[k]); b.copy(spine.samples[k + 1]);
    ab.subVectors(b, a); ap.subVectors(point, a);
    const t = Math.min(1, Math.max(0, ap.dot(ab) / ab.lengthSq()));
    const d = ap.addScaledVector(ab, -t).lengthSq();
    if (d < best) { best = d; bestArc = (k + t) / (spine.samples.length - 1); }
  }
  return bestArc * spine.length;
}

function buildSheet(profile, { spine, ribbonNodes }) {
  const { segments: U, across: V } = profile;
  const frame = spineFrames(profile.points, U);
  const grid = [], widths = [];
  const tmp = new Vector3();
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    for (let j = 0; j <= V; j++) {
      const { point, width } = sectionPoint(profile, frame, i, u, (j / V) * 2 - 1, tmp);
      grid.push(point.clone());
      if (j === 0) widths.push(width);
    }
  }
  const count = (U + 1) * (V + 1);
  const position = new Float32Array(count * 3), normal = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2), tu = new Float32Array(count * 3), tv = new Float32Array(count * 3);
  const surf = new Float32Array(count * 4), anchor = new Float32Array(count * 4);
  const du = new Vector3(), dv = new Vector3(), n = new Vector3(), base = new Vector3();
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    // Body surfaces hang from the mantle spine; ribbons from their own nodes.
    let arc = 0;
    if (ribbonNodes) linear(ribbonNodes, u, base);
    else {
      arc = profile.kind === KIND.mantle ? u * spine.length : nearestArc(spine, frame.points[i]);
      linear(spine.samples, arc / spine.length, base);
    }
    for (let j = 0; j <= V; j++) {
      const k = i * (V + 1) + j;
      const i0 = Math.max(0, i - 1), i1 = Math.min(U, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(V, j + 1);
      du.subVectors(grid[i1 * (V + 1) + j], grid[i0 * (V + 1) + j]).multiplyScalar(U / (i1 - i0));
      dv.subVectors(grid[i * (V + 1) + j1], grid[i * (V + 1) + j0]).multiplyScalar(V / (j1 - j0));
      n.crossVectors(du, dv);
      if (n.lengthSq() < 1e-12) n.copy(frame.normals[i]);
      n.normalize();
      grid[k].toArray(position, k * 3);
      n.toArray(normal, k * 3);
      du.toArray(tu, k * 3);
      dv.toArray(tv, k * 3);
      uv[k * 2] = u; uv[k * 2 + 1] = j / V;
      surf.set([u * frame.length, (j / V) * 2 - 1, widths[i], u], k * 4);
      const offset = grid[k].clone().sub(base);
      anchor.set([offset.x, offset.y, offset.z, arc], k * 4);
    }
  }
  const index = [];
  for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
    const a = i * (V + 1) + j, b = a + V + 1;
    index.push(a, b, b + 1, a, b + 1, a + 1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setAttribute('aTu', new Float32BufferAttribute(tu, 3));
  geometry.setAttribute('aTv', new Float32BufferAttribute(tv, 3));
  geometry.setAttribute('aSurf', new Float32BufferAttribute(surf, 4));
  geometry.setAttribute('aAnchor', new Float32BufferAttribute(anchor, 4));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += 2;
  return { geometry, frame };
}

/**
 * Grows one specimen. Returns the rest spine (for the swimmer), body sheets
 * and ribbon chains (for the physics), all in rest space.
 */
export function growSpecimen(seed) {
  const random = createRandom(seed);
  const mantle = {
    ...baseMantle, seed: random() * 6,
    widths: jitterKeys(baseMantle.widths, random, 0.12),
    rolls: jitterKeys(baseMantle.rolls, random, 0.22, true),
    fans: jitterKeys(baseMantle.fans, random, 0.14),
  };
  const frill = {
    ...baseFrill, seed: random() * 6,
    widths: jitterKeys(baseFrill.widths, random, 0.15),
    rolls: jitterKeys(baseFrill.rolls, random, 0.2, true),
  };

  // The spine is the mantle's muscle line, sampled evenly by arc length.
  const mantleFrame = spineFrames(mantle.points, SPINE_SAMPLES - 1);
  const spine = { samples: mantleFrame.points, length: mantleFrame.length };
  spine.headForward = spine.samples[0].clone().sub(spine.samples[1]).normalize();
  // The mantle's cross-section at each spine sample (rest space), used to
  // keep ribbons from passing through it and to emit effects from its edges.
  spine.sheet = spine.samples.map((_, k) => {
    const section = sectionPoint(mantle, mantleFrame, k, k / (SPINE_SAMPLES - 1), 0, new Vector3());
    return { face: section.face.clone(), side: section.side.clone(), width: section.width, fan: section.fan };
  });

  const surfaces = [];
  for (const profile of [mantle, frill]) {
    const { geometry, frame } = buildSheet(profile, { spine });
    surfaces.push({ name: profile.name, kind: profile.kind, seed: profile.seed, length: frame.length, geometry, role: 'body', segments: profile.segments, across: profile.across });
  }

  // Three to five ribbons, each with its own length and twist.
  const optional = ribbonDesigns.filter(d => !d.required).filter(() => random() < 0.55);
  const chosen = [...ribbonDesigns.filter(d => d.required), ...optional];
  for (const design of chosen) {
    const stretch = 0.85 + random() * 0.35, twist = 0.7 + random() * 0.6;
    const root = design.points[0];
    const points = design.points.map((p, i) => i === 0 ? p : p.map((c, axis) => root[axis] + (c - root[axis]) * stretch));
    const profile = {
      name: design.name, kind: KIND.ribbon, seed: random() * 6, segments: 260, across: 14,
      points, widths: design.widths, rolls: design.rolls.map(([u, r]) => [u, r * twist]),
      fans: [[0, 0.88], [1, 0.88]], fanWave: 0.2, fold: 0.08, endPower: 0,
    };
    const frame = spineFrames(profile.points, RIBBON_NODES - 1);
    const nodes = frame.points;
    const { geometry, frame: sheetFrame } = buildSheet(profile, { ribbonNodes: nodes });
    const faces = nodes.map((_, i) => sectionPoint(profile, frame, i, i / (RIBBON_NODES - 1), 0, new Vector3()).face.clone());
    surfaces.push({
      name: profile.name, kind: KIND.ribbon, seed: profile.seed, length: sheetFrame.length, geometry, role: 'ribbon',
      ribbon: {
        nodes, tangents: frame.tangents, faces,
        segment: frame.length / (RIBBON_NODES - 1),
        rootArc: nearestArc(spine, nodes[0]),
        fourth: random() * 6, // phase of its extent into the fourth dimension
      },
    });
  }

  // A small, bounded palette drift: every specimen is recognizably the same
  // species, but no two share exactly the same blues and corals.
  const palette = { hue: (random() * 2 - 1) * 0.06, warmth: (random() * 2 - 1) * 0.08 };
  return { seed, spine, surfaces, palette, patternSeed: random() * 1000 };
}
