import { useEffect, useRef } from "react";
import { ralyScreen } from "../raly/store";

// "running experiments", set in a quiet serif that is also a small complex
// system. Every letter carries its own state for four styles and moves
// between them on its own:
//
//   engraving     slow attention: solid ink opens into fine contour lines
//   interference  a fast-moving cursor: two stripe layers beat against each
//                 other; the cursor shifts one, raly bends the other
//   wet ink       raly passing close re-wets letters, which swell and bleed,
//                 then slowly dry back into type
//   geometric     rare: pressure builds when raly lingers (or a visitor does);
//                 past a threshold a letter reorganises into print shapes and
//                 pushes its neighbours toward doing the same
//
// Letters are coupled to their neighbours, remember recent input (fast
// attack, slow decay), and with no one around a slow wave carries each style
// across the words in turn. The words stay readable throughout: every style
// is drawn inside a distance field of the real glyphs. The DOM keeps the real
// text for screen readers, selection and search.

const LINES = ["running", "experiments"];
const MAX_LETTERS = 24;
const INK = [0x2e / 255, 0x28 / 255, 0x26 / 255];

const vertexSource = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const fragmentSource = `#version 300 es
precision highp float;
uniform sampler2D uSdf;
uniform vec4 uBox[${MAX_LETTERS}];   // letter bounds in canvas px (x0, y0, x1, y1)
uniform vec4 uA[${MAX_LETTERS}];     // engraving, interference, wet ink, geometric
uniform vec4 uB[${MAX_LETTERS}];     // flow x, flow y, seed, pressure
uniform int uCount;
uniform vec2 uRes;
uniform float uRange;
uniform float uPx;
uniform float uTime;
uniform float uCell;
uniform vec2 uPhase;
uniform vec2 uRaly;
uniform vec3 uInk;
in vec2 vUv;
out vec4 outColor;

float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) { return 0.55 * noise(p) + 0.3 * noise(p * 2.1 + 5.2) + 0.15 * noise(p * 4.3 + 1.7); }
// Signed distance to the glyphs in canvas px; negative inside.
float sdfAt(vec2 px) { return (texture(uSdf, px / uRes).r - 0.5) * 2.0 * uRange; }

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  float d = sdfAt(p);
  if (d > uRange * 0.95) { outColor = vec4(0.0); return; }

  int id = -1;
  for (int i = 0; i < ${MAX_LETTERS}; i++) {
    if (i >= uCount) break;
    vec4 b = uBox[i];
    if (p.x >= b.x && p.x < b.z && p.y >= b.y && p.y < b.w) { id = i; break; }
  }
  vec4 a = id >= 0 ? uA[id] : vec4(0.0);
  vec4 bb = id >= 0 ? uB[id] : vec4(0.0);
  float aa = 0.9 * uPx;
  float inside = 1.0 - smoothstep(-aa, aa, d);

  // Engraving: contour lines that follow the glyph's outline, bent by the
  // cursor's recent direction, inside a firm printed edge.
  vec2 flow = bb.xy;
  float bend = 3.0 * uPx * sin(dot(p, normalize(flow + vec2(0.001, 0.0))) * 0.035 + uTime * 0.6 + bb.z * 6.0) * length(flow);
  float spacing = 3.4 * uPx;
  float contour = abs(fract((d + bend) / spacing) - 0.5) * 2.0;
  float lines = smoothstep(0.35, 0.85, contour) * inside;
  float edge = (1.0 - smoothstep(0.0, 1.8 * uPx, abs(d + 0.9 * uPx)));
  float engraved = max(lines, edge);
  vec3 engraveColor = mix(uInk, vec3(0.2, 0.3, 0.72), smoothstep(0.62, 0.95, fbm(p * 0.01 + bb.z * 9.0)) * 0.7);

  // Interference: two stripe systems; where they agree, cobalt shows.
  float period = 6.0 * uPx;
  vec2 ralyDir = normalize(p - uRaly + 0.001);
  float s1 = 0.5 + 0.5 * sin(dot(p, vec2(0.94, 0.34)) / period * 6.2832 + uPhase.x);
  float s2 = 0.5 + 0.5 * sin(dot(p, vec2(0.87, -0.5) + 0.25 * ralyDir) / (period * 1.07) * 6.2832 + uPhase.y);
  float stripes = smoothstep(0.38, 0.62, s1) * inside;
  vec3 interfereColor = mix(uInk, vec3(0.1, 0.24, 0.72), smoothstep(0.55, 0.9, s1 * s2));

  // Wet ink: the edge swells and feathers; dry-brush streaks run along the
  // letter; a maroon wash where it bleeds.
  float wet = a.z;
  float grain = fbm(p * vec2(0.012, 0.012) + vec2(uTime * 0.04, bb.z * 11.0));
  float dd = d + (grain - 0.5) * 26.0 * uPx * wet - 7.0 * uPx * wet;
  float swell = 1.0 - smoothstep(-2.0 * uPx, (1.5 + 7.0 * wet) * uPx, dd);
  float streak = noise(vec2(p.x * 0.008, p.y * 0.32) + bb.z * 3.0);
  swell *= mix(1.0, 0.35 + 0.65 * smoothstep(0.25, 0.6, streak), smoothstep(-10.0 * uPx, 0.0, d) * wet);
  vec3 inkColor = mix(uInk, vec3(0.36, 0.07, 0.19), smoothstep(-6.0 * uPx, 5.0 * uPx, dd) * 0.85);
  inkColor *= 0.85 + 0.3 * grain;

  // Geometric: the letter rebuilt from print modules on a grid; a few
  // modules in cobalt or coral.
  vec2 cellId = floor(p / uCell);
  vec2 q = fract(p / uCell);
  float cellInside = step(sdfAt((cellId + 0.5) * uCell), uCell * 0.12);
  float h = hash(cellId + bb.z * 17.0);
  float shape;
  if (h < 0.45) shape = 1.0;
  else if (h < 0.65) shape = step(length(q - vec2(step(0.5, fract(h * 7.0)), step(0.5, fract(h * 13.0)))), 1.0);
  else if (h < 0.85) shape = step(length(q - vec2(0.5, step(0.5, fract(h * 5.0)))), 0.5);
  else shape = step(length(q - 0.5), 0.5);
  float geometric = cellInside * shape;
  vec3 geoColor = uInk;
  float tint = hash(cellId * 1.7 + 3.1);
  if (tint > 0.86) geoColor = vec3(0.13, 0.28, 0.72);
  else if (tint > 0.76) geoColor = vec3(0.93, 0.42, 0.3);
  geoColor *= 0.9 + 0.12 * noise(p * 0.35);

  // Blend the styles by the letter's state; the rest is plain printed type.
  float total = a.x + a.y + a.z + a.w;
  float scale = total > 1.0 ? 1.0 / total : 1.0;
  vec4 w = a * scale;
  float wBase = max(0.0, 1.0 - (w.x + w.y + w.z + w.w));
  float cover = wBase * inside + w.x * engraved + w.y * stripes + w.z * swell + w.w * geometric;
  vec3 color = (wBase * inside * uInk + w.x * engraved * engraveColor + w.y * stripes * interfereColor
    + w.z * swell * inkColor + w.w * geometric * geoColor) / max(cover, 1e-4);
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
    // Sub-pixel edge from coverage keeps the outline smooth.
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

const ReactiveHeadline = ({ className = "" }) => {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current, text = textRef.current;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false });
    if (!gl || reduced) { text.style.color = ""; canvas.style.display = "none"; return undefined; }

    let program;
    try {
      program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    } catch (error) {
      console.error(error);
      text.style.color = ""; canvas.style.display = "none";
      return undefined;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = name => gl.getUniformLocation(program, name);
    const U = {
      sdf: u("uSdf"), box: u("uBox"), a: u("uA"), b: u("uB"), count: u("uCount"), res: u("uRes"), range: u("uRange"),
      px: u("uPx"), time: u("uTime"), cell: u("uCell"), phase: u("uPhase"), raly: u("uRaly"), ink: u("uInk"),
    };
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Letters: canvas-px boxes and CSS-px centres.
    let letters = [];
    let layout = { pad: 0, scale: 1, width: 1, height: 1, fontPx: 100 };
    const boxes = new Float32Array(MAX_LETTERS * 4), stateA = new Float32Array(MAX_LETTERS * 4), stateB = new Float32Array(MAX_LETTERS * 4);

    function build() {
      const style = getComputedStyle(text);
      const fontPx = parseFloat(style.fontSize);
      const scale = Math.min(devicePixelRatio || 1, 1.75);
      const pad = Math.round(fontPx * 0.12);
      const rect = text.getBoundingClientRect();
      const width = Math.ceil(rect.width + pad * 3), height = Math.ceil(rect.height + pad * 2);
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      canvas.style.left = `${-pad}px`; canvas.style.top = `${-pad}px`;
      const off = document.createElement("canvas");
      off.width = canvas.width; off.height = canvas.height;
      const ctx = off.getContext("2d", { willReadFrequently: true });
      const font = `${style.fontStyle} ${style.fontWeight} ${fontPx * scale}px ${style.fontFamily}`;
      ctx.font = font;
      // Match the CSS tracking so canvas glyphs sit where the DOM text does.
      if ("letterSpacing" in ctx) ctx.letterSpacing = `${parseFloat(style.letterSpacing || "0") * scale}px`;
      ctx.fillStyle = "#000";
      ctx.textBaseline = "alphabetic";
      letters = [];
      const lineEls = text.querySelectorAll("[data-line]");
      lineEls.forEach(lineEl => {
        const r = lineEl.getBoundingClientRect();
        const word = lineEl.textContent;
        const metrics = ctx.measureText(word);
        const ascent = metrics.fontBoundingBoxAscent ?? fontPx * scale * 0.8;
        const descent = metrics.fontBoundingBoxDescent ?? fontPx * scale * 0.2;
        const lineHeight = r.height * scale;
        const x0 = (r.left - rect.left + pad) * scale;
        const baseline = (r.top - rect.top + pad) * scale + (lineHeight - (ascent + descent)) / 2 + ascent;
        ctx.fillText(word, x0, baseline);
        for (let i = 0; i < word.length && letters.length < MAX_LETTERS; i++) {
          const start = ctx.measureText(word.slice(0, i)).width, end = ctx.measureText(word.slice(0, i + 1)).width;
          letters.push({
            box: [x0 + start, baseline - ascent, x0 + end, baseline + descent],
            cx: (x0 + (start + end) / 2) / scale - pad, cy: (baseline - ascent * 0.45) / scale - pad,
            seed: Math.random(),
            engrave: 0, interfere: 0, ink: 0, geo: 0, pressure: 0, geoTimer: 0, flow: [0, 0],
          });
        }
      });
      // Boxes meet halfway so every pixel near the words belongs to a letter.
      letters.forEach((l, i) => {
        const next = letters[i + 1];
        const sameLine = next && Math.abs(next.box[1] - l.box[1]) < 2;
        boxes.set([l.box[0] - (i === 0 || Math.abs(letters[i - 1].box[1] - l.box[1]) > 2 ? pad * scale : 0), l.box[1] - pad * scale * 0.5,
          sameLine ? next.box[0] : l.box[2] + pad * scale, l.box[3] + pad * scale * 0.5], i * 4);
      });
      const range = Math.round(18 * scale);
      const image = ctx.getImageData(0, 0, off.width, off.height).data;
      const field = signedField(image, off.width, off.height, range);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, off.width, off.height, 0, gl.RED, gl.UNSIGNED_BYTE, field);
      layout = { pad, scale, width, height, fontPx, range, rect: null };
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    // --- input -----------------------------------------------------------
    const pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, speed: 0, last: 0, lastMove: -1e4, t: 0 };
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
      pointer.vx *= Math.exp(-dt * 6); pointer.vy *= Math.exp(-dt * 6);
      phase[0] += (pointer.vx * 0.9 + pointer.vy * 0.33) * dt * 0.02;
      const rx = ralyScreen.x - rect.left - layout.pad, ry = ralyScreen.y - rect.top - layout.pad;
      if (lastRaly) phase[1] += Math.hypot(rx - lastRaly[0], ry - lastRaly[1]) * 0.01;
      lastRaly = [rx, ry];
      const idle = performance.now() - pointer.lastMove > 3000;
      // The idle wave: each style in turn crosses the words.
      // Geometric print modules need room; below this size they read as noise.
      const geometricAllowed = layout.fontPx >= 96;
      const cycle = time / 9, style = Math.floor(cycle) % (geometricAllowed ? 4 : 3), crest = (cycle % 1) * (letters.length + 8) - 4;
      const sigma = layout.fontPx * 0.9, ralySigma = layout.fontPx * 1.1;
      // On small screens raly is never far from the words; let it touch them
      // more lightly.
      const ralyWeight = innerWidth < 760 ? 0.45 : 1;
      letters.forEach((l, i) => {
        const prox = Math.exp(-((px - l.cx) ** 2 + (py - l.cy) ** 2) / (2 * sigma * sigma));
        const slow = 1 - smooth(200, 900, speed), fast = smooth(350, 1400, speed);
        const rp = ralyScreen.visible ? ralyWeight * Math.exp(-((rx - l.cx) ** 2 + (ry - l.cy) ** 2) / (2 * ralySigma * ralySigma)) : 0;
        const wave = idle ? 0.6 * Math.exp(-(((i - crest) / 1.7) ** 2)) : 0;
        const targets = [prox * slow, prox * fast, Math.min(1, rp * 1.2 + ralyScreen.startle * rp), 0];
        targets[style] = Math.max(targets[style], wave);
        // Pressure for the rare geometric change: raly lingering close, or a
        // visitor lingering over the same letter.
        l.pressure = Math.max(0, l.pressure + dt * ((rp > 0.7 ? 0.7 : 0) + (prox * slow > 0.8 ? 0.22 : 0) - 0.12));
        if (geometricAllowed && l.pressure > 1 && l.geoTimer <= 0) {
          l.geoTimer = 2.8 + Math.random() * 1.8; l.pressure = 0;
          if (letters[i - 1]) letters[i - 1].pressure += 0.55;
          if (letters[i + 1]) letters[i + 1].pressure += 0.55;
        }
        l.geoTimer -= dt;
        targets[3] = Math.max(targets[3], l.geoTimer > 0 ? 1 : 0, style === 3 ? wave : 0);
        l.targets = targets;
        const flowTarget = prox > 0.05 ? [pointer.vx / 900, pointer.vy / 900] : [0, 0];
        l.flow[0] = approach(l.flow[0], flowTarget[0], 3, 0.6, dt);
        l.flow[1] = approach(l.flow[1], flowTarget[1], 3, 0.6, dt);
      });
      // Neighbours pull each other along.
      letters.forEach((l, i) => {
        const left = letters[i - 1]?.targets, right = letters[i + 1]?.targets;
        for (let k = 0; k < 3; k++) {
          const n = ((left?.[k] ?? 0) + (right?.[k] ?? 0)) * 0.5;
          l.targets[k] = Math.max(l.targets[k], n * 0.55);
        }
        l.engrave = approach(l.engrave, l.targets[0], 2.4, 0.3, dt);
        l.interfere = approach(l.interfere, l.targets[1], 5, 0.8, dt);
        l.ink = approach(l.ink, l.targets[2], 2, 0.22, dt);
        l.geo = approach(l.geo, l.targets[3], 3.2, 1.1, dt);
        stateA.set([l.engrave, l.interfere, l.ink, l.geo], i * 4);
        stateB.set([l.flow[0], l.flow[1], l.seed, l.pressure], i * 4);
      });
    }

    function draw() {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1i(U.sdf, 0);
      gl.uniform4fv(U.box, boxes);
      gl.uniform4fv(U.a, stateA);
      gl.uniform4fv(U.b, stateB);
      gl.uniform1i(U.count, letters.length);
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1f(U.range, layout.range);
      gl.uniform1f(U.px, layout.scale);
      gl.uniform1f(U.time, time);
      gl.uniform1f(U.cell, layout.fontPx * layout.scale * 0.105);
      gl.uniform2f(U.phase, phase[0], phase[1]);
      const rect = canvas.getBoundingClientRect();
      gl.uniform2f(U.raly, (ralyScreen.x - rect.left) * layout.scale, (ralyScreen.y - rect.top) * layout.scale);
      gl.uniform3f(U.ink, INK[0], INK[1], INK[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
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

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export default ReactiveHeadline;
