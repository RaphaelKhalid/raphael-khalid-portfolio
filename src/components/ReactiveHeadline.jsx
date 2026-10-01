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

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const ReactiveHeadline = ({ className = "" }) => {
  const wrapRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current, text = textRef.current;
    const canvas = document.createElement('canvas');
    canvas.className = 'headline-canvas absolute pointer-events-none z-[2]';
    canvas.setAttribute('aria-hidden', 'true');
    wrap.append(canvas);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !canvas.transferControlToOffscreen || typeof Worker === 'undefined') {
      canvas.remove(); return;
    }
    let worker, cancelled = false, inFlight = false, failed = false;
    const fallback = () => { failed = true; worker?.terminate(); canvas.remove(); text.style.color = ''; clearTimeout(deadline); };
    const deadline = setTimeout(fallback, 45000);
    try {
      worker = new Worker(new URL('../utils/headline.worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        if (cancelled) return;
        if (data.type === 'painted') { clearTimeout(deadline); inFlight = false; text.style.color = 'transparent'; }
        if (data.type === 'error') fallback();
      };
      worker.onerror = event => { event.preventDefault(); fallback(); };
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage({ type: 'init', canvas: offscreen }, [offscreen]);
    } catch { fallback(); return; }

    let letters = [];
    let layout = { pad: 0, scale: 1, fontPx: 100, range: 18 };
    const boxes = new Float32Array(MAX_LETTERS * 4), poses = new Float32Array(MAX_LETTERS * 4);
    const stateA = new Float32Array(MAX_LETTERS * 4), stateB = new Float32Array(MAX_LETTERS * 4), stateC = new Float32Array(MAX_LETTERS * 4);

    function build() {
      if (failed) return;
      const style = getComputedStyle(text);
      const fontPx = parseFloat(style.fontSize);
      const scale = Math.min(devicePixelRatio || 1, 1.75);
      // Room around the words for letters to turn and lift into.
      const pad = Math.round(fontPx * 0.35);
      const rect = text.getBoundingClientRect();
      const off = document.createElement("canvas");
      const ctx = off.getContext("2d", { willReadFrequently: true });
      const font = `${style.fontStyle} ${style.fontWeight} ${fontPx * scale}px ${style.fontFamily}`;
      const spacing = `${parseFloat(style.letterSpacing || "0") * scale}px`;
      ctx.font = font;
      if ("letterSpacing" in ctx) ctx.letterSpacing = spacing;
      // Canvas does not inherit the DOM's variable-font axes. Reserve the
      // actual raster width too, otherwise the final glyph can be cropped.
      const rasterWidth = Math.max(...[...text.querySelectorAll('[data-line]')].map(line => ctx.measureText(line.textContent).width / scale));
      const width = Math.ceil(Math.max(rect.width, rasterWidth) + pad * 2), height = Math.ceil(rect.height + pad * 2);
      const pixelWidth = Math.round(width * scale), pixelHeight = Math.round(height * scale);
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      canvas.style.left = `${-pad}px`; canvas.style.top = `${-pad}px`;
      off.width = pixelWidth; off.height = pixelHeight;
      ctx.font = font;
      if ("letterSpacing" in ctx) ctx.letterSpacing = spacing;
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
      const alpha = ctx.getImageData(0, 0, off.width, off.height).data;
      worker.postMessage({ type: 'build', alpha, width: pixelWidth, height: pixelHeight, range }, [alpha.buffer]);
      layout = { pad, scale, fontPx, range };

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
      if (inFlight || !canvas.isConnected) return;
      const rect = canvas.getBoundingClientRect();
      inFlight = true;
      worker.postMessage({ type: 'frame', boxes, poses, stateA, stateB, stateC, layout, time, phase,
        raly: [(ralyScreen.x - rect.left) * layout.scale, (ralyScreen.y - rect.top) * layout.scale], count: letters.length });
    }

    function tick(now) {
      frame = requestAnimationFrame(tick);
      if (failed) { cancelAnimationFrame(frame); return; }
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
      if (cancelled) return;
      rebuild();
      observer.observe(wrap);
      io.observe(wrap);
      frame = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect(); io.disconnect();
      removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      cancelled = true; clearTimeout(deadline); worker.terminate(); canvas.remove(); text.style.color = "";
    };
  }, []);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <h1 ref={textRef} className="headline-type relative z-[1] select-text" aria-label="running experiments">
        {LINES.map(line => (
          <span key={line} data-line className="block w-fit">{line}</span>
        ))}
      </h1>
    </div>
  );
};

export default ReactiveHeadline;
