const MAX_LETTERS = 24;
const LAYERS = 9;

const vertexSource = `#version 300 es
precision highp float;
in vec2 aCorner;
uniform vec4 uBox[${MAX_LETTERS}];
uniform vec4 uPose[${MAX_LETTERS}];   // tilt x, tilt y, lift (px), spin z
uniform vec4 uDance[${MAX_LETTERS}];  // hop (px), squash, step aside (px), unused
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
  // Dancing: squash and stretch from the letter's foot, so it lands and pushes off.
  vec4 dance = uDance[letter];
  float foot = (uBox[letter].w - uBox[letter].y) * 0.5;
  v.y = (v.y - foot) * (1.0 - dance.y) + foot;
  v.x *= 1.0 + dance.y * 0.6;
  float cz = cos(pose.w), sz = sin(pose.w);
  v.xy = mat2(cz, -sz, sz, cz) * v.xy;
  float cx = cos(pose.x), sx = sin(pose.x);
  v = vec3(v.x, cx * v.y - sx * v.z, sx * v.y + cx * v.z);
  float cy = cos(pose.y), sy = sin(pose.y);
  v = vec3(cy * v.x + sy * v.z, v.y, -sy * v.x + cy * v.z);
  v.z += pose.z;
  float focal = uRes.y * 2.2;
  vec2 screen = center + v.xy * focal / (focal - v.z) + vec2(dance.z, -dance.x);
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
uniform float uDark;
// The field is an atlas, one padded cell per letter: layout point + offset.
uniform vec4 uAtlas[${MAX_LETTERS}];
uniform vec2 uAtlasRes;
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
float sdfAt(vec2 px) { return (texture(uSdf, (px + uAtlas[vLetter].xy) / uAtlasRes).r - 0.5) * 2.0 * uRange; }

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
    side += uDark * (1.0 - 2.0 * dot(side, vec3(0.299, 0.587, 0.114)));
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
  // Night: flip each colour's lightness and keep its hue, so ink becomes pale
  // paper-coloured type and the coloured styles stay recognisable.
  color = clamp(color + uDark * (1.0 - 2.0 * dot(color, vec3(0.299, 0.587, 0.114))), 0.0, 1.0);
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
  // Querying COMPILE_STATUS here can block on the driver. Check the linked
  // program only after the parallel-completion poll below has finished.
  return shader;
}


let canvas, gl, program, U, texture, linked = false, pendingBuild = null, pendingFrame = null, built = false, dark = false, atlas = null;
function initialize(target) {
  canvas = target;
  gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: true });
  if (!gl) throw new Error('WebGL2 unavailable');
  canvas.addEventListener('webglcontextlost', () => postMessage({ type: 'error', message: 'Graphics context lost' }));
  program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  function poll() {
    if (parallel && !gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) { setTimeout(poll, 30); return; }
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { postMessage({ type: 'error', message: gl.getProgramInfoLog(program) }); return; }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "aCorner");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uniform = name => gl.getUniformLocation(program, name);
    U = Object.fromEntries(["uSdf", "uBox", "uPose", "uA", "uB", "uC", "uRes", "uRange", "uPx", "uTime", "uCell", "uPhase", "uRaly", "uPad", "uDepth", "uDance", "uDark", "uAtlas", "uAtlasRes"].map(n => [n, uniform(n)]));
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);


    linked = true; flush();
  }
  poll();
}
function flush() {
  if (!linked) return;
  if (pendingBuild) {
    const { alpha, width, height, canvasWidth, canvasHeight, offsets, range } = pendingBuild; pendingBuild = null;
    canvas.width = canvasWidth; canvas.height = canvasHeight;
    const field = signedField(alpha, width, height, range);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, field);
    gl.viewport(0, 0, canvasWidth, canvasHeight); built = true;
    atlas = { offsets, width, height };
  }
  if (!built || !pendingFrame) return;
  const { boxes, poses, dance, stateA, stateB, stateC, layout, time, phase, raly, count } = pendingFrame;
  pendingFrame = null;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1i(U.uSdf, 0);
      gl.uniform4fv(U.uBox, boxes);
      gl.uniform4fv(U.uPose, poses);
      gl.uniform4fv(U.uDance, dance);
      gl.uniform1f(U.uDark, dark ? 1 : 0);
      gl.uniform4fv(U.uAtlas, atlas.offsets);
      gl.uniform2f(U.uAtlasRes, atlas.width, atlas.height);
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
      gl.uniform2f(U.uRaly, raly[0], raly[1]);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count * LAYERS);

  postMessage({ type: 'painted' });
}
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'init') initialize(data.canvas);
    if (data.type === 'build') pendingBuild = data;
    if (data.type === 'frame') pendingFrame = data;
    if (data.type === 'theme') dark = data.dark;
    flush();
  } catch (error) { postMessage({ type: 'error', message: error.message }); }
};
