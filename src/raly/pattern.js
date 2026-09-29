import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

// A living skin: Gray-Scott reaction-diffusion, the chemistry behind real
// leopard and whale-shark spots, simulated on the GPU. Each surface owns a
// horizontal band of one atlas texture (u along, v across); bands never leak
// into each other.
//
// The regime drifts slowly, so the fins wander from spots toward worms and
// labyrinths and back, while the whale-shark back holds its constellation.
// inject() seeds new pigment where the cursor lingers near the body.

const MAX_REGIONS = 8;

const simulate = /* glsl */`
precision highp float;
uniform sampler2D uState;
uniform vec2 uSize;
uniform vec4 uRegions[${MAX_REGIONS}]; // y0, y1 (pixels), kind, unused
uniform float uDrift;
uniform vec4 uInject;                   // x, y (pixels), radius, strength
varying vec2 vUv;

vec2 cell(vec2 p, vec2 lo, vec2 hi) { return texture2D(uState, clamp(p, lo, hi) / uSize).rg; }

void main() {
  vec2 px = gl_FragCoord.xy;
  vec4 region = vec4(-1.0);
  for (int i = 0; i < ${MAX_REGIONS}; i++) {
    if (px.y >= uRegions[i].x && px.y < uRegions[i].y) region = uRegions[i];
  }
  if (region.z < 0.0) { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); return; }
  vec2 lo = vec2(0.5, region.x + 0.5), hi = vec2(uSize.x - 0.5, region.y - 0.5);
  vec2 c = cell(px, lo, hi);
  vec2 lap = -c
    + 0.2 * (cell(px + vec2(1, 0), lo, hi) + cell(px - vec2(1, 0), lo, hi) + cell(px + vec2(0, 1), lo, hi) + cell(px - vec2(0, 1), lo, hi))
    + 0.05 * (cell(px + vec2(1, 1), lo, hi) + cell(px - vec2(1, 1), lo, hi) + cell(px + vec2(1, -1), lo, hi) + cell(px - vec2(1, -1), lo, hi));

  // Feed/kill by anatomy: the muscle line keeps stable spots; the fins
  // drift toward worms and labyrinths as uDrift rises.
  float across = abs(2.0 * (px.y - region.x) / (region.y - region.x) - 1.0);
  float fin = region.z < 1.5 ? smoothstep(0.3, 0.6, across) : 0.6;
  vec2 spots = vec2(0.037, 0.0648);
  vec2 worms = vec2(0.046, 0.0632);
  vec2 maze = vec2(0.029, 0.057);
  vec2 wander = mix(worms, maze, smoothstep(0.5, 1.0, uDrift));
  vec2 fk = mix(spots, wander, fin * smoothstep(0.15, 0.65, uDrift));
  float a = c.r, b = c.g, abb = a * b * b;
  a += 1.0 * lap.r - abb + fk.x * (1.0 - a);
  b += 0.5 * lap.g + abb - (fk.x + fk.y) * b;

  float touch = uInject.w * (1.0 - smoothstep(0.0, uInject.z, distance(px, uInject.xy)));
  b = mix(b, 0.9, touch);
  a = mix(a, 0.35, touch);
  gl_FragColor = vec4(clamp(a, 0.0, 1.0), clamp(b, 0.0, 1.0), 0.0, 1.0);
}`;

const seedShader = /* glsl */`
precision highp float;
uniform float uSeed;
varying vec2 vUv;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  float spark = step(0.972, hash(floor(gl_FragCoord.xy / 3.0) + uSeed));
  gl_FragColor = vec4(1.0 - 0.5 * spark, spark * 0.9, 0.0, 1.0);
}`;

const vertex = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export function createPattern(renderer, surfaces, { size = 512, seed = 0 } = {}) {
  const supported = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;

  // Bands: the mantle gets the most room, ribbons share the rest.
  const ribbons = surfaces.filter(s => s.kind === 2);
  const heights = surfaces.map(s => s.kind === 0 ? 0.44 : s.kind === 1 ? 0.28 : 0.28 / ribbons.length);
  const regions = [];
  let y = 0;
  surfaces.forEach((surface, i) => {
    const y0 = Math.round(y), y1 = i === surfaces.length - 1 ? size : Math.round(y + heights[i] * size);
    y += heights[i] * size;
    const gutter = 1;
    regions.push(new THREE.Vector4(y0 + gutter, y1 - gutter, surface.kind, 0));
    // Half-texel insets keep linear sampling inside the band.
    surface.patternRect = new THREE.Vector4(0.5 / size, (y0 + gutter + 0.5) / size, 1 - 0.5 / size, (y1 - gutter - 0.5) / size);
  });
  while (regions.length < MAX_REGIONS) regions.push(new THREE.Vector4(-1, -1, -1, 0));

  if (!supported) {
    return { texture: blank, supported, step() {}, inject() {}, dispose() { blank.dispose(); } };
  }

  const options = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
  const targets = [new THREE.WebGLRenderTarget(size, size, options), new THREE.WebGLRenderTarget(size, size, options)];
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uState: { value: null }, uSize: { value: new THREE.Vector2(size, size) }, uRegions: { value: regions },
      uDrift: { value: 0 }, uInject: { value: new THREE.Vector4(0, 0, 1, 0) },
    },
    vertexShader: vertex, fragmentShader: simulate, depthTest: false, depthWrite: false,
  });
  const seedMaterial = new THREE.ShaderMaterial({ uniforms: { uSeed: { value: seed } }, vertexShader: vertex, fragmentShader: seedShader });
  const quad = new FullScreenQuad(seedMaterial);
  let current = 0;
  const previousTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(targets[0]); quad.render(renderer);
  renderer.setRenderTarget(previousTarget);
  quad.material = material;

  const api = {
    supported,
    texture: targets[0].texture,
    step(iterations, drift) {
      const before = renderer.getRenderTarget();
      material.uniforms.uDrift.value = drift;
      for (let i = 0; i < iterations; i++) {
        material.uniforms.uState.value = targets[current].texture;
        renderer.setRenderTarget(targets[1 - current]);
        quad.render(renderer);
        current = 1 - current;
        // Injection lasts one iteration per call; it is re-armed each frame.
        material.uniforms.uInject.value.w = 0;
      }
      renderer.setRenderTarget(before);
      api.texture = targets[current].texture;
    },
    /** Seeds pigment on a surface at (u, v) in its own [0, 1] coordinates. */
    inject(surface, u, v, strength = 0.8) {
      const rect = surface.patternRect;
      material.uniforms.uInject.value.set(
        (rect.x + (rect.z - rect.x) * u) * size, (rect.y + (rect.w - rect.y) * v) * size, 5, strength);
    },
    dispose() { targets.forEach(t => t.dispose()); material.dispose(); seedMaterial.dispose(); quad.dispose(); blank.dispose(); },
  };
  return api;
}
