import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { growSpecimen, createRandom } from './anatomy.js';
import { createShared, createSkinMaterial, createDepthMaterial, createFormationMaterial } from './materials.js';
import { createSwimmer } from './swimmer.js';
import { createPattern } from './pattern.js';
import { createBodyFrames } from './frames.js';
import { createAudio } from './audio.js';
import { createAppearanceCycle } from './palettes.js';
import { lookIndex } from './looks.js';
import { ralyScreen } from './store.js';

// raly, the site's resident organism (membrane study 08, in site form).
//
// It lives in one fixed, transparent canvas that covers the viewport, behind
// the page's text. The viewport is its world: it swims in from the right and
// wanders. The sides are portals: out one side, back in the other. It tends to
// turn back before the top, and if it leaves through the top it comes back in
// from the left or the right, as if through a portal. It keeps above a floor
// (the bottom of the view, or the contact section's sunlit floor when that is
// on screen). It ignores the cursor; a click on its body makes it
// flinch, flash and grow new pigment where it was touched. With permission it
// listens to music through the microphone.
//
// Other components read `ralyScreen` (store.js) to react to where it is.

const FOV = 30;
const LOOK = new THREE.Vector3(0, -0.35, 0);
const HOME = new THREE.Vector3(0, 1.7, 16.5);
const SCALE = 0.68;


const wave = (x, offset = 0) => (Math.sin(x * Math.PI * 2 + offset) + 0.6 * Math.sin(x * Math.PI * 2 * 1.618 + 1.3 + offset)) / 1.6;

export function createRaly(canvas, { reducedMotion = false, quality = 'high', seed = Math.floor(Math.random() * 90000) + 10000, onReady, runtime, detailed = true } = {}) {
  runtime ??= {
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    search: location.search, hidden: () => document.hidden,
    status: name => canvas.classList.add(name), screen() {},
    subscribe(resize, visibility) {
      const update = () => { Object.assign(this.viewport, { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }); resize(); };
      addEventListener('resize', update); document.addEventListener('visibilitychange', visibility);
      return () => { removeEventListener('resize', update); document.removeEventListener('visibilitychange', visibility); };
    },
  };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(runtime.viewport.dpr, quality === 'high' ? 1.5 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Light intensities are in three.js's physical units (r155+); the factor
  // of pi keeps them as they were tuned under the older convention.

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 80);
  camera.position.copy(HOME); camera.lookAt(LOOK);

  // The sunlit room from the membrane studies, minus its floor: the page is
  // the floor.
  let environment = null;
  function prepareEnvironment() {
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
    room.traverse(object => {
      if (object.material?.isMeshBasicMaterial) object.material.color.multiply(new THREE.Color(object.position.x > 0 ? '#e3ecff' : '#ffe2c2')).multiplyScalar(0.55);
    });
    environment = pmrem.fromScene(room, 0.035);
    scene.environment = environment.texture;
    room.dispose(); pmrem.dispose();
  }
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x6b4f5a, 0.25 * Math.PI));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.2 * Math.PI);
  sun.position.set(-1.5, 9, 4.5); sun.castShadow = true;
  sun.shadow.mapSize.set(quality === 'high' ? 1024 : 512, quality === 'high' ? 1024 : 512);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, near: 0.5, far: 30 });
  sun.shadow.radius = 14; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  const fill = new THREE.DirectionalLight(0x9cc8ff, 0.4 * Math.PI); fill.position.set(6, 1.5, 5);
  const back = new THREE.DirectionalLight(0xffa25e, 2.2 * Math.PI); back.position.set(-2.5, 3.5, -7);
  scene.add(sun, sun.target, fill, back);
  // A soft contact shadow on whatever it rests on.
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), new THREE.ShadowMaterial({ opacity: 0 }));
  shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  // --- the organism --------------------------------------------------------
  const specimen = growSpecimen(seed);
  specimen.surfaces.filter(s => s.role === 'ribbon').forEach(s => s.geometry.dispose());
  specimen.surfaces = specimen.surfaces.filter(s => s.role !== 'ribbon');
  const random = createRandom(seed ^ 0x5bd1e995);
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  specimen.surfaces.forEach(surface => { surface.patternRect = new THREE.Vector4(0, 0, 1, 1); });
  let pattern = { texture: blank, step() {}, inject() {}, dispose() {} };
  const shared = createShared({ spineLength: specimen.spine.length, scale: SCALE, pattern: blank });
  const formation = { value: new THREE.Vector3(reducedMotion ? 1 : 0, 0, 0) };
  let compiled = false, previewReady = false, disposed = false, compileFrame = 0, skinAt = 0, released = false;
  let compilation = null;
  shared.palette.value.set(specimen.palette.hue, specimen.palette.warmth);
  // It moves through its palettes and art styles; ?look=ink shows and holds one.
  const askedLook = new URLSearchParams(runtime.search).get('look');
  const palettes = createAppearanceCycle(shared, { look: askedLook, canTransition: activateSkinLooks });
  shared.morph.value.set(0, 0, 0, 1);
  const swimmer = createSwimmer(specimen, { scale: SCALE, random, faithful: true });
  const organism = new THREE.Group(); organism.scale.setScalar(SCALE); scene.add(organism);
  const skinGroup = new THREE.Group();
  let meshes = [];
  const skinVariants = new Map();
  // Art styles compile one transition ahead, never all at once: each variant
  // is a large program, and compiling them back to back kept the GPU busy
  // (and the page stuttering) for the first ~20 s.
  let preparing = null, stylesAt = Infinity;
  const wantedLooks = () => [...new Set([shared.look.value.x, shared.look.value.y].map(Math.round))].sort((a, b) => a - b);
  function prepareSkin() {
    const activeLooks = wantedLooks();
    meshes = specimen.surfaces.map(surface => {
      const mesh = new THREE.Mesh(surface.geometry, createSkinMaterial(shared, surface, { formation, looks: activeLooks, membraneOnly: true }));
      mesh.customDepthMaterial = createDepthMaterial(shared, surface, { membraneOnly: true });
      mesh.castShadow = true; mesh.frustumCulled = false;
      skinGroup.add(mesh);
      return mesh;
    });
    skinVariants.set(activeLooks.join(','), meshes.map(mesh => mesh.material));
  }
  const drawings = specimen.surfaces.map(surface => {
    const mesh = new THREE.Mesh(surface.geometry, createFormationMaterial(shared, surface, formation));
    mesh.frustumCulled = false;
    organism.add(mesh);
    return mesh;
  });
  const frames = createBodyFrames(specimen, SCALE);
  const audio = runtime.audio ?? createAudio();

  // --- world bounds from the viewport ---------------------------------------
  const view = { width: 1, height: 1, floorScreen: null, heroBias: 1 };
  const bounds = { center: new THREE.Vector3(), xRange: 5, yMin: -1.8, yMax: 2.2, zMin: -0.9, zMax: 0.6, halfWidth: 8, halfHeight: 4.4, floorY: -3.35, wrap: true };
  const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const ndc = new THREE.Vector2(), hitPoint = new THREE.Vector3();
  function screenToWorld(x, y, out = hitPoint) {
    ndc.set(x / view.width * 2 - 1, 1 - y / view.height * 2);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(plane, out);
  }
  function resize() {
    // A hidden or not-yet-laid-out page can report a zero viewport; that would
    // put the camera at infinity and leave the swimmer stepping NaNs forever.
    view.width = Math.max(320, runtime.viewport.width); view.height = Math.max(320, runtime.viewport.height);
    renderer.setSize(view.width, view.height, false);
    const aspect = view.width / view.height;
    camera.aspect = aspect;
    const distance = HOME.distanceTo(LOOK) * Math.max(1, 1.25 / aspect);
    camera.position.copy(HOME).sub(LOOK).setLength(distance).add(LOOK);
    camera.lookAt(LOOK);
    camera.updateProjectionMatrix();
    // screenToWorld can run before the first render has updated the camera.
    camera.updateMatrixWorld();
    bounds.halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    bounds.halfWidth = bounds.halfHeight * aspect;
  }
  function updateBounds() {
    const floorScreen = view.floorScreen ?? view.height - 6;
    bounds.floorY = (screenToWorld(view.width / 2, Math.min(floorScreen, view.height - 6))?.y) ?? -3.35;
    shadowPlane.position.y = bounds.floorY - 0.02;
    const top = screenToWorld(view.width / 2, 70)?.y ?? 3;
    bounds.yMin = bounds.floorY + 1.4;
    bounds.yMax = Math.max(bounds.yMin + 0.3, top - 1.6);
    // In the hero it keeps to the right half, clear of the headline.
    const full = Math.max(0.5, bounds.halfWidth - 2.2);
    const bias = view.heroBias;
    bounds.center.set(bounds.halfWidth * 0.42 * bias, (bounds.yMin + bounds.yMax) / 2, 0);
    bounds.xRange = Math.max(0.5, full * (1 - 0.6 * bias));
  }

  const probe = new THREE.Vector3();
  // Portals: once the whole body is past a side, it reappears past the other;
  // past the top, it comes back in from the left or right, 50/50.
  const portalShift = new THREE.Vector3(), portalPoint = new THREE.Vector3(), portalDirection = new THREE.Vector3();
  // Being carried: the grabbed point eases toward the cursor, bringing the
  // whole body along without changing its shape.
  // The cursor is projected onto a screen-facing plane through the grabbed
  // point, so that point stays under the cursor at any depth.
  const grab = { active: false, at: new THREE.Vector3(), target: new THREE.Vector3(), step: new THREE.Vector3(), plane: new THREE.Plane(), facing: new THREE.Vector3() };
  function carry(dt) {
    if (!grab.active) return;
    grab.step.subVectors(grab.target, grab.at).multiplyScalar(1 - Math.exp(-dt * 16));
    grab.at.add(grab.step);
    swimmer.carry(grab.step);
  }

  function portal() {
    if (!ralyScreen.visible && ralyScreen.right === -1e4) return false;
    const margin = 40, worldPerPx = (2 * bounds.halfWidth) / view.width;
    const span = (view.width + (ralyScreen.right - ralyScreen.left) + 2 * margin) * worldPerPx;
    // Only on the way out: arriving from off-screen never triggers a portal.
    const heading = swimmer.heading;
    if (ralyScreen.right < -margin && heading.x < 0) { swimmer.teleport(portalShift.set(span, 0, 0), bounds); return true; }
    if (ralyScreen.left > view.width + margin && heading.x > 0) { swimmer.teleport(portalShift.set(-span, 0, 0), bounds); return true; }
    if (ralyScreen.bottom < -margin && heading.y > 0) {
      const side = Math.random() < 0.5 ? -1 : 1;
      portalPoint.set(side * (bounds.halfWidth + 3.5), (bounds.yMin + bounds.yMax) / 2, 0);
      swimmer.enterFrom(portalPoint, portalDirection.set(-side, -0.12, 0));
      return true;
    }
    return false;
  }

  function restInHero() {
    // If the ray ever misses the plane, fall back to the desktop resting place.
    const narrow = view.width < 700 && screenToWorld(view.width * 0.64, view.height * 0.27);
    const center = narrow ? narrow.clone() : new THREE.Vector3(bounds.halfWidth * 0.45, 0.4, 0);
    swimmer.setInspect(true, { center });
  }

  // --- simulation ----------------------------------------------------------
  const state = { time: 0, phase: 0, running: false, frame: 0, last: 0, touch: { t: 0, v: 0.5, frames: 0 } };
  let sound = audio.state;
  function updateGenome(t, mood) {
    shared.genome.value.set(
      1 + 0.16 * wave(t / 37) + 0.06 * mood.curious - 0.14 * mood.startle + 0.2 * sound.bass,
      0.14 + 0.2 * (0.5 + 0.5 * wave(t / 53, 2.1)),
      Math.max(0.4, 1 + 0.3 * wave(t / 29, 4.2) + 0.25 * mood.curious + 0.75 * sound.bass),
      1 + 0.28 * wave(t / 44, 1.2) - 0.1 * mood.startle,
    );
  }
  const center = new THREE.Vector3(), headPoint = new THREE.Vector3();
  function simulate(dt) {
    state.time += dt;
    state.phase = (state.phase + dt * Math.PI * 2 / 12) % (Math.PI * 2);
    sound = audio.update(dt);
    if (previewReady) palettes.update(dt);
    formation.value.x = reducedMotion ? 1 : Math.min(1, state.time / 2.4);
    formation.value.z = reducedMotion ? 0 : state.time;
    if (compiled) formation.value.y = reducedMotion ? 1 : Math.min(1, (state.time - skinAt) / 0.8);
    updateBounds();
    const env = { bounds, food: null, feeding: false, energy: 1 + 1.0 * sound.level };
    const body = swimmer.update(dt, env);
    carry(dt);
    if (!reducedMotion && !grab.active && portal()) swimmer.update(0, env);
    shared.spinePos.value.set(body.spinePos);
    shared.spineQuat.value.set(body.spineQuat);
    organism.position.copy(body.position); organism.quaternion.copy(body.quaternion);
    shared.beat.value = Math.max(sound.beat, body.mood.startle * 0.6);
    frames.update(body, shared.genome.value.x);
    shared.effort.value += (body.effort - shared.effort.value) * (1 - Math.exp(-dt * 2.5));
    const m = body.mood;
    shared.mood.value.set(m.curious, m.startle, m.feed, m.turn);
    shared.skinTime.value += dt * (1 + 1.2 * m.curious + 2.5 * m.startle + 2.5 * sound.mid);
    updateGenome(state.time, m);
    if (released && state.time > stylesAt) prepareLooks(palettes.upcoming);
    if (compiled && state.touch.frames > 0) {
      pattern.inject(specimen.surfaces[0], state.touch.t, state.touch.v + 0.06 * Math.sin(state.touch.frames * 0.7), 0.9);
      state.touch.frames--;
    }
    const drift = 0.5 - 0.5 * Math.cos(state.time * Math.PI * 2 / 95);
    if (compiled) pattern.step(Math.min(6, Math.max(1, Math.round(dt * 300))), drift * drift);

    // Publish where it is on screen.
    center.copy(body.center).project(camera);
    frames.pointOn(0.05, 0, headPoint).project(camera);
    ralyScreen.x = (center.x * 0.5 + 0.5) * view.width;
    ralyScreen.y = (0.5 - center.y * 0.5) * view.height;
    ralyScreen.headX = (headPoint.x * 0.5 + 0.5) * view.width;
    ralyScreen.headY = (0.5 - headPoint.y * 0.5) * view.height;
    ralyScreen.radius = view.height * 0.22;
    // Its outline on screen, for anything that wants to sit beside it.
    let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
    for (let k = 0; k <= 12; k++) for (const s of [-1, 0, 1]) {
      frames.pointOn(k / 12, s, probe).project(camera);
      const sx = (probe.x * 0.5 + 0.5) * view.width, sy = (0.5 - probe.y * 0.5) * view.height;
      top = Math.min(top, sy); bottom = Math.max(bottom, sy); left = Math.min(left, sx); right = Math.max(right, sx);
    }
    Object.assign(ralyScreen, { top, left, right, bottom });
    // The contact shadow only appears as it nears the floor.
    const clearance = frames.points.reduce((low, p) => Math.min(low, p.y), Infinity) - bounds.floorY;
    shadowPlane.material.opacity = 0.07 * (1 - Math.min(1, Math.max(0, (clearance - 0.4) / 2.2)));
    ralyScreen.visible = Math.abs(center.x) < 1.2 && Math.abs(center.y) < 1.2;
    ralyScreen.startle = m.startle;
  }
  let lastPublish = -Infinity;
  function publish() {
    const now = performance.now();
    if (now - lastPublish < 32 && !reducedMotion) return;
    lastPublish = now;
    const contours = [], hits = [];
    for (const across of [-1, -0.65, -0.3, 0, 0.3, 0.65, 1]) {
      const points = [];
      for (let k = 0; k <= 24; k++) {
        frames.pointOn(k / 24, across, probe).project(camera);
        const x = (probe.x * 0.5 + 0.5) * view.width, y = (0.5 - probe.y * 0.5) * view.height;
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`); hits.push(x, y);
      }
      contours.push('M' + points.join(' L'));
    }
    runtime.screen({ ...ralyScreen }, contours, hits);
  }
  function render() {
    shared.phase.value = state.phase;
    shared.pattern.value = pattern.texture;
    renderer.render(scene, camera);
    if (formation.value.y === 1 && !released) {
      released = true;
      drawings.forEach(mesh => { mesh.visible = false; });
      stylesAt = state.time + 4;
    }
    publish();
  }
  let frameId = 0;
  function tick(now) {
    frameId = 0;
    if (!state.running || runtime.hidden()) return;
    const dt = state.last ? Math.min((now - state.last) / 1000, 0.05) : 0;
    state.last = now;
    simulate(dt);
    render();
    frameId = requestAnimationFrame(tick);
  }
  function schedule() {
    cancelAnimationFrame(frameId); state.last = 0;
    if (previewReady && state.running && !runtime.hidden()) frameId = requestAnimationFrame(tick);
  }

  // --- touch ---------------------------------------------------------------
  function nearestOnBody(clientX, clientY) {
    let best = Infinity, bestT = 0, bestS = 0;
    for (let i = 0; i <= 24; i++) for (let j = -3; j <= 3; j++) {
      const t = i / 24, s = j * 0.3;
      frames.pointOn(t, s, probe).project(camera);
      const d = Math.hypot((probe.x * 0.5 + 0.5) * view.width - clientX, (0.5 - probe.y * 0.5) * view.height - clientY);
      if (d < best) { best = d; bestT = t; bestS = s; }
    }
    return best <= Math.max(24, view.height * 0.04) ? { t: bestT, s: bestS } : null;
  }

  resize(); updateBounds();
  // Place the body in the hero, then release it as soon as the first skin paints.
  restInHero();
  simulate(0);
  // The physical skin compiles in the worker while the page owns the SVG.
  // Both materials share the live pose; detail never gates swimming or input.
  function whenCompiled() {
    if (disposed) return;
    compiled = true;
    skinAt = state.time;
    if (reducedMotion) formation.value.y = 1;
    meshes.forEach(mesh => organism.add(mesh));
    render();
    runtime.status('is-ready');
    schedule();
  }
  function cachedSkin(looks) {
    for (const [key, materials] of skinVariants) {
      if (looks.every(index => key.split(',').includes(String(index)))) return materials;
    }
    return null;
  }
  function activateSkinLooks(looks) {
    if (!detailed) return previewReady;
    if (!compiled) return false;
    const materials = cachedSkin(looks);
    // A click asked for a style that is not ready: prepare it now, change once it is.
    if (!materials) { prepareLooks(looks); return false; }
    meshes.forEach((mesh, i) => { mesh.material = materials[i]; });
    return true;
  }
  function warmSkin(materials) {
    const previous = meshes.map(mesh => mesh.material);
    const scissor = renderer.getScissor(new THREE.Vector4());
    const scissorTest = renderer.getScissorTest(), shadows = renderer.shadowMap.autoUpdate;
    try {
      meshes.forEach((mesh, i) => { mesh.material = materials[i]; });
      // Exercise the real canvas draw path, including uniforms and vertex bindings.
      // A render target has different shader settings; compileAsync alone misses
      // first-draw work. Restore and repaint before this frame can be presented.
      renderer.setScissor(0, 0, 1, 1); renderer.setScissorTest(true);
      renderer.shadowMap.autoUpdate = false;
      renderer.render(scene, camera);
    } finally {
      meshes.forEach((mesh, i) => { mesh.material = previous[i]; });
      renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
      renderer.shadowMap.autoUpdate = shadows;
      renderer.render(scene, camera);
    }
  }
  function prepareLooks(wanted) {
    if (!detailed || !compiled || preparing || disposed) return;
    const looks = [...new Set(wanted)].sort((a, b) => a - b);
    if (cachedSkin(looks)) return;
    preparing = (async () => {
      const group = new THREE.Group();
      const materials = specimen.surfaces.map(surface => {
        const material = createSkinMaterial(shared, surface, { formation, looks, membraneOnly: true });
        group.add(new THREE.Mesh(surface.geometry, material));
        return material;
      });
      await compileScene(group, scene);
      if (disposed) return;
      warmSkin(materials);
      // Offered to transitions only once compiled and drawn.
      skinVariants.set(looks.join(','), materials);
    })().catch(error => {
      // Keep the current appearance; the next request tries again.
      if (!disposed) console.warn('raly could not prepare its paint style', error);
    }).finally(() => { preparing = null; });
  }
  function compileScene(group, targetScene = null) {
    try { compilation = renderer.compileAsync(group, camera, targetScene); }
    catch (error) { compilation = Promise.reject(error); }
    return compilation;
  }
  compileScene(scene).then(() => {
    if (disposed) return;
    previewReady = true;
    if (!reducedMotion) swimmer.setInspect(false);
    render();
    runtime.status('is-forming');
    runtime.status('is-active');
    onReady?.();
    schedule();
    // The simple body is visible before allocating the environment, pattern,
    // or physical skin. The rich path runs only in the rendering worker.
    if (!detailed) {
      runtime.status('is-ready'); return;
    }
    compileFrame = requestAnimationFrame(() => {
      compileFrame = requestAnimationFrame(async () => {
        if (disposed) return;
        try {
          prepareEnvironment();
          pattern = createPattern(renderer, specimen.surfaces, { size: quality === 'high' ? 512 : 256, seed: specimen.patternSeed });
          // Bounded batches let the worker service resize/visibility/input.
          for (let i = 0; i < 600 && !disposed; i += 24) {
            pattern.step(24, 0);
            await new Promise(resolve => setTimeout(resolve, 0));
          }
          if (disposed) return;
          prepareSkin();
          await compileScene(skinGroup, scene);
          whenCompiled();
        } catch (error) {
          if (!disposed) { console.warn('raly skin could not finish; keeping the drawing', error); runtime.status('is-fallback'); }
        }
      });
    });
  }, error => { if (!disposed) console.warn('raly drawing could not start', error); });
  const onResize = () => {
    resize(); updateBounds();
    if (!previewReady || reducedMotion) restInHero();
    if (previewReady && !state.running) { simulate(0); render(); }
  };
  const unsubscribe = runtime.subscribe(onResize, schedule);

  return {
    audio,
    seed,
    start() { if (reducedMotion) return; state.running = true; schedule(); },
    stop() { state.running = false; schedule(); },
    /** Floor in viewport CSS pixels from the top, or null for the bottom of the view. */
    setFloor(screenY) { view.floorScreen = screenY; },
    /** 1 while the hero is on screen (keep right, clear of the headline), 0 elsewhere. */
    setHeroBias(value) { view.heroBias = value; },
    /** It follows the cursor (viewport CSS px), or pass null when the cursor leaves. */
    setPointer(clientX, clientY) {
      if (clientX === null) { swimmer.setPointer(null); return; }
      const at = screenToWorld(clientX, clientY);
      if (at) swimmer.setPointer(at.clone());
    },
    /** How briskly it follows: 1 normally, higher while it guides the tour. */
    setPace(value) { swimmer.setPace(value); },
    /** Repaint raly in one of its art styles (see looks.js). */
    setLook(name) { const i = lookIndex(name); if (activateSkinLooks([i])) shared.look.value.set(i, i, 0); }, // for previews and tests
    /** True if the point is on raly's body. */
    hover(clientX, clientY) { return Boolean(nearestOnBody(clientX, clientY)); },
    /** A click on the body: it flinches away and pigment blooms where it was touched. */
    /** A click on the body: pigment blooms where it was touched and raly
     *  changes into its next appearance. It does not flee. */
    touch(clientX, clientY) {
      const hit = nearestOnBody(clientX, clientY);
      if (!hit) return false;
      palettes.next({ quick: true });
      if (!detailed || compiled) Object.assign(state.touch, { t: hit.t, v: hit.s * 0.5 + 0.5, frames: 24 });
      return true;
    },
    /** Pick raly up at a point on its body; false if the point misses it. */
    grab(clientX, clientY) {
      const hit = nearestOnBody(clientX, clientY);
      if (!hit) return false;
      frames.pointOn(hit.t, hit.s, grab.at);
      camera.getWorldDirection(grab.facing);
      grab.plane.setFromNormalAndCoplanarPoint(grab.facing, grab.at);
      grab.target.copy(grab.at); grab.active = true;
      swimmer.setHeld(true);
      return true;
    },
    /** Carry it: the grabbed point follows the cursor. */
    drag(clientX, clientY) {
      if (!grab.active) return;
      ndc.set(clientX / view.width * 2 - 1, 1 - clientY / view.height * 2);
      raycaster.setFromCamera(ndc, camera);
      const at = raycaster.ray.intersectPlane(grab.plane, hitPoint);
      if (at) grab.target.copy(at);
    },
    /** Let go: it swims on from where it was left. */
    release() {
      if (!grab.active) return;
      grab.active = false;
      swimmer.setHeld(false);
    },
    /** For tests and captures. */
    advance(seconds, step = 1 / 60) { for (let t = 0; t < seconds; t += step) simulate(step); render(); },
    capture() { render(); return canvas.toDataURL('image/png'); },
    dispose() {
      if (disposed) return;
      disposed = true;
      state.running = false; cancelAnimationFrame(frameId);
      cancelAnimationFrame(compileFrame);
      unsubscribe();
      audio.disable();
      // Three's async compiler polls its material programs. Keep those alive
      // until the outstanding poll settles, even when the component unmounts.
      const release = () => {
        meshes.forEach(mesh => mesh.customDepthMaterial.dispose());
        for (const materials of skinVariants.values()) materials.forEach(material => material.dispose());
        drawings.forEach(mesh => mesh.material.dispose());
        specimen.surfaces.forEach(surface => surface.geometry.dispose());
        shadowPlane.geometry.dispose(); shadowPlane.material.dispose();
        pattern.dispose(); blank.dispose(); environment?.dispose(); renderer.dispose();
      };
      if (compilation) compilation.then(release, release); else release();
      ralyScreen.visible = false;
    },
  };
}
