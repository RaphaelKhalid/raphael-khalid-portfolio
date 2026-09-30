import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { growSpecimen, createRandom } from './anatomy.js';
import { createShared, createSkinMaterial, createDepthMaterial } from './materials.js';
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

export function createRaly(canvas, { reducedMotion = false, quality = 'high', seed = Math.floor(Math.random() * 90000) + 10000 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.5 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 80);
  camera.position.copy(HOME); camera.lookAt(LOOK);

  // The sunlit room from the membrane studies, minus its floor: the page is
  // the floor.
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  room.traverse(object => {
    if (object.material?.isMeshBasicMaterial) object.material.color.multiply(new THREE.Color(object.position.x > 0 ? '#e3ecff' : '#ffe2c2')).multiplyScalar(0.55);
  });
  const environment = pmrem.fromScene(room, 0.035);
  scene.environment = environment.texture;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x6b4f5a, 0.25));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.2);
  sun.position.set(-1.5, 9, 4.5); sun.castShadow = true;
  sun.shadow.mapSize.set(quality === 'high' ? 1024 : 512, quality === 'high' ? 1024 : 512);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, near: 0.5, far: 30 });
  sun.shadow.radius = 14; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  const fill = new THREE.DirectionalLight(0x9cc8ff, 0.4); fill.position.set(6, 1.5, 5);
  const back = new THREE.DirectionalLight(0xffa25e, 2.2); back.position.set(-2.5, 3.5, -7);
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
  const pattern = createPattern(renderer, specimen.surfaces, { size: quality === 'high' ? 1024 : 512, seed: specimen.patternSeed });
  pattern.step(quality === 'high' ? 1500 : 1000, 0);
  const shared = createShared({ spineLength: specimen.spine.length, scale: SCALE, pattern: pattern.texture });
  shared.palette.value.set(specimen.palette.hue, specimen.palette.warmth);
  // It moves through its palettes and art styles; ?look=ink shows and holds one.
  const askedLook = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('look') : null;
  const palettes = createAppearanceCycle(shared, { look: askedLook });
  shared.morph.value.set(0, 0, 0, 1);
  const swimmer = createSwimmer(specimen, { scale: SCALE, random, faithful: true });
  const organism = new THREE.Group(); organism.scale.setScalar(SCALE); scene.add(organism);
  const meshes = specimen.surfaces.map(surface => {
    const mesh = new THREE.Mesh(surface.geometry, createSkinMaterial(shared, surface));
    mesh.customDepthMaterial = createDepthMaterial(shared, surface);
    mesh.castShadow = true; mesh.frustumCulled = false;
    organism.add(mesh);
    return mesh;
  });
  const frames = createBodyFrames(specimen, SCALE);
  const audio = createAudio();

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
    view.width = innerWidth; view.height = innerHeight;
    renderer.setSize(view.width, view.height, false);
    const aspect = view.width / view.height;
    camera.aspect = aspect;
    const distance = HOME.distanceTo(LOOK) * Math.max(1, 1.25 / aspect);
    camera.position.copy(HOME).sub(LOOK).setLength(distance).add(LOOK);
    camera.lookAt(LOOK);
    camera.updateProjectionMatrix();
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

  function enter() {
    swimmer.reset({ center: new THREE.Vector3(bounds.halfWidth + 3.5, 0.6, -0.3) });
  }
  function restInHero() {
    swimmer.setInspect(true, { center: new THREE.Vector3(bounds.halfWidth * 0.45, 0.4, 0) });
  }

  // --- simulation ----------------------------------------------------------
  const state = { time: 0, phase: 0, running: false, frame: 0, last: 0, touch: { t: 0, v: 0.5, frames: 0 } };
  let sound = audio.state;
  function updateGenome(t, mood) {
    shared.genome.value.set(
      1 + 0.16 * wave(t / 37) + 0.06 * mood.curious - 0.14 * mood.startle + 0.12 * sound.bass,
      0.14 + 0.2 * (0.5 + 0.5 * wave(t / 53, 2.1)),
      Math.max(0.4, 1 + 0.3 * wave(t / 29, 4.2) + 0.25 * mood.curious + 0.45 * sound.bass),
      1 + 0.28 * wave(t / 44, 1.2) - 0.1 * mood.startle,
    );
  }
  const center = new THREE.Vector3(), headPoint = new THREE.Vector3();
  function simulate(dt) {
    state.time += dt;
    state.phase = (state.phase + dt * Math.PI * 2 / 12) % (Math.PI * 2);
    sound = audio.update(dt);
    palettes.update(dt);
    updateBounds();
    const env = { bounds, food: null, feeding: false, energy: 1 + 0.6 * sound.level };
    const body = swimmer.update(dt, env);
    if (!reducedMotion && portal()) swimmer.update(0, env);
    shared.spinePos.value.set(body.spinePos);
    shared.spineQuat.value.set(body.spineQuat);
    organism.position.copy(body.position); organism.quaternion.copy(body.quaternion);
    shared.beat.value = Math.max(sound.beat, body.mood.startle * 0.6);
    frames.update(body, shared.genome.value.x);
    shared.effort.value += (body.effort - shared.effort.value) * (1 - Math.exp(-dt * 2.5));
    const m = body.mood;
    shared.mood.value.set(m.curious, m.startle, m.feed, m.turn);
    shared.skinTime.value += dt * (1 + 1.2 * m.curious + 2.5 * m.startle + 1.5 * sound.mid);
    updateGenome(state.time, m);
    if (state.touch.frames > 0) {
      pattern.inject(specimen.surfaces[0], state.touch.t, state.touch.v + 0.06 * Math.sin(state.touch.frames * 0.7), 0.9);
      state.touch.frames--;
    }
    const drift = 0.5 - 0.5 * Math.cos(state.time * Math.PI * 2 / 95);
    pattern.step(Math.min(6, Math.max(1, Math.round(dt * 300))), drift * drift);

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
  function render() {
    shared.phase.value = state.phase;
    shared.pattern.value = pattern.texture;
    renderer.render(scene, camera);
  }
  let frameId = 0;
  function tick(now) {
    frameId = 0;
    if (!state.running || document.hidden) return;
    const dt = state.last ? Math.min((now - state.last) / 1000, 0.05) : 0;
    state.last = now;
    simulate(dt);
    render();
    frameId = requestAnimationFrame(tick);
  }
  function schedule() {
    cancelAnimationFrame(frameId); state.last = 0;
    if (state.running && !document.hidden) frameId = requestAnimationFrame(tick);
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
  if (reducedMotion) restInHero(); else enter();
  simulate(0); render();
  const onResize = () => { resize(); updateBounds(); if (!state.running) { simulate(0); render(); } };
  addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', schedule);

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
    setLook(name) { const i = lookIndex(name); shared.look.value.set(i, i, 0); }, // for previews and tests
    /** True if the point is on raly's body. */
    hover(clientX, clientY) { return Boolean(nearestOnBody(clientX, clientY)); },
    /** A click on the body: it flinches away and pigment blooms where it was touched. */
    touch(clientX, clientY) {
      const hit = nearestOnBody(clientX, clientY);
      if (!hit) return false;
      const at = screenToWorld(clientX, clientY);
      if (at) swimmer.poke(at.clone());
      palettes.next();
      Object.assign(state.touch, { t: hit.t, v: hit.s * 0.5 + 0.5, frames: 24 });
      return true;
    },
    /** For tests and captures. */
    advance(seconds, step = 1 / 60) { for (let t = 0; t < seconds; t += step) simulate(step); render(); },
    capture() { render(); return canvas.toDataURL('image/png'); },
    dispose() {
      state.running = false; cancelAnimationFrame(frameId);
      removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', schedule);
      audio.disable();
      meshes.forEach(mesh => { mesh.material.dispose(); mesh.customDepthMaterial.dispose(); mesh.geometry.dispose(); });
      shadowPlane.geometry.dispose(); shadowPlane.material.dispose();
      pattern.dispose(); environment.dispose(); renderer.dispose();
      ralyScreen.visible = false;
    },
  };
}
