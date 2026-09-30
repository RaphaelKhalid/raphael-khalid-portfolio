// raly's art styles ("looks"). The natural look is the physically lit skin;
// every other look repaints the finished pixel in its own medium, after tone
// mapping, so its colors land exactly (unpainted paper is the page's ivory).
//
// Each look draws with the body's own coordinates (arc along the spine, signed
// distance across the membrane, the living spot pattern and the surface
// normal), so marks are anchored to the moving body instead of sliding over it.
// A few looks "boil": their marks are redrawn a few times a second, like
// frames of hand-drawn animation.

export const LOOKS = ['natural', 'ink', 'watercolor', 'porcelain', 'fabric', 'oil', 'cosmic', 'cartoon'];

export const lookIndex = name => Math.max(0, LOOKS.indexOf(name));

// GLSL: declarations (top level) and the per-pixel repaint (end of main).
export const lookDeclarations = /* glsl */`
uniform vec3 uLook; // look A, look B, mix (0..1)
float lookHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
const vec3 LOOK_PAPER = vec3(0.957, 0.922, 0.875);
// What each look knows about the skin at this pixel.
struct LookSkin {
  float arc;      // distance along the body
  float s;        // signed position across the membrane (-1..1)
  float e;        // |s|: 0 at the ridge, 1 at the frill's rim
  float zone;     // e, gently warped
  float broad;    // large-scale mottling (0..1)
  float spot;     // the living reaction-diffusion spots
  float spotMask; // where spots are allowed
  float shark;    // 1 on the whale-shark back near the ridge
  vec2 p;         // arc, s scaled by width
  vec2 seed;
};

// Cells: distance to the nearest cell edge, and a random value per cell.
vec2 lookCells(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 r = g + vec2(lookHash(i + g), lookHash(i + g + 19.1)) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) { d2 = d; }
  }
  return vec2(sqrt(d2) - sqrt(d1), lookHash(id * 1.3 + 4.7));
}
// A line of the given width (in pixels) along the zero crossing of x.
float lookLine(float x, float width) { float w = max(fwidth(x), 1e-5) * width; return 1.0 - smoothstep(w * 0.5, w, abs(x)); }

// 1: Ensō ink brushwork. Sweeping black strokes along the body, dry-brush
// streaks where the ink runs out, sparse grey washes in the folds, broken
// contours, blotted spots and a little splatter. Matte: no reflections.
vec3 lookInk(LookSkin k, vec3 n, vec3 v, vec3 l, float boil) {
  vec3 ink = vec3(0.07, 0.064, 0.058);
  vec3 grey = vec3(0.6, 0.58, 0.55);
  vec2 wobble = vec2(lookHash(vec2(boil, 1.3)), lookHash(vec2(boil, 7.9))) - 0.5;
  // Bristles: long streaks laid along the body, as if one stroke drew it.
  float bristle = skinNoise(vec2(k.arc * 1.1 + wobble.x * 0.08, k.s * 34.0) + k.seed);
  float fine = skinNoise(vec2(k.arc * 2.7, k.s * 95.0 + wobble.y * 0.6) + k.seed * 1.9);
  float streak = 0.62 * bristle + 0.38 * fine;
  // Ink load: heavy down the ridge, lifting toward the frill, in the folds'
  // shadow the brush drags back in.
  float ndl = dot(n, l);
  float shadow = smoothstep(0.35, -0.3, ndl);
  // The ridge: one wide calligraphic stroke whose edge frays into dry brush.
  float ridge = 1.0 - smoothstep(0.1, 0.4 + 0.14 * k.broad, k.e);
  // Sweeps: long bands where the brush travelled down the body.
  float sweep = smoothstep(0.52, 0.78, skinNoise(vec2(k.arc * 0.32, k.s * 4.5) + k.seed + 11.0));
  float load = max(ridge, (shadow * (0.5 + 0.3 * k.broad) + sweep * 0.45) * (1.0 - smoothstep(0.78, 1.0, k.e)));
  float dry = smoothstep(streak - 0.06, streak + 0.03, load);
  // A pale stroke left unpainted along the ridge line, like the reference.
  float gap = exp(-pow((k.s - 0.07) / 0.022, 2.0)) * smoothstep(0.35, 0.6, bristle);
  // Washes: a light grey in turned-away folds and on the underside.
  float wash = shadow * 0.55 + (gl_FrontFacing ? 0.0 : 0.25);
  wash *= 0.55 + 0.45 * skinFbm(k.p * vec2(1.6, 3.0) + k.seed + 3.0);
  // Broken contours: the silhouette and the frill's scalloped rim.
  float sil = 1.0 - abs(dot(n, v));
  float breaks = step(0.32, skinNoise(vec2(k.arc * 3.2 + boil * 0.37, k.s * 2.0)));
  float contour = smoothstep(0.7, 0.9, sil) * breaks;
  float rim = smoothstep(0.93, 0.985, k.e) * (0.35 + 0.65 * step(0.4, fine));
  // Spots: ragged black blots in the frill; paper holes in the dark ridge.
  float ragged = skinNoise(k.p * 48.0 + k.seed);
  float blot = k.spot * k.spotMask * (1.0 - k.shark) * smoothstep(0.3, 0.55, ragged + 0.25 * k.broad)
    * (0.55 + 0.45 * smoothstep(0.4, 0.9, k.e));
  float hole = k.spot * k.spotMask * k.shark * ridge;
  // Splatter: sparse droplets near the rim.
  vec2 cell = floor(k.p * vec2(7.0, 26.0));
  vec2 inCell = fract(k.p * vec2(7.0, 26.0)) - 0.5;
  float drop = step(0.93, lookHash(cell + floor(boil * 0.25))) * smoothstep(0.6, 0.95, k.e)
    * (1.0 - smoothstep(0.12, 0.2, length(inCell * vec2(1.0, 0.45))));

  vec3 color = mix(LOOK_PAPER, grey, clamp(wash, 0.0, 0.6));
  // Grey dry brush between the black: a second, lighter pass of the brush.
  float greyBrush = smoothstep(streak - 0.1, streak + 0.05, load * 1.35) * (1.0 - dry);
  color = mix(color, vec3(0.42, 0.4, 0.38), greyBrush * 0.55);
  float amount = max(max(dry * (1.0 - gap), blot), max(max(contour, rim), drop));
  amount *= 1.0 - hole * 0.9;
  return mix(color, ink, clamp(amount, 0.0, 1.0));
}


// 2: Ink and watercolor. Transparent washes that multiply into the paper
// (indigo along the ridge, coral in the body, peach at the frill), pigment
// granulation, color pooled at wash edges, stippled spots, fine contour ink
// and crosshatching in the folds' shadow. Matte, no specular.
vec3 lookWatercolor(LookSkin k, vec3 n, vec3 v, vec3 l, float boil) {
  vec3 indigo = vec3(0.24, 0.28, 0.58), coral = vec3(0.94, 0.46, 0.36), peach = vec3(0.99, 0.8, 0.62);
  float lit = dot(n, l) * 0.5 + 0.5;
  float z = k.zone + 0.12 * (k.broad - 0.5);
  vec3 pigment = mix(indigo, coral, smoothstep(0.12, 0.5, z));
  pigment = mix(pigment, peach, smoothstep(0.6, 0.95, z));
  float grain = skinNoise(k.p * vec2(70.0, 160.0) + k.seed);
  float washField = skinFbm(k.p * vec2(0.9, 1.9) + k.seed + 7.0);
  float density = (0.5 + 0.3 * (1.0 - lit) + 0.25 * washField) * (0.82 + 0.3 * grain);
  vec3 color = LOOK_PAPER * mix(vec3(1.0), pigment, clamp(density, 0.0, 1.0));
  // Pigment pools where a wash dried: a darker line at its edge.
  float pool = lookLine(washField - 0.55, 2.5) * 0.35 + smoothstep(0.9, 0.99, k.e) * 0.3;
  color *= 1.0 - pool * density;
  // A second, smaller wash layered on top in places.
  float glaze = smoothstep(0.55, 0.7, skinFbm(k.p * vec2(2.2, 4.0) + k.seed + 21.0));
  color *= mix(vec3(1.0), mix(pigment, indigo, 0.35), glaze * 0.35);
  // Paper tooth.
  color *= 0.965 + 0.05 * skinNoise(k.p * 240.0 + 3.0);
  vec3 ink = vec3(0.2, 0.15, 0.2);
  // Stippled spots: each spot is built from tiny dots of ink.
  vec2 dotCell = k.p * vec2(110.0, 260.0);
  float stipple = step(0.52, lookHash(floor(dotCell) + floor(boil * 0.5))) * (1.0 - smoothstep(0.2, 0.36, length(fract(dotCell) - 0.5)));
  float spots = k.spot * k.spotMask;
  color = mix(color, color * mix(pigment, indigo, 0.6), spots * 0.45);
  float amount = spots * stipple * 0.85;
  // Crosshatching in the folds' shadow; a second direction in the deepest.
  float shade = smoothstep(0.5, 0.15, lit);
  float jitter = (lookHash(vec2(boil, 3.0)) - 0.5) * 0.08;
  float hatchA = lookLine(fract(k.arc * 9.0 + k.s * 5.0 + jitter) - 0.5, 1.4);
  float hatchB = lookLine(fract(k.arc * 9.0 - k.s * 6.0 - jitter) - 0.5, 1.4);
  amount = max(amount, hatchA * step(0.35, shade) * 0.55 + hatchB * step(0.7, shade) * 0.5);
  // Fine contour ink.
  float sil = 1.0 - abs(dot(n, v));
  amount = max(amount, smoothstep(0.82, 0.94, sil) * 0.9);
  amount = max(amount, smoothstep(0.955, 0.99, k.e) * step(0.3, skinNoise(vec2(k.arc * 5.0, boil))) * 0.8);
  return mix(color, ink, clamp(amount, 0.0, 1.0));
}

// 3: Porcelain with kintsugi. Ivory glaze, cobalt botanical painting along
// the ridge and cobalt spots, fine crazing, sparse gold repair seams (the
// only metallic response), broad soft reflections, warm light through the
// thinnest edges.
vec3 lookPorcelain(LookSkin k, vec3 n, vec3 v, vec3 l, float boil) {
  vec3 ivory = vec3(0.965, 0.945, 0.9), cobalt = vec3(0.13, 0.23, 0.64);
  float ndl = dot(n, l);
  vec3 h = normalize(l + v);
  vec3 color = ivory * (0.8 + 0.2 * max(ndl, 0.0));
  // The ridge: a cobalt band painted with a brush, pale dots left in it.
  float band = 1.0 - smoothstep(0.08, 0.14 + 0.03 * k.broad, k.e);
  float strokeTone = 0.75 + 0.25 * skinNoise(vec2(k.arc * 2.0, k.s * 20.0) + k.seed);
  color = mix(color, cobalt * strokeTone, band * (1.0 - k.spot * k.spotMask * 0.85));
  // Fronds: leaves painted out from the ridge on both sides.
  float leaves = 0.0;
  for (int j = 0; j < 2; j++) {
    float period = j == 0 ? 2.3 : 3.4;
    float reach = j == 0 ? 0.3 : 0.5;
    float size = j == 0 ? 1.0 : 0.7;
    float c = (floor(k.arc * period + float(j) * 0.5) + 0.5 - float(j) * 0.5) / period;
    vec2 d = vec2((k.arc - c) * period, (k.e - reach) * 3.4);
    float a = 0.65 * sign(k.s + 1e-4);
    d = mat2(cos(a), -sin(a), sin(a), cos(a)) * d;
    float leaf = 1.0 - smoothstep(0.85, 1.0, length(d / vec2(0.42 * size, 0.15 * size)));
    float vein = lookLine(d.y, 1.2) * step(abs(d.x), 0.35 * size);
    leaves = max(leaves, leaf * (0.6 + 0.4 * smoothstep(-0.4, 0.4, d.x)) * (1.0 - vein * 0.6));
  }
  leaves *= 1.0 - smoothstep(0.5, 0.65, k.e);
  color = mix(color, cobalt * (0.85 + 0.25 * skinNoise(k.p * 30.0)), leaves * 0.85);
  // Cobalt spots in the frill.
  color = mix(color, cobalt, k.spot * k.spotMask * (1.0 - k.shark) * 0.8 * smoothstep(0.3, 0.6, k.e));
  // Crazing: fine cracks in the glaze.
  vec2 craze = lookCells(k.p * vec2(9.0, 22.0) + k.seed);
  color *= 1.0 - lookLine(craze.x, 1.0) * 0.18;
  // Gold seams: a few of the large cells' edges, filled with gold.
  vec2 seamP = k.p * vec2(0.8, 1.6) + k.seed + 5.0;
  vec2 seam = lookCells(seamP);
  float gold = lookLine(seam.x, 2.4) * step(0.55, seam.y);
  float shine = pow(max(dot(n, h), 0.0), 12.0);
  vec3 goldColor = mix(vec3(0.62, 0.45, 0.14), vec3(1.0, 0.88, 0.5), shine + 0.25 * skinNoise(k.p * 90.0));
  color = mix(color, goldColor, gold);
  // Warm light through the thinnest edges; a glaze line at the rim.
  color = mix(color, vec3(0.99, 0.82, 0.62), smoothstep(0.82, 1.0, k.e) * 0.45);
  color *= 1.0 - smoothstep(0.965, 0.995, k.e) * 0.3;
  // Broad, soft ceramic reflection (not a mirror).
  color += vec3(1.0, 0.98, 0.95) * smoothstep(0.82, 0.98, dot(n, h)) * 0.22 * (1.0 - gold);
  return color;
}

// 4: Embroidered fabric. Plum velvet on the ridge with a soft directional
// sheen, layered peach and lavender organza in the frills (deeper where it
// doubles over), a fine weave, gold running stitches, a blanket-stitched
// hem and a few pearl beads.
vec3 lookFabric(LookSkin k, vec3 n, vec3 v, vec3 l, float boil) {
  float ndl = dot(n, l) * 0.5 + 0.5;
  float sil = 1.0 - abs(dot(n, v));
  float velvetMask = 1.0 - smoothstep(0.22, 0.34, k.e + 0.06 * (k.broad - 0.5));
  // Velvet: dark plum, lifting to rose where the pile catches grazing light.
  float pile = skinNoise(k.p * vec2(120.0, 260.0));
  vec3 velvet = mix(vec3(0.24, 0.06, 0.18), vec3(0.62, 0.3, 0.46), pow(sil, 1.6) * 0.8 + 0.1 * pile);
  velvet *= 0.75 + 0.3 * ndl;
  // Organza: sheer peach and lavender; deeper where it layers or turns away.
  vec3 organza = mix(vec3(1.0, 0.7, 0.52), vec3(0.74, 0.58, 0.92), smoothstep(0.3, 0.72, skinFbm(k.p * vec2(1.1, 2.0) + k.seed)));
  float layers = 0.55 + 0.35 * (1.0 - ndl) + (gl_FrontFacing ? 0.0 : 0.3);
  vec3 sheer = LOOK_PAPER * mix(vec3(1.0), organza, clamp(layers, 0.0, 1.0));
  sheer *= mix(vec3(1.0), organza, (gl_FrontFacing ? 0.0 : 0.35) + smoothstep(0.4, 0.1, ndl) * 0.3);
  // The weave: fine crossing threads, faded out where too fine to draw.
  vec2 weave = k.p * vec2(160.0, 380.0);
  float threads = 0.5 + 0.5 * sin(weave.x) * sin(weave.y);
  sheer *= 0.95 + 0.06 * threads * (1.0 - smoothstep(0.3, 1.0, fwidth(weave.x)));
  vec3 color = mix(sheer, velvet, velvetMask);
  // Glinting thread speckle on the frill.
  color = mix(color, vec3(0.85, 0.6, 0.3), step(0.985, lookHash(floor(k.p * vec2(60.0, 140.0)))) * (1.0 - velvetMask) * 0.8);
  // Gold running stitches either side of the ridge, and one down its crest.
  float dash = step(0.45, fract(k.arc * 14.0));
  float stitch = (lookLine(k.e - 0.24, 1.6) + lookLine(k.s - 0.02, 1.4)) * dash;
  // A blanket-stitched hem.
  float hem = lookLine(k.e - 0.975, 1.3) + step(0.955, k.e) * step(fract(k.arc * 22.0), 0.18);
  color = mix(color, vec3(0.92, 0.72, 0.36), clamp(stitch, 0.0, 1.0));
  color = mix(color, vec3(0.62, 0.32, 0.5), clamp(hem, 0.0, 1.0) * 0.9);
  // Pearl beads: sparse, each with a small highlight.
  vec2 beadCell = k.p * vec2(3.0, 7.0) + k.seed;
  vec2 bq = (fract(beadCell) - 0.5) * vec2(1.0, 0.42);
  float bead = step(0.9, lookHash(floor(beadCell))) * (1.0 - smoothstep(0.1, 0.14, length(bq)));
  vec3 pearl = mix(vec3(0.82, 0.76, 0.92), vec3(1.0), 1.0 - smoothstep(0.0, 0.06, length(bq - vec2(-0.03, 0.03))));
  return mix(color, pearl, bead);
}

// 5: Living oil painting. Directional strokes wrapping the folds, broken
// color per stroke, palette-knife highlights fragmented along the paint
// ridges, dabs for spots, and a painted contour that breaks off.
vec3 lookOil(LookSkin k, vec3 n, vec3 v, vec3 l, float boil) {
  vec3 ultramarine = vec3(0.12, 0.18, 0.58), violet = vec3(0.45, 0.2, 0.55), vermilion = vec3(0.9, 0.24, 0.16);
  vec3 coral = vec3(0.96, 0.5, 0.33), peach = vec3(1.0, 0.82, 0.58), cream = vec3(1.0, 0.95, 0.82);
  // Strokes: staggered cells laid along the body, each a slightly tilted dab.
  vec2 sp = k.p * vec2(5.0, 11.0);
  vec2 shifted = sp + vec2(0.5 * floor(sp.y), 0.0);
  vec2 cell = floor(shifted);
  float h1 = lookHash(cell + k.seed), h2 = lookHash(cell + 7.7);
  vec2 local = fract(shifted) - 0.5;
  float tilt = (h1 - 0.5) * 0.9;
  local = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * local;
  float bristles = skinNoise(vec2(local.x * 3.0, local.y * 38.0) + cell * 3.1);
  // Color by zone, broken per stroke.
  float z = clamp(k.zone + (h2 - 0.5) * 0.12, 0.0, 1.0);
  vec3 color = mix(ultramarine, violet, smoothstep(0.1, 0.28, z));
  color = mix(color, vermilion, smoothstep(0.26, 0.45, z));
  color = mix(color, coral, smoothstep(0.45, 0.65, z));
  color = mix(color, peach, smoothstep(0.7, 0.95, z));
  color += (vec3(lookHash(cell + 1.0), lookHash(cell + 2.0), lookHash(cell + 3.0)) - 0.5) * 0.1;
  // Light: each stroke carries one value, so shading steps like paint.
  float lit = dot(n, l) * 0.5 + 0.5;
  float value = floor(lit * 4.0 + h1 * 0.8) / 4.0;
  color *= 0.62 + 0.5 * value;
  color = mix(color, ultramarine * 0.7, smoothstep(0.35, 0.1, lit) * 0.5);
  // Bristle grooves, and knife highlights broken along the paint ridges.
  color *= 0.9 + 0.14 * bristles;
  float knife = step(0.7, value) * smoothstep(0.62, 0.8, bristles) * step(0.45, h2);
  color = mix(color, cream, knife * 0.75);
  // Spots as dabs: dark umber in the body, pale cream on the ridge.
  float spots = k.spot * k.spotMask * smoothstep(0.35, 0.6, skinNoise(k.p * 40.0) + 0.3);
  color = mix(color, mix(vec3(0.3, 0.13, 0.08), cream, k.shark), spots * 0.85);
  // A painted contour that breaks off.
  float sil = 1.0 - abs(dot(n, v));
  float contour = smoothstep(0.8, 0.93, sil) * step(0.4, skinNoise(vec2(k.arc * 2.5, 1.0)));
  return mix(color, vec3(0.55, 0.12, 0.1), contour * 0.7);
}

// 6: Cosmic whale shark. Dark, velvety skin with nebulae glowing beneath it
// (amber, cyan, magenta, with a little parallax), softly emissive spots of
// varied brightness, sparse stars, and plenty of dark between.
vec3 lookCosmic(LookSkin k, vec3 n, vec3 v, vec3 l, float boil) {
  float sil = 1.0 - abs(dot(n, v));
  vec2 deep = k.p + v.xy * 0.18;
  vec3 skin = vec3(0.05, 0.045, 0.09) * (0.8 + 0.4 * skinFbm(k.p * vec2(3.0, 6.0) + k.seed));
  float t = uSkinTime * 0.03;
  float nebA = smoothstep(0.42, 0.74, skinFbm(deep * vec2(0.9, 1.7) + k.seed + t));
  float nebB = smoothstep(0.46, 0.76, skinFbm(deep * vec2(1.4, 2.4) + k.seed + 9.0 - t));
  float nebC = smoothstep(0.5, 0.8, skinFbm(deep * vec2(2.2, 3.6) + k.seed + 17.0 + t * 0.5));
  float wisps = skinFbm(deep * vec2(6.0, 11.0) + 3.0);
  vec3 amber = vec3(1.0, 0.58, 0.18), cyan = vec3(0.25, 0.8, 1.0), magenta = vec3(0.95, 0.22, 0.7);
  // Amber gathers in the frill, cyan along the ridge, magenta between.
  vec3 glow = amber * nebA * (0.4 + 0.8 * smoothstep(0.3, 0.8, k.e))
    + cyan * nebB * (1.0 - smoothstep(0.2, 0.5, k.e)) * 0.9
    + magenta * nebC * 0.8;
  vec3 color = skin + glow * (0.45 + 0.75 * wisps);
  // Spots glow from within, each its own brightness.
  float shine = 0.55 + 0.7 * lookHash(floor(k.p * vec2(8.0, 20.0)) + k.seed);
  color += vec3(1.0, 0.92, 0.78) * k.spot * k.spotMask * shine * 0.9;
  // Sparse stars, twinkling.
  vec2 starCell = k.p * vec2(30.0, 70.0);
  float star = step(0.975, lookHash(floor(starCell))) * (1.0 - smoothstep(0.02, 0.12, length(fract(starCell) - 0.5)));
  color += vec3(1.0, 0.97, 0.9) * star * (0.6 + 0.4 * sin(uSkinTime * 3.0 + lookHash(floor(starCell) + 5.0) * 20.0));
  // A soft violet glow at the edges, from inside rather than reflected.
  color += vec3(0.55, 0.35, 0.8) * pow(sil, 2.5) * 0.35 + vec3(0.9, 0.55, 0.4) * smoothstep(0.88, 1.0, k.e) * 0.35;
  return color;
}

// 7: Hand-drawn cartoon. Flat color in two tones, deliberately drawn
// highlight shapes, flat spots and a bold outline that boils a little.
vec3 lookCartoon(LookSkin k, vec3 n, vec3 v, vec3 l, float boil) {
  vec3 navy = vec3(0.14, 0.2, 0.5), magenta = vec3(0.86, 0.24, 0.52), orange = vec3(0.98, 0.58, 0.26), cream = vec3(1.0, 0.86, 0.66);
  float z = k.zone;
  vec3 color = z < 0.2 ? navy : z < 0.42 ? magenta : z < 0.8 ? orange : cream;
  float ndl = dot(n, l);
  float wobble = (lookHash(vec2(boil, 9.0)) - 0.5) * 0.12;
  color *= ndl + wobble < 0.05 ? 0.72 : 1.0;
  // Flat spots: light on the ridge, dark in the body.
  color = mix(color, z < 0.2 ? vec3(0.95, 0.93, 0.88) : vec3(0.32, 0.12, 0.1), step(0.5, k.spot * k.spotMask));
  // A drawn highlight: a crisp shape where light meets the surface squarely.
  vec3 h = normalize(l + v);
  float hl = step(0.978 + wobble * 0.08, dot(n, h)) * step(0.45, skinNoise(k.p * 3.0 + boil * 0.1));
  color = mix(color, vec3(1.0, 0.98, 0.94), hl);
  // A bold, boiling outline at the silhouette and the rim.
  float sil = 1.0 - abs(dot(n, v));
  float line = max(step(0.78 + wobble, sil), step(0.965 + wobble * 0.1, k.e));
  return mix(color, vec3(0.16, 0.13, 0.13), line);
}

vec3 lookPaint(float look, vec3 natural, LookSkin k, vec3 n, vec3 v, vec3 l, float boil) {
  if (look < 0.5) return natural;
  if (look < 1.5) return lookInk(k, n, v, l, boil);
  if (look < 2.5) return lookWatercolor(k, n, v, l, boil);
  if (look < 3.5) return lookPorcelain(k, n, v, l, boil);
  if (look < 4.5) return lookFabric(k, n, v, l, boil);
  if (look < 5.5) return lookOil(k, n, v, l, boil);
  if (look < 6.5) return lookCosmic(k, n, v, l, boil);
  return lookCartoon(k, n, v, l, boil);
}
`;

export const lookFragment = /* glsl */`
  #include <encodings_fragment>
  if (uLook.x > 0.5 || uLook.y > 0.5) {
    vec3 lookN = normalize(normal); // already facing the viewer on both sides
    vec3 lookV = normalize(vViewPosition);
    vec3 lookL = normalize(vec3(0.3, 0.8, 0.5));
    #if NUM_DIR_LIGHTS > 0
      lookL = directionalLights[0].direction;
    #endif
    float lookBoil = floor(uSkinTime * 2.5);
    LookSkin lookSkin = LookSkin(skinArc, skinS, skinE, skinZone, skinBroad, skinSpot, skinSpotMask, skinShark, skinP, skinSeed);
    vec3 lookA = lookPaint(uLook.x, gl_FragColor.rgb, lookSkin, lookN, lookV, lookL, lookBoil);
    vec3 lookB = uLook.z > 0.001 ? lookPaint(uLook.y, gl_FragColor.rgb, lookSkin, lookN, lookV, lookL, lookBoil) : lookA;
    // A new look sweeps down the body from head to tail, as if repainted.
    float lookArc = skinArc / max(uLength, 0.001);
    float lookSweep = smoothstep(lookArc - 0.12, lookArc + 0.12, uLook.z * 1.24 - 0.12);
    gl_FragColor.rgb = mix(lookA, lookB, lookSweep);
  }
`;
