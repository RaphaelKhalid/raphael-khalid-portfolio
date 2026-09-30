import { useEffect, useRef } from "react";
import { ralyScreen } from "../raly/store";

// "running experiments", set as a row of printed letters with real thickness.
// Every letter is its own small 3D body on a spring: it leans away from a
// nearby cursor, gets flicked by a fast one, and ripples when raly passes.
// When it turns, you see its paper edge and a coral underside. Each letter
// also wears one style at a time, chosen by what is happening to it:
//
//   engraving     slow attention: the ink opens into fine contour lines
//   interference  fast movement: two stripe layers beat against each other
//   wet ink       raly nearby: the letter swells and soaks darker, crisply
//   geometric     rare: pressure builds when raly lingers; a letter rebuilds
//                 itself from print modules and nudges its neighbours
//   marbling      suminagashi rings of cobalt, coral and ink, slowly swirling
//   risograph     two misregistered halftone screens, coral over cobalt
//   watercolor    a cobalt-to-rose wash that pools darker at its edges
//
// Which style slow or fast attention brings out rotates every few seconds,
// so hovering the words keeps turning up something new.
//
// Letters are coupled to their neighbours and remember recent input (fast
// attack, slow decay); with no one around, a slow wave rolls through the
// words and carries each style across in turn. Turns stay gentle: tilt is
// capped and the springs are damped, so letters sway rather than flip. All styles are drawn inside a
// distance field of the real glyphs, so the words stay readable. The DOM
// keeps the real text for screen readers, selection and search.

const LINES = ["running", "experiments"];
const MAX_LETTERS = 24;
const LAYERS = 9;

const vertexSource = `#version 300 es
precision highp float;
in vec2 aCorner;
uniform vec4 uBox[${MAX_LETTERS}];
uniform vec4 uPose[${MAX_LETTERS}];   // tilt x, tilt y, lift (px), spin z
uniform vec2 uRes;
uniform float uPad;
uniform float uDepth;
out vec2 vGlyph;
out float vLayer;
flat out int vLetter;
void main() {
  int letter = gl_InstanceID / ${LAYERS};
  // Each letter draws back to front: its deepest layer first.
  int layer = ${LAYERS - 1} - gl_InstanceID % ${LAYERS};
  vec4 box = uBox[letter] + vec4(-uPad, -uPad, uPad, uPad);
  vec2 glyph = mix(box.xy, box.zw, aCorner);
  vec2 center = (uBox[letter].xy + uBox[letter].zw) * 0.5;
  vec4 pose = uPose[letter];
  float depth = float(layer) / float(${LAYERS - 1}) * uDepth;
  vec3 v = vec3(glyph - center, -depth);
  float cz = cos(pose.w), sz = sin(pose.w);
  v.xy = mat2(cz, -sz, sz, cz) * v.xy;
  float cx = cos(pose.x), sx = sin(pose.x);
  v = vec3(v.x, cx * v.y - sx * v.z, sx * v.y + cx * v.z);
  float cy = cos(pose.y), sy = sin(pose.y);
  v = vec3(cy * v.x + sy * v.z, v.y, -sy * v.x + cy * v.z);
  v.z += pose.z;
  float focal = uRes.y * 2.2;
  vec2 screen = center + v.xy * focal / (focal - v.z);
  vGlyph = glyph;
  vLayer = float(layer) / float(${LAYERS - 1});
  vLetter = letter;
  vec2 clip = screen / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const fragmentSource = `#version 300 es
precision highp float;
uniform sampler2D uSdf;
uniform vec4 uA[${MAX_LETTERS}];     // engraving, interference, wet ink, geometric
uniform vec4 uB[${MAX_LETTERS}];     // flow x, flow y, seed, unused
uniform vec4 uC[${MAX_LETTERS}];     // marbling, risograph, watercolor, unused
uniform vec2 uRes;
uniform float uRange;
uniform float uPx;
uniform float uTime;
uniform float uCell;
uniform vec2 uPhase;
uniform vec2 uRaly;
in vec2 vGlyph;
in float vLayer;
flat in int vLetter;
out vec4 outColor;

const vec3 INK = vec3(0.18, 0.157, 0.149);
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) { return 0.55 * noise(p) + 0.3 * noise(p * 2.1 + 5.2) + 0.15 * noise(p * 4.3 + 1.7); }
float sdfAt(vec2 px) { return (texture(uSdf, px / uRes).r - 0.5) * 2.0 * uRange; }

void main() {
  vec2 p = vGlyph;
  float d = sdfAt(p);
  float aa = 0.8 * uPx;
  float inside = 1.0 - smoothstep(-aa, aa, d);
  if (inside < 0.002) discard;

  // The letter's body: a paper edge darkening toward a coral underside, only
  // visible where the letter is turned.
  if (vLayer > 0.01) {
    vec3 side = mix(vec3(0.44, 0.38, 0.34), vec3(0.86, 0.4, 0.28), smoothstep(0.35, 1.0, vLayer));
    outColor = vec4(side * inside, inside);
    return;
  }

  vec4 a = uA[vLetter];
  vec4 b = uB[vLetter];
  vec3 c = uC[vLetter].xyz;
  // One style at a time: the strongest wins, sharply.
  vec4 a4 = a * a * a * a;
  vec3 c4 = c * c * c * c;
  float strongest = max(max(max(a.x, a.y), max(a.z, a.w)), max(c.x, max(c.y, c.z)));
  float total = max(a4.x + a4.y + a4.z + a4.w + c4.x + c4.y + c4.z, 1e-5);
  vec4 w = a4 / total * strongest;
  vec3 wc = c4 / total * strongest;
  float wBase = 1.0 - (w.x + w.y + w.z + w.w + wc.x + wc.y + wc.z);

  // Engraving: contour lines following the outline, bent by recent motion.
  vec2 flow = b.xy;
  float bend = 3.0 * uPx * sin(dot(p, normalize(flow + vec2(0.001, 0.0))) * 0.035 + uTime * 0.6 + b.z * 6.0) * min(1.0, length(flow));
  float contour = abs(fract((d + bend) / (3.4 * uPx)) - 0.5) * 2.0;
  float edge = 1.0 - smoothstep(0.0, 1.6 * uPx, abs(d + 0.9 * uPx));
  float engraved = max(smoothstep(0.4, 0.8, contour), edge) * inside;
  vec3 engraveColor = mix(INK, vec3(0.16, 0.24, 0.62), smoothstep(0.64, 0.95, fbm(p * 0.01 + b.z * 9.0)) * 0.7);

  // Interference: two stripe systems; where they agree, cobalt.
  float period = 6.0 * uPx;
  vec2 ralyDir = normalize(p - uRaly + 0.001);
  float s1 = 0.5 + 0.5 * sin(dot(p, vec2(0.94, 0.34)) / period * 6.2832 + uPhase.x);
  float s2 = 0.5 + 0.5 * sin(dot(p, vec2(0.87, -0.5) + 0.25 * ralyDir) / (period * 1.07) * 6.2832 + uPhase.y);
  float stripes = smoothstep(0.4, 0.6, s1) * inside;
  vec3 interfereColor = mix(INK, vec3(0.1, 0.22, 0.66), smoothstep(0.55, 0.9, s1 * s2));

  // Wet ink: a crisp swell of the outline and a soaked, uneven interior.
  float grain = fbm(p * 0.02 + vec2(uTime * 0.05, b.z * 11.0));
  float dd = d + (grain - 0.5) * 7.0 * uPx - 2.2 * uPx;
  float swell = 1.0 - smoothstep(-aa, aa, dd);
  float streak = noise(vec2(p.x * 0.01, p.y * 0.4) + b.z * 3.0);
  vec3 inkColor = mix(vec3(0.3, 0.07, 0.15), INK * 0.8, smoothstep(0.3, 0.75, grain));
  inkColor = mix(inkColor, vec3(0.45, 0.1, 0.2), smoothstep(0.62, 0.9, streak) * 0.5);

  // Geometric: the letter rebuilt from print modules on a grid.
  vec2 cellId = floor(p / uCell);
  vec2 q = fract(p / uCell);
  float cellInside = step(sdfAt((cellId + 0.5) * uCell), uCell * 0.12);
  float h = hash(cellId + b.z * 17.0);
  float shape;
  if (h < 0.45) shape = 1.0;
  else if (h < 0.65) shape = step(length(q - vec2(step(0.5, fract(h * 7.0)), step(0.5, fract(h * 13.0)))), 1.0);
  else if (h < 0.85) shape = step(length(q - vec2(0.5, step(0.5, fract(h * 5.0)))), 0.5);
  else shape = step(length(q - 0.5), 0.5);
  float geometric = cellInside * shape;
  float tint = hash(cellId * 1.7 + 3.1);
  vec3 geoColor = tint > 0.86 ? vec3(0.13, 0.26, 0.68) : tint > 0.76 ? vec3(0.88, 0.36, 0.22) : INK;

  // Marbling: rings floated on water and combed by a slow current.
  vec2 m = p / (uCell * 7.0);
  m += 0.7 * vec2(fbm(m * 0.9 + vec2(uTime * 0.04, b.z * 5.0)), fbm(m * 0.9 + vec2(3.1, -uTime * 0.035)));
  float rings = sin(length(m - vec2(0.4 + b.z, 0.6)) * 10.0 + fbm(m * 1.7 + b.z) * 5.0 - uTime * 0.35);
  vec3 marbleColor = mix(INK, vec3(0.12, 0.2, 0.62), smoothstep(-0.2, 0.45, rings));
  marbleColor = mix(marbleColor, vec3(0.86, 0.36, 0.2), smoothstep(0.7, 0.92, rings));
  marbleColor = mix(marbleColor, vec3(0.93, 0.88, 0.8), smoothstep(0.955, 1.0, rings) * 0.8);
  float marble = inside;

  // Risograph: coral and cobalt halftone screens, slightly out of register.
  float tone = 0.35 + 0.45 * smoothstep(-uCell * 2.5, 0.0, d) + 0.12 * sin(uTime * 0.8 + b.z * 6.0);
  float cs = uCell * 0.42;
  vec2 ra = mat2(0.966, -0.259, 0.259, 0.966) * p;
  vec2 rb = mat2(0.259, -0.966, 0.966, 0.259) * (p + vec2(1.8, -1.2) * uPx);
  float dotA = 1.0 - smoothstep(-aa, aa, length(fract(ra / cs) - 0.5) * cs - sqrt(tone) * cs * 0.52);
  float dotB = (1.0 - smoothstep(-aa, aa, length(fract(rb / cs) - 0.5) * cs - sqrt(1.0 - tone * 0.6) * cs * 0.42))
    * (1.0 - smoothstep(-aa, aa, sdfAt(p + vec2(1.8, -1.2) * uPx)));
  float riso = max(dotA * inside, dotB);
  vec3 risoColor = (dotA * vec3(0.9, 0.36, 0.22) + dotB * vec3(0.14, 0.2, 0.62)) / max(dotA + dotB, 1e-4);
  risoColor *= 1.0 - 0.38 * dotA * dotB;

  // Watercolor: a soft wash, pigment pooling at the edge, paper grain.
  float wet = fbm(p * 0.012 + b.z * 7.0 + uTime * 0.02);
  float wd = d + (wet - 0.5) * 5.0 * uPx;
  float rim = exp(-pow((wd + 1.5 * uPx) / (2.4 * uPx), 2.0));
  vec3 wash = mix(vec3(0.17, 0.3, 0.64), vec3(0.74, 0.22, 0.38), smoothstep(0.3, 0.8, fbm(p * 0.005 + b.z * 3.0 + uTime * 0.01)));
  float granule = noise(p * 0.4 / uPx + b.z * 50.0);
  vec3 waterColor = wash * (0.8 + 0.3 * granule) * (1.0 - 0.4 * rim);
  float water = clamp((0.62 + 0.12 * granule) * (1.0 - smoothstep(-2.5 * uPx, 0.5 * uPx, wd)) + rim * 0.45, 0.0, 1.0) * inside;

  float cover = wBase * inside + w.x * engraved + w.y * stripes + w.z * swell + w.w * geometric
    + wc.x * marble + wc.y * riso + wc.z * water;
  vec3 color = (wBase * inside * INK + w.x * engraved * engraveColor + w.y * stripes * interfereColor
    + w.z * swell * inkColor + w.w * geometric * geoColor
    + wc.x * marble * marbleColor + wc.y * riso * risoColor + wc.z * water * waterColor) / max(cover, 1e-4);
  cover = clamp(cover, 0.0, 1.0);
  outColor = vec4(color * cover, cover);
}`;

// Exact Euclidean distance transform (Felzenszwalb & Huttenlocher).
function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}
function edt(grid, w, h) {
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
}
function signedField(alpha, w, h, range) {
  const INF = 1e20;
  const outside = new Float64Array(w * h), insideGrid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = alpha[i * 4 + 3] / 255;
    outside[i] = a > 0.5 ? 0 : INF;
    insideGrid[i] = a > 0.5 ? INF : 0;
  }
  edt(outside, w, h); edt(insideGrid, w, h);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = alpha[i * 4 + 3] / 255;
    const d = Math.sqrt(outside[i]) - Math.sqrt(insideGrid[i]) + (0.5 - a);
    out[i] = Math.max(0, Math.min(255, Math.round((0.5 + d / (2 * range)) * 255)));
  }
  return out;
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const ReactiveHeadline = ({ className = "" }) => {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current, text = textRef.current;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: true });
    if (!gl || reduced) { canvas.style.display = "none"; return undefined; }

    let program;
    try {
      program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    } catch (error) {
      console.error(error);
      canvas.style.display = "none";
      return undefined;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "aCorner");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uniform = name => gl.getUniformLocation(program, name);
    const U = Object.fromEntries(["uSdf", "uBox", "uPose", "uA", "uB", "uC", "uRes", "uRange", "uPx", "uTime", "uCell", "uPhase", "uRaly", "uPad", "uDepth"].map(n => [n, uniform(n)]));
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    let letters = [];
    let layout = { pad: 0, scale: 1, fontPx: 100, range: 18 };
    const boxes = new Float32Array(MAX_LETTERS * 4), poses = new Float32Array(MAX_LETTERS * 4);
    const stateA = new Float32Array(MAX_LETTERS * 4), stateB = new Float32Array(MAX_LETTERS * 4), stateC = new Float32Array(MAX_LETTERS * 4);

    function build() {
      const style = getComputedStyle(text);
      const fontPx = parseFloat(style.fontSize);
      const scale = Math.min(devicePixelRatio || 1, 1.75);
      // Room around the words for letters to turn and lift into.
      const pad = Math.round(fontPx * 0.35);
      const rect = text.getBoundingClientRect();
      const width = Math.ceil(rect.width + pad * 2), height = Math.ceil(rect.height + pad * 2);
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      canvas.style.left = `${-pad}px`; canvas.style.top = `${-pad}px`;
      const off = document.createElement("canvas");
      off.width = canvas.width; off.height = canvas.height;
      const ctx = off.getContext("2d", { willReadFrequently: true });
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${fontPx * scale}px ${style.fontFamily}`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = `${parseFloat(style.letterSpacing || "0") * scale}px`;
      ctx.fillStyle = "#000";
      ctx.textBaseline = "alphabetic";
      const previous = letters;
      letters = [];
      text.querySelectorAll("[data-line]").forEach(lineEl => {
        const r = lineEl.getBoundingClientRect();
        const word = lineEl.textContent;
        const metrics = ctx.measureText(word);
        const ascent = metrics.fontBoundingBoxAscent ?? fontPx * scale * 0.8;
        const descent = metrics.fontBoundingBoxDescent ?? fontPx * scale * 0.2;
        const x0 = (r.left - rect.left + pad) * scale;
        const baseline = (r.top - rect.top + pad) * scale + (r.height * scale - (ascent + descent)) / 2 + ascent;
        ctx.fillText(word, x0, baseline);
        for (let i = 0; i < word.length && letters.length < MAX_LETTERS; i++) {
          const start = ctx.measureText(word.slice(0, i)).width, end = ctx.measureText(word.slice(0, i + 1)).width;
          const old = previous[letters.length];
          letters.push({
            box: [x0 + start, baseline - ascent * 0.92, x0 + end, baseline + descent * 0.9],
            cx: (x0 + (start + end) / 2) / scale - pad, cy: (baseline - ascent * 0.4) / scale - pad,
            seed: old?.seed ?? Math.random(),
            engrave: 0, interfere: 0, ink: 0, geo: 0, marble: 0, riso: 0, water: 0, pressure: 0, geoTimer: 0, flow: [0, 0],
            pose: old?.pose ?? [0, 0, 0, 0], velocity: old?.velocity ?? [0, 0, 0, 0],
          });
        }
      });
      letters.forEach((l, i) => boxes.set(l.box, i * 4));
      const range = Math.round(18 * scale);
      const field = signedField(ctx.getImageData(0, 0, off.width, off.height).data, off.width, off.height, range);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, off.width, off.height, 0, gl.RED, gl.UNSIGNED_BYTE, field);
      layout = { pad, scale, fontPx, range };
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    // --- input ---------------------------------------------------------
    const pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, last: 0, lastMove: -1e4 };
    const onMove = event => {
      const now = performance.now();
      const dt = Math.max(1, now - (pointer.last || now - 16)) / 1000;
      if (pointer.last) {
        pointer.vx = pointer.vx * 0.6 + ((event.clientX - pointer.x) / dt) * 0.4;
        pointer.vy = pointer.vy * 0.6 + ((event.clientY - pointer.y) / dt) * 0.4;
      }
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.last = now; pointer.lastMove = now;
    };
    const onLeave = () => { pointer.x = -1e4; pointer.y = -1e4; };
    addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    const phase = [0, 0];
    let lastRaly = null, frame = 0, last = 0, time = 0, visible = true;
    const approach = (value, target, rise, fall, dt) => value + (target - value) * (1 - Math.exp(-dt * (target > value ? rise : fall)));

    function step(dt) {
      time += dt;
      const rect = canvas.getBoundingClientRect();
      const px = pointer.x - rect.left - layout.pad, py = pointer.y - rect.top - layout.pad;
      const speed = Math.hypot(pointer.vx, pointer.vy);
      const flickX = pointer.vx, flickY = pointer.vy;
      pointer.vx *= Math.exp(-dt * 6); pointer.vy *= Math.exp(-dt * 6);
      phase[0] += (flickX * 0.9 + flickY * 0.33) * dt * 0.02;
      const rx = ralyScreen.x - rect.left - layout.pad, ry = ralyScreen.y - rect.top - layout.pad;
      if (lastRaly) phase[1] += Math.hypot(rx - lastRaly[0], ry - lastRaly[1]) * 0.01;
      lastRaly = [rx, ry];
      const idle = performance.now() - pointer.lastMove > 3000;
      const geometricAllowed = layout.fontPx >= 96;
      // Style slots: 0 engraving, 1 interference, 2 wet ink, 3 geometric,
      // 4 marbling, 5 risograph, 6 watercolor. The idle wave carries them in turn.
      const idleStyles = geometricAllowed ? [0, 4, 1, 6, 2, 5, 3] : [0, 4, 1, 6, 2, 5];
      const cycle = time / 8, style = idleStyles[Math.floor(cycle) % idleStyles.length];
      // What slow and fast attention bring out rotates every few seconds.
      const attentionStyle = [0, 4, 6][Math.floor(time / 14) % 3], quickStyle = [1, 5][Math.floor(time / 14) % 2];
      const crest = (cycle % 1) * (letters.length + 8) - 4;
      const sigma = layout.fontPx * 0.9, ralySigma = layout.fontPx * 1.1;
      const ralyWeight = innerWidth < 760 ? 0.45 : 1;

      letters.forEach((l, i) => {
        const dx = px - l.cx, dy = py - l.cy;
        const prox = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        const slow = 1 - smooth(200, 900, speed), fast = smooth(350, 1400, speed);
        const rdx = rx - l.cx, rdy = ry - l.cy;
        const rp = ralyScreen.visible ? ralyWeight * Math.exp(-(rdx * rdx + rdy * rdy) / (2 * ralySigma * ralySigma)) : 0;
        const wave = idle ? Math.exp(-(((i - crest) / 1.7) ** 2)) : 0;
        const targets = [0, 0, Math.min(1, rp * 1.2 + ralyScreen.startle * rp), 0, 0, 0, 0];
        targets[attentionStyle] = Math.max(targets[attentionStyle], prox * slow);
        targets[quickStyle] = Math.max(targets[quickStyle], prox * fast);
        targets[style] = Math.max(targets[style], 0.7 * wave);
        l.pressure = Math.max(0, l.pressure + dt * ((rp > 0.7 ? 0.7 : 0) + (prox * slow > 0.8 ? 0.22 : 0) - 0.12));
        if (geometricAllowed && l.pressure > 1 && l.geoTimer <= 0) {
          l.geoTimer = 2.8 + Math.random() * 1.8; l.pressure = 0;
          if (letters[i - 1]) letters[i - 1].pressure += 0.55;
          if (letters[i + 1]) letters[i + 1].pressure += 0.55;
        }
        l.geoTimer -= dt;
        targets[3] = Math.max(targets[3], l.geoTimer > 0 ? 1 : 0);
        l.targets = targets;
        const flowTarget = prox > 0.05 ? [flickX / 900, flickY / 900] : [0, 0];
        l.flow[0] = approach(l.flow[0], flowTarget[0], 3, 0.6, dt);
        l.flow[1] = approach(l.flow[1], flowTarget[1], 3, 0.6, dt);

        // 3D pose: lean away from the cursor and lift toward it; sway as raly
        // passes; a slow roll travels through when no one is around, and every
        // letter floats a little, out of step with its neighbours.
        const lean = prox * 0.3;
        const poseTarget = [
          clamp(-dy / sigma, -1, 1) * lean + rp * 0.16 * Math.sin(time * 2.2 + i * 0.7) + wave * 0.2 + 0.035 * Math.sin(time * 0.8 + i * 0.55),
          clamp(dx / sigma, -1, 1) * lean + rp * 0.12 * Math.cos(time * 1.8 + i * 0.5) + 0.03 * Math.cos(time * 0.65 + i * 0.8),
          prox * layout.fontPx * 0.1 + rp * layout.fontPx * 0.06 + wave * layout.fontPx * 0.05 + layout.fontPx * 0.012 * Math.sin(time * 1.1 + i * 0.6),
          clamp(dx / sigma, -1, 1) * prox * 0.03,
        ];
        // A fast pass nudges letters into a small, quickly settling sway.
        const kick = prox * fast * 0.0012;
        l.velocity[0] += flickY * kick * dt * 60; l.velocity[1] += flickX * kick * dt * 60;
        const stiffness = 34, damping = 9.5;
        for (let k = 0; k < 4; k++) {
          const accel = -stiffness * (l.pose[k] - poseTarget[k]) - damping * l.velocity[k];
          l.velocity[k] = clamp(l.velocity[k] + accel * dt, -2.5, 2.5);
          l.pose[k] += l.velocity[k] * dt;
        }
        // Never far enough to see the letter's side smear across its face.
        l.pose[0] = clamp(l.pose[0], -0.3, 0.3); l.pose[1] = clamp(l.pose[1], -0.3, 0.3); l.pose[3] = clamp(l.pose[3], -0.06, 0.06);
      });
      letters.forEach((l, i) => {
        const left = letters[i - 1]?.targets, right = letters[i + 1]?.targets;
        for (const k of [0, 1, 2, 4, 5, 6]) l.targets[k] = Math.max(l.targets[k], (((left?.[k] ?? 0) + (right?.[k] ?? 0)) * 0.5) * 0.55);
        l.engrave = approach(l.engrave, l.targets[0], 2.4, 0.35, dt);
        l.interfere = approach(l.interfere, l.targets[1], 5, 0.9, dt);
        l.ink = approach(l.ink, l.targets[2], 2, 0.3, dt);
        l.geo = approach(l.geo, l.targets[3], 3.2, 1.1, dt);
        l.marble = approach(l.marble, l.targets[4], 2.4, 0.35, dt);
        l.riso = approach(l.riso, l.targets[5], 5, 0.9, dt);
        l.water = approach(l.water, l.targets[6], 2, 0.3, dt);
        stateA.set([l.engrave, l.interfere, l.ink, l.geo], i * 4);
        stateC.set([l.marble, l.riso, l.water, 0], i * 4);
        stateB.set([l.flow[0], l.flow[1], l.seed, 0], i * 4);
        poses.set([l.pose[0], l.pose[1], l.pose[2] * layout.scale, l.pose[3]], i * 4);
      });
    }

    function draw() {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1i(U.uSdf, 0);
      gl.uniform4fv(U.uBox, boxes);
      gl.uniform4fv(U.uPose, poses);
      gl.uniform4fv(U.uA, stateA);
      gl.uniform4fv(U.uB, stateB);
      gl.uniform4fv(U.uC, stateC);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uRange, layout.range);
      gl.uniform1f(U.uPx, layout.scale);
      gl.uniform1f(U.uTime, time);
      gl.uniform1f(U.uCell, layout.fontPx * layout.scale * 0.105);
      gl.uniform2f(U.uPhase, phase[0], phase[1]);
      gl.uniform1f(U.uPad, layout.fontPx * layout.scale * 0.12);
      gl.uniform1f(U.uDepth, layout.fontPx * layout.scale * 0.045);
      const rect = canvas.getBoundingClientRect();
      gl.uniform2f(U.uRaly, (ralyScreen.x - rect.left) * layout.scale, (ralyScreen.y - rect.top) * layout.scale);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, letters.length * LAYERS);
    }

    function tick(now) {
      frame = requestAnimationFrame(tick);
      if (!visible || document.hidden) { last = 0; return; }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      step(dt);
      draw();
    }

    let ready = false;
    const rebuild = () => { build(); ready = true; draw(); };
    const observer = new ResizeObserver(() => { if (ready) rebuild(); });
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    document.fonts.ready.then(() => {
      rebuild();
      text.style.color = "transparent";
      observer.observe(wrap);
      io.observe(wrap);
      frame = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect(); io.disconnect();
      removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program);
    };
  }, []);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <h1 ref={textRef} className="headline-type relative z-[1] select-text" aria-label="running experiments">
        {LINES.map(line => (
          <span key={line} data-line className="block w-fit">{line}</span>
        ))}
      </h1>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute pointer-events-none z-[2]" />
    </div>
  );
};

export default ReactiveHeadline;
