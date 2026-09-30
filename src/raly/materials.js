import * as THREE from 'three';
import { lookDeclarations, lookFragment } from './looks.js';
import { RIBBON_NODES, SPINE_SAMPLES } from './anatomy.js';

// raly's shading (from membrane study 08). Every surface uses three materials that share one vertex
// path (organismPlace): the lit skin, a shadow caster and an ID pass that the
// post-processing uses to find where membranes cut through each other.
//
// Vertex path:
//  1. Rest-space motion: traveling ruffles, scallops and the slow genome
//     (breadth, drape, ruffle gain, frill bloom) that lets the body plan drift.
//  2. Placement: body sheets hang from the bent spine (uSpinePos/uSpineQuat);
//     ribbons hang from their simulated chain (uRibPos/uRibQuat, in world
//     space). Chain .w carries presence, which thins a ribbon to nothing where
//     it has turned out of our three dimensions.
// Three tissues the organism can be made of, and a field that decides which
// one each point currently is. The field travels along the body, so a front
// of transformation sweeps through it; at times the whole body is one tissue,
// at times it is a hybrid.
//   x: cuttlefish membrane  soft, ruffled, chromatophores
//   y: antler               stiff, extended, dissolved down to forked tines
//                            over a porous bone lattice
//   z: pangolin             contracted, domed, overlapping keratin plates
// Shared by the vertex path (stiffness and shape) and every fragment path
// (the skin, the shadow caster and the seam ids all cut the same holes).
export const morphChunk = /* glsl */`
uniform vec4 uMorph; // x cycle position (0..3 repeating), y spread along the body, z front wobble, w antler reach
float morphHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 morphHash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
vec3 morphWeights(float arcN, float s) {
  float e = abs(s);
  float wobble = 0.08 * sin(arcN * 11.0 + s * 3.0 + uSeed * 3.0) + 0.05 * sin(arcN * 27.0 - s * 7.0 + uSeed);
  float x = uMorph.x + uMorph.y * (arcN * 1.4 + e * 0.3) + wobble * uMorph.z;
  vec3 w = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float d = abs(mod(x - float(i) + 1.5, 3.0) - 1.5);
    w[i] = 1.0 - smoothstep(0.3, 0.7, d);
  }
  return w / max(w.x + w.y + w.z, 1e-3);
}
// Antler: x > 0 inside bone (in tine widths), y = how close to a tine tip.
vec2 morphAntler(float arc, float s, float w) {
  float e = abs(s);
  float spacing = uKind > 1.5 ? 0.6 : (uKind > 0.5 ? 0.95 : 1.3);
  float best = -20.0, tip = 0.0;
  float base = floor(arc / spacing);
  for (int k = -2; k <= 1; k++) {
    float i = base + float(k);
    vec2 r = morphHash2(vec2(i, uSeed * 13.0 + sign(s) * 7.0));
    // Tines sweep back toward the tail and fork partway out.
    float center = (i + 0.5 + (r.x - 0.5) * 0.35) * spacing + spacing * 0.6 * pow(e, 1.6);
    float x = arc - center;
    float width = spacing * mix(0.2, 0.06, e);
    float forkAt = 0.5 + 0.28 * r.y;
    float spread = spacing * (0.3 + 0.35 * r.x) * max(0.0, e - forkAt) / (1.0 - forkAt);
    float inside = e < forkAt ? width - abs(x) : width * 0.85 - min(abs(x - spread), abs(x + spread * 0.7));
    float field = inside / width;
    if (field > best) { best = field; tip = smoothstep(0.86, 0.99, e) * step(0.0, inside); }
  }
  // A porous bone lattice joins the tines near the spine.
  vec2 p = vec2(arc, s * w) * 2.4 + uSeed;
  vec2 cell = floor(p), f = fract(p);
  float pore = -10.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 r = morphHash2(cell + g);
    pore = max(pore, 0.2 + 0.17 * r.x - length(g + 0.2 + 0.6 * r - f));
  }
  float webEdge = 0.32 + 0.1 * sin(arc * 2.3 + uSeed);
  float web = min((webEdge - e) * 6.0, -pore * 7.0 + (e < 0.16 ? 3.0 : 0.0));
  return vec2(max(best, web), tip);
}
// Pangolin: x plate height (0 in a crevice), y seam darkness, z plate id.
vec3 morphScales(float arc, float s, float w) {
  float size = uKind > 1.5 ? 0.16 : 0.33;
  vec2 q = vec2(arc, s * w) / size;
  float row = floor(q.x);
  vec3 plate = vec3(0.0, 1.0, 0.0);
  bool found = false;
  // Head-side rows lie on top; each plate points toward the tail.
  for (int dr = -1; dr <= 1; dr++) {
    float r = row + float(dr);
    float offset = mod(r, 2.0) * 0.5;
    float colBase = floor(q.y - offset);
    for (int dc = -1; dc <= 1; dc++) {
      if (found) continue;
      float c = colBase + float(dc) + offset;
      vec2 local = vec2(q.x - (r + 0.5), q.y - (c + 0.5));
      float across = 0.62 * (1.0 - 0.45 * smoothstep(0.0, 0.75, local.x));
      float inside = 1.0 - length(vec2(local.x / 0.78, local.y / across));
      if (inside > 0.0) {
        found = true;
        plate = vec3(0.3 + 0.7 * smoothstep(-0.75, 0.65, local.x), 1.0 - smoothstep(0.0, 0.14, inside), morphHash(vec2(r, c) + uSeed));
      }
    }
  }
  return plate;
}
// Positive: keep this fragment. The antler threshold rises with its weight,
// so tissue burns away from between the tines inward.
float morphKeep(vec3 wts, vec2 antler, vec3 plate, float e, float grain) {
  float antlerKeep = antler.x + (1.0 - wts.y) * 9.0 + (grain - 0.5) * 1.6 * (1.0 - wts.y);
  float notch = 1.0 - 2.0 * smoothstep(0.35, 0.6, wts.z) * step(0.9, e) * step(0.55, plate.y);
  return min(antlerKeep, notch);
}
`;

const motion = /* glsl */`
attribute vec3 aTu;
attribute vec3 aTv;
attribute vec4 aSurf;
attribute vec4 aAnchor;
uniform float uBodyPhase;
uniform float uBodyStrength;
uniform float uEffort;
uniform float uKind;
uniform float uSeed;
uniform float uLength;
uniform vec4 uGenome;
uniform vec4 uPatternRect;
varying vec4 vSurf;
varying vec2 vPatternUv;
${morphChunk}
#ifdef ORGANISM_RIBBON
  uniform vec4 uRibPos[${RIBBON_NODES}];
  uniform vec4 uRibQuat[${RIBBON_NODES}];
  uniform float uScale;
#else
  uniform vec3 uSpinePos[${SPINE_SAMPLES}];
  uniform vec4 uSpineQuat[${SPINE_SAMPLES}];
  uniform float uSpineLength;
#endif

vec3 quatRotate(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
vec4 quatMix(vec4 a, vec4 b, float t) { return normalize(mix(a, dot(a, b) < 0.0 ? -b : b, t)); }

// Displacement along the rest normal.
float organismNormalShift(float arc, float s, float w, float u) {
  float e = abs(s);
  float side = s < 0.0 ? -1.0 : 1.0;
  float wavelength = uKind < 0.5 ? 1.65 : 1.05;
  float travel = arc * 6.2831853 / wavelength - uBodyPhase * 6.0 + side * 1.35 + uSeed;
  float breadth = 0.3 + 0.1 * sin(arc * 0.85 + uSeed * 2.0 + side) + 0.03 * sin(uBodyPhase + arc * 0.4);
  float ruffle = w * breadth * uGenome.z * (1.0 + 0.4 * uEffort) * pow(e, 2.0) * sin(travel);
  ruffle += w * 0.018 * pow(e, 4.0) * sin(arc * 2.1 * 6.2831853 / wavelength - uBodyPhase * 8.0 + side * 2.0);
  float drape = -uGenome.y * w * s * s;
  // Bone and armor do not ripple. Antler tines curl up toward the back;
  // pangolin plates dome the body and roll its edges under.
  vec3 mw = morphWeights(arc / max(uLength, 0.001), s);
  ruffle *= mw.x + 0.18 * mw.y + 0.1 * mw.z;
  float fin = uBodyStrength * ruffle + drape + w * (mw.y * 0.1 * (1.0 - e * e) + mw.z * (0.16 * (1.0 - e * e) - 0.32 * s * s));
  // Ribbons get their whip from physics; only their edges flutter here.
  float flutter = w * 0.28 * e * e * sin(arc * 5.0 - uBodyPhase * 8.0 + s * 1.6) * smoothstep(0.0, 0.2, u) * uBodyStrength * (mw.x + 0.25);
  return uKind < 1.5 ? fin : flutter;
}

// Displacement outward across the sheet: scallops and the breathing breadth.
float organismOutwardShift(float arc, float s, float w) {
  float side = s < 0.0 ? -1.0 : 1.0;
  float wavelength = uKind < 0.5 ? 1.65 : 1.05;
  float travel = arc * 6.2831853 / wavelength - uBodyPhase * 6.0 + side * 1.35 + uSeed;
  float breadth = (uKind < 0.5 ? uGenome.x : uGenome.w) - 1.0;
  vec3 mw = morphWeights(arc / max(uLength, 0.001), s);
  float shift = uBodyStrength * w * 0.045 * pow(abs(s), 3.0) * cos(travel) * mw.x + breadth * w * abs(s) * 0.85;
  // Antler and pangolin both draw the sheet in: the real tines and plates
  // grow out of what remains.
  shift -= w * abs(s) * (0.3 * mw.y + 0.14 * mw.z);
  return uKind < 1.5 ? shift : 0.0;
}

// Where the living sheet puts a rest-space point: rest-space motion, then
// the bent spine (or the simulated ribbon). Also returns the placed normal
// and the placed direction along the body, so attachments can build a frame.
vec3 organismSurface(vec3 restPos, vec3 restN, vec3 tu, vec3 tv, vec4 surf, vec4 anchor, out vec3 placedNormal, out vec3 placedAlong) {
  vec3 n = normalize(restN);
  float arc = surf.x, s = surf.y, w = surf.z, u = surf.w;
  vec3 outward = normalize(tv + 1e-6) * (s < 0.0 ? -1.0 : 1.0);
  float f = organismNormalShift(arc, s, w, u), g = organismOutwardShift(arc, s, w);
  vec3 moved = restPos + n * f + outward * g;

  float da = 0.004, ds = 0.004;
  float fa = (organismNormalShift(arc + da, s, w, u) - f) / da;
  float fs = (organismNormalShift(arc, s + ds, w, u) - f) / ds;
  float ga = (organismOutwardShift(arc + da, s, w) - g) / da;
  float gs = (organismOutwardShift(arc, s + ds, w) - g) / ds;
  vec3 alongArc = tu / max(uLength, 0.001) + n * fa + outward * ga;
  vec3 acrossS = tv * 0.5 + n * fs + outward * gs;
  vec3 bent = cross(alongArc, acrossS);
  vec3 restNormal = dot(bent, bent) > 1e-12 ? normalize(bent) : n;

  vec3 base = restPos - anchor.xyz;
  vec3 local = moved - base;
  #ifdef ORGANISM_RIBBON
    float x = clamp(u, 0.0, 1.0) * float(${RIBBON_NODES - 1});
    int i0 = int(min(floor(x), float(${RIBBON_NODES - 2})));
    float t = x - float(i0);
    vec4 node = mix(uRibPos[i0], uRibPos[i0 + 1], t);
    vec4 q = quatMix(uRibQuat[i0], uRibQuat[i0 + 1], t);
    placedNormal = quatRotate(q, restNormal);
    placedAlong = quatRotate(q, alongArc);
    return node.xyz + quatRotate(q, local * uScale * node.w);
  #else
    float x = clamp(anchor.w / uSpineLength, 0.0, 1.0) * float(${SPINE_SAMPLES - 1});
    int i0 = int(min(floor(x), float(${SPINE_SAMPLES - 2})));
    float t = x - float(i0);
    vec3 spine = mix(uSpinePos[i0], uSpinePos[i0 + 1], t);
    vec4 q = quatMix(uSpineQuat[i0], uSpineQuat[i0 + 1], t);
    placedNormal = quatRotate(q, restNormal);
    placedAlong = quatRotate(q, alongArc);
    return spine + quatRotate(q, local);
  #endif
}

vec3 organismPlace(out vec3 placedNormal) {
  vec3 along;
  return organismSurface(position, normal, aTu, aTv, aSurf, aAnchor, placedNormal, along);
}
`;

const skinFunctions = /* glsl */`
uniform float skinStrength;
uniform float skinPigment;
uniform float uKind;
uniform float uSeed;
uniform float uSkinTime;
uniform vec4 uMood;       // curious, startle, feed, turn (signed)
uniform vec2 uPalette;    // hue shift (radians / 2pi), warmth
uniform vec3 uRamp[3];    // palette: spine, mid-body, frilled edge
uniform float uRampWeight; // 0 keeps the original reef colors
uniform sampler2D uPattern;
uniform float uLength;
uniform float uBeat;
varying vec4 vSurf;
varying vec2 vPatternUv;
${morphChunk}

float skinHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 skinHash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float skinNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(skinHash(i), skinHash(i + vec2(1.0, 0.0)), f.x),
    mix(skinHash(i + vec2(0.0, 1.0)), skinHash(i + 1.0), f.x), f.y);
}
float skinFbm(vec2 p) {
  float n = 0.55 * skinNoise(p);
  p = mat2(1.72, 1.12, -1.12, 1.72) * p + 4.17;
  n += 0.3 * skinNoise(p);
  p = mat2(1.72, 1.12, -1.12, 1.72) * p + 8.31;
  return n + 0.15 * skinNoise(p);
}
vec2 skinSpots(vec2 p, float size) {
  vec2 cell = floor(p), f = fract(p);
  float nearest = 10.0, identity = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = skinHash2(cell + g);
      vec2 d = g + 0.15 + 0.7 * r - f;
      float dist = length(d) - size * (0.45 + 0.75 * r.x * r.y);
      if (dist < nearest) { nearest = dist; identity = r.y; }
    }
  }
  return vec2(nearest, identity);
}
vec3 skinHue(vec3 c, float turns) {
  float angle = turns * 6.2831853;
  vec3 k = vec3(0.57735);
  return c * cos(angle) + cross(k, c) * sin(angle) + k * dot(k, c) * (1.0 - cos(angle));
}
vec3 skinRamp(float t, float streak) {
  vec3 navy = vec3(0.004, 0.01, 0.075);
  vec3 cobalt = vec3(0.01, 0.06, 0.46);
  vec3 cyan = vec3(0.01, 0.2, 0.62);
  vec3 violet = vec3(0.19, 0.025, 0.40);
  vec3 magenta = vec3(0.70, 0.018, 0.25);
  vec3 orange = vec3(1.0, 0.16, 0.015);
  vec3 gold = vec3(1.0, 0.42, 0.03);
  vec3 coral = vec3(1.0, 0.22, 0.12);
  vec3 peach = vec3(1.0, 0.45, 0.26);
  vec3 c = mix(navy, mix(cobalt, cyan, streak), smoothstep(0.02, 0.2, t));
  c = mix(c, violet, smoothstep(0.26, 0.38, t));
  c = mix(c, magenta, smoothstep(0.34, 0.48, t));
  c = mix(c, orange, smoothstep(0.48, 0.6, t));
  c = mix(c, gold, smoothstep(0.58, 0.7, t) * (0.4 + 0.5 * streak));
  c = mix(c, coral, smoothstep(0.74, 0.86, t) * (0.75 - 0.4 * streak));
  c = mix(c, peach, smoothstep(0.86, 0.98, t));
  return c;
}
`;

const pigmentFragment = /* glsl */`
  #include <color_fragment>
  float skinS = vSurf.y;
  float skinE = abs(skinS);
  float skinArc = vSurf.x;
  vec2 skinP = vec2(skinArc, skinS * vSurf.z);
  vec2 skinSeed = vec2(uSeed * 7.31, uSeed * 3.17);
  vec3 morphW = morphWeights(skinArc / max(uLength, 0.001), skinS);
  vec2 morphA = morphAntler(skinArc, skinS, vSurf.z);
  vec3 morphP = morphScales(skinArc, skinS, vSurf.z);
  float morphGrain = skinNoise(skinP * 9.0 + skinSeed);
  float morphKeepValue = 1.0;
  float skinBroad = skinFbm(skinP * vec2(0.9, 1.4) + skinSeed);
  float skinStreak = smoothstep(0.35, 0.75, skinFbm(vec2(skinArc * 2.6, skinS * 1.2) + skinSeed + 5.0));
  float skinCurious = uMood.x, skinStartle = uMood.y, skinFeed = uMood.z, skinTurn = uMood.w;

  float skinTravelA = 0.5 + 0.5 * sin(skinArc * 1.15 - uSkinTime * 1.05 + skinBroad * 4.0 + uSeed);
  float skinTravelB = 0.5 + 0.5 * sin(skinArc * 0.7 + uSkinTime * 1.6 + skinBroad * 3.0 - skinS * 1.4);
  float skinZone = skinE + 0.14 * (skinBroad - 0.5) + 0.06 * (skinTravelA - 0.5) * skinStrength;
  vec3 skinColor = skinRamp(clamp(skinZone, 0.0, 1.0), skinStreak);
  float skinFlush = smoothstep(0.62, 0.95, skinTravelA) * smoothstep(0.1, 0.3, skinZone) * (1.0 - smoothstep(0.5, 0.68, skinZone));
  skinColor = mix(skinColor, vec3(0.62, 0.02, 0.3), skinFlush * 0.5 * skinStrength);
  float skinGlow = smoothstep(0.66, 0.97, skinTravelB) * smoothstep(0.42, 0.62, skinZone) * (1.0 - smoothstep(0.86, 0.97, skinZone));
  skinColor = mix(skinColor, vec3(1.0, 0.62, 0.08), skinGlow * 0.5 * skinStrength);
  // A turning body sends a color wave along itself in the turn's direction.
  float skinTurnWave = smoothstep(0.55, 1.0, sin(skinArc * 1.7 - uSkinTime * 5.0 * sign(skinTurn)));
  skinColor = mix(skinColor, mix(vec3(0.75, 0.02, 0.35), vec3(1.0, 0.5, 0.05), smoothstep(0.35, 0.6, skinZone)),
    skinTurnWave * min(1.0, abs(skinTurn) * 1.4) * 0.55 * (1.0 - smoothstep(0.85, 0.95, skinZone)));

  // Living pattern: a reaction-diffusion field simulated on the GPU. Its
  // spots are the organism's fingerprint; they drift, split and merge.
  float skinRd = texture2D(uPattern, vPatternUv).g;
  float skinRdAa = fwidth(skinRd) * 1.1 + 0.012;
  // Thresholding at a varying level makes spots of uneven size and weight.
  float skinRdLevel = 0.2 + 0.1 * (skinFbm(skinP * 2.2 + skinSeed + 9.0) - 0.5) * 2.0;
  float skinSpot = smoothstep(skinRdLevel - skinRdAa, skinRdLevel + skinRdAa, skinRd);
  float skinHalo = smoothstep(0.07, 0.16, skinRd) * (1.0 - skinSpot);
  // Whale-shark back: pale spots on dark cobalt with a faint checkerboard of
  // pale bars and three ridges down each flank. Leopard (dark) spots beyond.
  float skinShark = 1.0 - smoothstep(0.22, 0.34, skinZone);
  float skinBarPhase = skinArc * 1.9 + skinBroad * 1.2;
  float skinBar = smoothstep(0.86, 0.97, abs(fract(skinBarPhase) - 0.5) * 2.0) * (1.0 - smoothstep(0.35, 0.9, fwidth(skinBarPhase)));
  float skinRidge = exp(-pow((skinE - 0.09) / 0.014, 2.0)) + exp(-pow((skinE - 0.17) / 0.014, 2.0)) + 0.7 * exp(-pow((skinE - 0.25) / 0.016, 2.0));
  skinRidge *= uKind < 0.5 ? 1.0 : 0.0;
  skinColor = mix(skinColor, skinColor * vec3(0.55, 0.62, 0.8), skinShark * 0.5);
  skinColor = mix(skinColor, vec3(0.62, 0.75, 0.88), skinBar * skinShark * 0.1);
  skinColor = mix(skinColor, vec3(0.55, 0.72, 0.95), skinRidge * 0.16);

  float skinSpeckScale = uKind > 1.5 ? 30.0 : 22.0;
  vec2 skinSpeckleUv = skinP * skinSpeckScale + skinSeed * 3.0;
  vec2 skinSpeck = skinSpots(skinSpeckleUv, 0.14 + 0.1 * (1.0 - skinE));
  float skinSpeckAa = max(0.04, fwidth(skinSpeck.x));
  float skinSpeckFade = 1.0 - smoothstep(0.08, 0.2, fwidth(skinSpeckleUv.x));
  float skinSpeckle = (1.0 - smoothstep(-skinSpeckAa, skinSpeckAa, skinSpeck.x)) * (1.0 - smoothstep(0.84, 0.96, skinZone)) * (1.0 - skinShark * 0.7);
  float skinGlint = (1.0 - smoothstep(0.0, 0.12, skinSpeck.x + 0.08)) * step(0.9, skinSpeck.y)
    * (1.0 - smoothstep(0.2, 0.42, skinZone)) * skinSpeckFade;

  float skinVeinPhase = skinArc * (uKind > 1.5 ? 26.0 : 17.0) + skinBroad * 3.5 + skinE * 1.4;
  float skinVeinWidth = fwidth(skinVeinPhase);
  float skinVeinVisible = 1.0 - smoothstep(0.35, 0.9, skinVeinWidth);
  float skinVein = smoothstep(0.8 - skinVeinWidth * 2.0, 0.97, abs(fract(skinVeinPhase) - 0.5) * 2.0) * skinVeinVisible * smoothstep(0.4, 0.75, skinZone);
  float skinPaleVein = smoothstep(0.78 - skinVeinWidth * 2.0, 0.97, abs(fract(skinVeinPhase * 2.0 + 0.5) - 0.5) * 2.0)
    * skinVeinVisible * smoothstep(0.6, 0.9, skinZone);

  vec3 skinDark = mix(vec3(0.012, 0.004, 0.018), vec3(0.09, 0.012, 0.03), smoothstep(0.5, 0.8, skinZone));
  vec3 skinPale = vec3(0.78, 0.88, 0.98);
  vec3 skinHaloColor = mix(vec3(0.02, 0.5, 0.9), vec3(1.0, 0.72, 0.1), smoothstep(0.3, 0.55, skinZone));
  float skinSpotMask = 1.0 - smoothstep(0.86, 0.97, skinZone);
  skinColor = mix(skinColor, skinHaloColor, skinHalo * 0.4 * (1.0 - skinShark) * skinSpotMask);
  skinColor = mix(skinColor, mix(skinDark, skinPale, skinShark), skinSpot * 0.92 * skinSpotMask);
  skinColor = mix(skinColor, skinDark * 1.4, skinSpeckle * mix(0.2, 0.7, skinSpeckFade));
  skinColor = mix(skinColor, mix(vec3(0.2, 0.9, 1.0), vec3(1.0, 0.85, 0.35), skinSpeck.y > 0.95 ? 1.0 : 0.0), skinGlint * 0.9);
  skinColor = mix(skinColor, skinColor * 0.55 + vec3(0.12, 0.02, 0.02), skinVein * 0.6);
  skinColor += vec3(0.4, 0.22, 0.12) * skinPaleVein * 0.4;
  skinColor = mix(skinColor, vec3(0.85, 0.12, 0.2), smoothstep(0.955, 0.99, skinE) * 0.7);

  // Countershading: the underside is pale, so every bank flashes a new face.
  float skinBelly = gl_FrontFacing ? 1.0 : 0.0;
  vec3 skinBellyColor = mix(vec3(0.86, 0.9, 0.96), vec3(1.0, 0.72, 0.55), smoothstep(0.25, 0.7, skinZone));
  skinBellyColor = mix(skinBellyColor, skinBellyColor * 0.72, skinSpot * skinSpotMask * 0.5);
  skinColor = mix(skinColor, skinBellyColor, skinBelly * 0.62 * (uKind < 1.5 ? 1.0 : 0.45));

  // Moods. Curious saturates; startled blanches, then the spots flash dark;
  // feeding pulses gold along the spine.
  float skinLuma = dot(skinColor, vec3(0.2126, 0.7152, 0.0722));
  skinColor = max(vec3(0.0), mix(vec3(skinLuma), skinColor, 1.0 + 0.3 * skinCurious));
  skinColor = mix(skinColor, vec3(0.95, 0.9, 0.84), skinStartle * 0.38 * (1.0 - skinSpot));
  skinColor = mix(skinColor, skinDark, skinStartle * skinSpot * 0.8);
  float skinFeedPulse = skinFeed * (0.5 + 0.5 * sin(skinArc * 3.0 - uSkinTime * 6.0)) * (1.0 - smoothstep(0.2, 0.45, skinZone));

  skinColor = skinHue(skinColor, uPalette.x * (1.0 - smoothstep(0.4, 0.8, skinZone)));
  skinColor *= 1.0 + uPalette.y * vec3(0.3, 0.0, -0.3) * smoothstep(0.4, 0.8, skinZone);
  // Key palettes: recolor by zone while keeping every spot, bar and vein's
  // lightness, so the pattern reads the same in any palette.
  if (uRampWeight > 0.001) {
    vec3 rampColor = mix(uRamp[0], uRamp[1], smoothstep(0.18, 0.5, skinZone));
    rampColor = mix(rampColor, uRamp[2], smoothstep(0.55, 0.9, skinZone));
    float rampLuma = dot(skinColor, vec3(0.2126, 0.7152, 0.0722));
    vec3 recolored = rampColor * (0.28 + 1.15 * rampLuma);
    recolored = mix(recolored, vec3(0.97, 0.95, 0.92), smoothstep(0.62, 0.95, rampLuma) * 0.55);
    skinColor = mix(skinColor, recolored, uRampWeight * 0.92);
  }

  float skinGrain = skinNoise(skinP * 160.0 + skinSeed);
  float skinThin = smoothstep(0.55, 0.95, skinZone);

  // Antler: ivory bone going tan toward the tips, mottled brown by the same
  // living pattern; the spine keeps some of its chromatophore color.
  vec3 morphBone = mix(vec3(0.95, 0.62, 0.26), vec3(0.72, 0.3, 0.07), smoothstep(0.3, 1.0, skinE));
  morphBone = mix(morphBone, vec3(1.0, 0.82, 0.55), morphA.y * 0.6);
  morphBone = mix(morphBone, vec3(0.24, 0.08, 0.02), skinSpot * 0.75 * smoothstep(0.2, 0.5, skinE));
  morphBone *= 0.85 + 0.3 * skinGrain;
  vec3 morphAntlerColor = mix(skinColor, morphBone, smoothstep(0.12, 0.38, skinE));
  // Porous bone: pits rather than holes.
  morphAntlerColor *= 1.0 - 0.35 * smoothstep(-0.2, 0.3, -morphA.x) * smoothstep(0.3, 0.6, skinE);
  // Pangolin: rose-gold keratin plates, pale at their tips, dark in the
  // seams, a few with a teal or violet film.
  vec3 morphKeratin = mix(vec3(0.62, 0.1, 0.1), vec3(1.0, 0.55, 0.28), morphP.x);
  morphKeratin = mix(morphKeratin, vec3(1.0, 0.8, 0.5), smoothstep(0.85, 1.0, morphP.x) * 0.5);
  morphKeratin = mix(morphKeratin, vec3(0.08, 0.42, 0.6), step(0.93, morphP.z) * 0.45);
  morphKeratin = mix(morphKeratin, vec3(0.5, 0.08, 0.45), step(0.97, morphP.z) * 0.5);
  morphKeratin = mix(morphKeratin, skinColor * 0.8, 0.28 * (1.0 - smoothstep(0.1, 0.4, skinE)));
  morphKeratin = mix(morphKeratin, vec3(0.05, 0.01, 0.01), morphP.y * 0.9);
  // The real plates cover the back; the skin between them is soft and dark.
  morphKeratin = mix(morphKeratin, vec3(0.32, 0.12, 0.1), 0.6);
  skinColor = skinColor * morphW.x + morphAntlerColor * morphW.y + morphKeratin * morphW.z;
  skinColor *= 0.92 + 0.14 * skinGrain;
  skinThin *= morphW.x + 0.3 * morphW.y;
  // The front of transformation burns: a hot rim where tissue dissolves.
  // A soft light where one tissue is becoming another.
  float morphBurn = 0.18 * (1.0 - smoothstep(0.0, 0.5, abs(max(morphW.x, max(morphW.y, morphW.z)) - 0.55)));
  float morphTip = 0.0;
  // A beat sends a flash from head to tail.
  float morphBeat = uBeat * exp(-pow((skinArc / max(uLength, 0.001) - (1.0 - uBeat)) * 5.0, 2.0));
  diffuseColor.rgb *= mix(vec3(0.72, 0.58, 0.5), skinColor, skinPigment);
`;

function surfaceUniforms(shared, surface) {
  const own = {
    uKind: { value: surface.kind }, uSeed: { value: surface.seed }, uLength: { value: surface.length },
    uPatternRect: { value: surface.patternRect },
  };
  const placement = surface.kind === 2
    ? { uRibPos: { value: surface.chain.positions }, uRibQuat: { value: surface.chain.quaternions }, uScale: shared.scale }
    : { uSpinePos: shared.spinePos, uSpineQuat: shared.spineQuat, uSpineLength: shared.spineLength };
  return {
    uBodyPhase: shared.phase, uBodyStrength: shared.strength, uEffort: shared.effort, uGenome: shared.genome, uMorph: shared.morph,
    ...placement, ...own,
  };
}

function installMotion(shader, uniforms, placement) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = motion + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
    vec3 organismNormal;
    vec3 transformed = organismPlace(organismNormal);
    vSurf = aSurf;
    vPatternUv = mix(uPatternRect.xy, uPatternRect.zw, uv);
    ${placement}
  `);
}

// Shadow and seam passes cut exactly the holes the skin cuts.
const cutoutDeclarations = `
uniform float uKind;
uniform float uSeed;
uniform float uLength;
varying vec4 vSurf;
${morphChunk}
float cutNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(morphHash(i), morphHash(i + vec2(1.0, 0.0)), f.x),
    mix(morphHash(i + vec2(0.0, 1.0)), morphHash(i + 1.0), f.x), f.y);
}
`;
const cutout = '';

/** The lit skin. `shared` holds uniform objects; see createShared(). */
export function createSkinMaterial(shared, surface) {
  const uniforms = surfaceUniforms(shared, surface);
  const material = new THREE.MeshPhysicalMaterial({
    name: `Living skin: ${surface.name}`,
    side: THREE.DoubleSide, roughness: 0.34, metalness: 0,
    clearcoat: 0.4, clearcoatRoughness: 0.2,
    iridescence: 0.55, iridescenceIOR: 1.3, iridescenceThicknessRange: [220, 420],
    sheen: 0.08, sheenColor: new THREE.Color('#ffb48a'), sheenRoughness: 0.5,
    envMapIntensity: 0.42,
  });
  material.defines = surface.kind === 2 ? { ORGANISM_RIBBON: '' } : {};
  material.extensions = { derivatives: true };
  material.onBeforeCompile = shader => {
    installMotion(shader, uniforms, '');
    Object.assign(shader.uniforms, {
      skinStrength: shared.strength, skinPigment: shared.pigment, uSkinTime: shared.skinTime,
      uMood: shared.mood, uPalette: shared.palette, uPattern: shared.pattern, uBeat: shared.beat,
      uRamp: shared.ramp, uRampWeight: shared.rampWeight, uLook: shared.look,
    });
    // The normal is needed before begin_vertex runs; compute placement there.
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
      vec3 organismEarlyNormal;
      vec3 organismEarlyPosition = organismPlace(organismEarlyNormal);
      vec3 objectNormal = organismEarlyNormal;
      #ifdef USE_TANGENT
        vec3 objectTangent = vec3(tangent.xyz);
      #endif
    `).replace('vec3 transformed = organismPlace(organismNormal);', 'vec3 transformed = organismEarlyPosition;');

    shader.fragmentShader = skinFunctions + lookDeclarations + shader.fragmentShader;
    // Art styles repaint the finished pixel, after tone mapping.
    shader.fragmentShader = shader.fragmentShader.replace('#include <encodings_fragment>', lookFragment);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', pigmentFragment);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + skinSpot * 0.1 - skinGlint * 0.2
        + (skinGrain - 0.5) * 0.08 + skinThin * 0.04, 0.12, 0.6);
      roughnessFactor = mix(roughnessFactor, 0.5 + 0.1 * skinSpot, morphW.y);
      roughnessFactor = mix(roughnessFactor, 0.2 + 0.25 * morphP.y, morphW.z);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_fragment>', `
      #include <lights_physical_fragment>
      #ifdef USE_IRIDESCENCE
        material.iridescence *= ((1.0 - smoothstep(0.18, 0.5, skinZone)) * morphW.x + 0.9 * morphW.z * (1.0 - morphP.y)) * skinPigment;
      #endif
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      float skinHeight = (skinGrain * 0.0012 - skinSpot * 0.0005 + skinVein * 0.0005 + skinRidge * 0.0022) * morphW.x
        + morphW.y * 0.004 * smoothstep(-0.3, 0.6, morphA.x);
      vec3 skinDx = dFdx(-vViewPosition), skinDy = dFdy(-vViewPosition);
      vec3 skinRx = cross(skinDy, normal), skinRy = cross(normal, skinDx);
      float skinDet = dot(skinDx, skinRx);
      vec3 skinGradient = sign(skinDet) * (dFdx(skinHeight) * skinRx + dFdy(skinHeight) * skinRy);
      normal = normalize(abs(skinDet) * normal - skinGradient);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `
      vec3 skinThrough = vec3(0.0);
      #if NUM_DIR_LIGHTS > 0
        for (int skinLight = 0; skinLight < NUM_DIR_LIGHTS; skinLight++) {
          vec3 skinL = directionalLights[skinLight].direction;
          float skinBack = max(0.0, -dot(normal, skinL));
          float skinForward = pow(max(0.0, dot(geometry.viewDir, -skinL)), 4.0);
          skinThrough += directionalLights[skinLight].color * (skinBack * 0.5 + skinForward * 0.35);
        }
      #endif
      vec3 skinTint = mix(vec3(1.0, 0.4, 0.2), skinColor * skinColor * 1.4, 0.6) * skinPigment + vec3(0.8, 0.6, 0.45) * (1.0 - skinPigment);
      float skinOpen = mix(0.08, 1.0, skinThin) * (1.0 - skinSpot * skinSpotMask * 0.7) * (1.0 - skinSpeckle * 0.5);
      outgoingLight += skinThrough * skinTint * skinOpen * 0.38;
      outgoingLight += skinTint * skinThin * 0.035;
      // Glints and the feeding pulse run hot so the bloom picks them up.
      outgoingLight += skinGlint * vec3(0.5, 1.4, 1.8) * 0.6 * skinPigment;
      outgoingLight += skinFeedPulse * vec3(2.2, 1.2, 0.3) * 0.5;
      outgoingLight += morphBurn * vec3(3.4, 1.4, 0.35) + morphTip * vec3(2.6, 1.9, 1.1) * (0.7 + 0.3 * sin(uSkinTime * 4.0 + skinArc * 3.0));
      outgoingLight += morphBeat * mix(vec3(0.6, 0.3, 2.2), vec3(2.2, 0.6, 1.4), smoothstep(0.2, 0.6, skinZone)) * 0.7;
      #include <output_fragment>
    `);
  };
  material.customProgramCacheKey = () => `organism-skin-9-${surface.kind === 2 ? 'ribbon' : 'body'}`;
  return material;
}

export function createDepthMaterial(shared, surface) {
  const uniforms = surfaceUniforms(shared, surface);
  const material = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  material.defines = surface.kind === 2 ? { ORGANISM_RIBBON: '' } : {};
  material.onBeforeCompile = shader => {
    installMotion(shader, uniforms, '');
    shader.fragmentShader = cutoutDeclarations + shader.fragmentShader.replace('void main() {', `void main() {
      ${cutout}`);
  };
  material.customProgramCacheKey = () => `organism-depth-8-${surface.kind === 2 ? 'ribbon' : 'body'}`;
  return material;
}

/** Writes (surface id, arc, across, view depth) for intersection seams. */
export function createIdMaterial(shared, surface, id) {
  const uniforms = { ...surfaceUniforms(shared, surface), uSurfaceId: { value: id } };
  return new THREE.ShaderMaterial({
    name: `Seam id: ${surface.name}`,
    side: THREE.DoubleSide,
    defines: surface.kind === 2 ? { ORGANISM_RIBBON: '' } : {},
    uniforms,
    vertexShader: motion + `
      varying float vIdDepth;
      void main() {
        vec3 organismNormal;
        vec3 transformed = organismPlace(organismNormal);
        vSurf = aSurf;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vIdDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: cutoutDeclarations + `
      uniform float uSurfaceId;
      varying float vIdDepth;
      void main() {
        ${cutout}
        gl_FragColor = vec4(uSurfaceId, vSurf.x / max(uLength, 0.001), vSurf.y * 0.5 + 0.5, vIdDepth);
      }`,
  });
}

/** Uniform objects shared by every surface of one specimen. */
export function createShared({ spineLength, scale, pattern }) {
  return {
    phase: { value: 0 }, strength: { value: 1 }, pigment: { value: 1 }, effort: { value: 0 },
    genome: { value: new THREE.Vector4(1, 0.2, 1, 1) },
    morph: { value: new THREE.Vector4(0, 0.5, 1, 1) },
    upLocal: { value: new THREE.Vector3(0, 1, 0) },
    beat: { value: 0 },
    spinePos: { value: new Float32Array(SPINE_SAMPLES * 3) },
    spineQuat: { value: new Float32Array(SPINE_SAMPLES * 4) },
    spineLength: { value: spineLength },
    scale: { value: scale },
    skinTime: { value: 0 },
    mood: { value: new THREE.Vector4() },
    palette: { value: new THREE.Vector2() },
    ramp: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color()] },
    rampWeight: { value: 0 },
    look: { value: new THREE.Vector3(0, 0, 0) },
    pattern: { value: pattern },
  };
}
