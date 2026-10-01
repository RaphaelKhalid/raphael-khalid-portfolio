import { useCallback, useEffect, useRef, useState } from "react";
import { projects } from "../constants/index";
import { plateQuotes } from "../constants/plateQuotes";
import { ralyScreen } from "../raly/store";
import { styles } from "../styles";
import SectionHead from "./SectionHead";
import wallClip from "../assets/plates/wall.mp4";
import wallPoster from "../assets/plates/wall-poster.webp";
import { linkProgram, whenIdle } from "../utils/webgl";
import "./works-wall.css";

// Projects as a sleeping wall: every plate is on screen at once, all of them
// animating, but at rest they are ink on paper at half speed, so the wall
// reads as one calm texture. Whatever the cursor, keyboard focus or raly is
// near wakes up: full color, full speed. With nothing near, a plate wakes now
// and then on its own. Click a plate to open it.
//
// All 23 clips are tiled into one video (wall.mp4, 6 x 4 tiles of 288 px,
// built from src/assets/plates/*.mp4 with ffmpeg xstack), so the page decodes
// one video rather than 23. A WebGL canvas draws each tile's region into its
// plate, blending a half-speed copy (asleep) with a full-speed copy (awake).
// Without WebGL, with reduced motion or with data saving on, the plates show
// still frames that color in on hover.

const media = import.meta.glob("../assets/plates/*", { eager: true, as: "url" });
const GRID = [6, 4];
const shortName = name => name.split(" — ")[0];

const VERTEX = `#version 300 es
in vec2 aCorner;
uniform vec4 uRect[${projects.length}];
uniform float uWake[${projects.length}];
uniform vec2 uRes;
out vec2 vUv;
flat out int vTile;
out float vWake;
void main() {
  vec4 r = uRect[gl_InstanceID];
  float w = uWake[gl_InstanceID];
  float s = 0.93 + 0.07 * w; // asleep, a plate sits a little smaller
  vec2 p = r.xy + r.zw * 0.5 + (aCorner - 0.5) * r.zw * s;
  vUv = aCorner; vTile = gl_InstanceID; vWake = w;
  vec2 clip = p / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uCalm;
uniform sampler2D uAwake;
in vec2 vUv;
flat in int vTile;
in float vWake;
out vec4 outColor;
const vec2 GRID = vec2(${GRID[0]}.0, ${GRID[1]}.0);
const vec3 PAPER = vec3(0.957, 0.922, 0.875);
void main() {
  vec2 cell = vec2(float(vTile % ${GRID[0]}), float(vTile / ${GRID[0]}));
  vec2 inset = mix(vec2(0.6 / 288.0), vec2(1.0 - 0.6 / 288.0), vUv);
  vec2 uv = (cell + inset) / GRID;
  vec3 calm = texture(uCalm, uv).rgb;
  vec3 awake = texture(uAwake, uv).rgb;
  // Asleep: ink on paper, a little faded.
  float value = dot(calm, vec3(0.299, 0.587, 0.114));
  vec3 ink = mix(vec3(0.2, 0.18, 0.17), PAPER, smoothstep(0.12, 0.93, value));
  vec3 asleep = mix(PAPER, mix(ink, calm, 0.12), 0.82);
  // The clips are drawn on the page's own paper: key it out, so raly can be
  // seen swimming between the machines rather than behind paper squares.
  float away = max(distance(calm, PAPER), distance(awake, PAPER));
  float alpha = smoothstep(0.035, 0.1, away);
  vec3 color = mix(asleep, awake, smoothstep(0.0, 1.0, vWake));
  outColor = vec4(color * alpha, alpha);
}`;

function makeVideo(src, rate) {
  const video = document.createElement("video");
  Object.assign(video, { src, muted: true, loop: true, playsInline: true, preload: "auto", playbackRate: rate, defaultPlaybackRate: rate });
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  return video;
}

// The living wall: a canvas over the plates' art, driven by a small loop.
function useLivingWall(wallRef, tileRefs, hovered, focused) {
  const [live, setLive] = useState(false);
  const pointer = useRef({ x: -1e4, y: -1e4 });

  useEffect(() => {
    const wall = wallRef.current;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches || navigator.connection?.saveData;
    if (still) return undefined;
    // The wall is far below the hero: build it in an idle moment, off the
    // critical first second, and never wait on the shader link.
    const canvas = document.createElement("canvas");
    let stop = null, cancelled = false, gl = null;
    const cancelIdle = whenIdle(() => {
      gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false });
      if (!gl) return;
      linkProgram(gl, VERTEX, FRAGMENT).then(program => {
        if (!cancelled) stop = start(gl, program);
      }, error => {
        if (!cancelled) console.warn("plate wall: falling back to stills", error);
      });
    });
    return () => {
      cancelled = true;
      cancelIdle();
      stop?.();
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    };

    function start(gl, program) {
      canvas.className = "wall-canvas";
      canvas.setAttribute("aria-hidden", "true");
      wall.append(canvas);

      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
      const corner = gl.getAttribLocation(program, "aCorner");
      gl.enableVertexAttribArray(corner);
      gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
      const U = Object.fromEntries(["uRect", "uWake", "uRes", "uCalm", "uAwake"].map(n => [n, gl.getUniformLocation(program, n)]));
      const textures = [0, 1].map(unit => {
        const t = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([244, 235, 223, 255]));
        return t;
      });
      gl.uniform1i(U.uCalm, 0);
      gl.uniform1i(U.uAwake, 1);

      // The wall video loads only as the wall comes near, once, shared by both
      // copies (the sleeping plates play at half speed).
      let videos = [], clipUrl = null, loading = false;
      const fresh = [false, false], ready = [false, false];
      async function loadVideos() {
        if (loading) return;
        loading = true;
        try {
          clipUrl = URL.createObjectURL(await (await fetch(wallClip)).blob());
        } catch {
          clipUrl = wallClip;
        }
        if (disposed) return;
        videos = [makeVideo(clipUrl, 0.5), makeVideo(clipUrl, 1)];
        videos.forEach((video, i) => {
          const mark = () => { fresh[i] = true; ready[i] = true; if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(mark); };
          if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(mark);
          else video.addEventListener("timeupdate", () => { fresh[i] = true; ready[i] = true; });
          video.addEventListener("loadeddata", () => { fresh[i] = true; ready[i] = true; });
          if (visible && !document.hidden) video.play().catch(() => {});
        });
      }
      let disposed = false;
      const approaching = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) { loadVideos(); approaching.disconnect(); }
      }, { rootMargin: "900px 0px" });
      approaching.observe(wall);

      const count = projects.length;
      const rects = new Float32Array(count * 4), wakeArray = new Float32Array(count);
      const wake = new Float32Array(count), centers = [];
      let size = [1, 1], tile = 100, dpr = 1;
      function measure() {
        dpr = Math.min(devicePixelRatio || 1, 2);
        const box = wall.getBoundingClientRect();
        size = [Math.max(1, Math.round(box.width * dpr)), Math.max(1, Math.round(box.height * dpr))];
        canvas.width = size[0]; canvas.height = size[1];
        tileRefs.current.forEach((el, i) => {
          const art = el?.querySelector(".wall-tile__art");
          if (!art) return;
          const r = art.getBoundingClientRect();
          rects.set([(r.left - box.left) * dpr, (r.top - box.top) * dpr, r.width * dpr, r.height * dpr], i * 4);
          centers[i] = [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
          tile = r.width;
        });
        gl.viewport(0, 0, size[0], size[1]);
      }
      const resizer = new ResizeObserver(measure);
      resizer.observe(wall);
      measure();

      let visible = false, frame = 0, last = 0, isLive = false, idle = { tile: -1, until: 0, next: 0 };
      const seen = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        videos.forEach(v => (visible && !document.hidden ? v.play().catch(() => {}) : v.pause()));
        if (visible && !frame) frame = requestAnimationFrame(loop);
      }, { rootMargin: "120px" });
      seen.observe(wall);
      const onVisibility = () => videos.forEach(v => (visible && !document.hidden ? v.play().catch(() => {}) : v.pause()));
      document.addEventListener("visibilitychange", onVisibility);
      const onMove = e => { pointer.current = { x: e.clientX, y: e.clientY }; };
      const onLeave = () => { pointer.current = { x: -1e4, y: -1e4 }; };
      addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerleave", onLeave);

      function loop(now) {
        frame = 0;
        if (!visible) return;
        frame = requestAnimationFrame(loop);
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
        last = now;
        const box = wall.getBoundingClientRect();
        const px = pointer.current.x - box.left, py = pointer.current.y - box.top;
        const rx = ralyScreen.visible ? ralyScreen.x - box.left : -1e4, ry = ralyScreen.visible ? ralyScreen.y - box.top : -1e4;
        // With nothing near, a plate wakes now and then on its own.
        let busiest = 0;
        const targets = centers.map(([cx, cy], i) => {
          const dc = Math.hypot(px - cx, py - cy) / tile, dr = Math.hypot(rx - cx, ry - cy) / (tile * 1.7);
          const t = Math.max(Math.exp(-dc * dc * 1.3) * 0.95, Math.exp(-dr * dr), i === hovered.current || i === focused.current ? 1 : 0);
          busiest = Math.max(busiest, t);
          return t;
        });
        if (busiest < 0.35 && now > idle.next) { idle = { tile: Math.floor(Math.random() * count), until: now + 2600, next: now + 3400 }; }
        if (now < idle.until && busiest < 0.35) targets[idle.tile] = Math.max(targets[idle.tile], 0.85);
        for (let i = 0; i < count; i++) {
          const target = targets[i] ?? 0, rate = target > wake[i] ? 5 : 1.4;
          wake[i] += (target - wake[i]) * (1 - Math.exp(-dt * rate));
          wakeArray[i] = wake[i];
        }
        videos.forEach((video, i) => {
          if (!fresh[i] || video.readyState < 2) return;
          fresh[i] = false;
          gl.activeTexture(gl.TEXTURE0 + i);
          gl.bindTexture(gl.TEXTURE_2D, textures[i]);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        });
        if (!ready[0] || !ready[1]) return;
        if (!isLive) { isLive = true; setLive(true); }
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform4fv(U.uRect, rects);
        gl.uniform1fv(U.uWake, wakeArray);
        gl.uniform2f(U.uRes, size[0], size[1]);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
      }
      return () => {
        cancelAnimationFrame(frame);
        seen.disconnect(); resizer.disconnect();
        removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerleave", onLeave);
        document.removeEventListener("visibilitychange", onVisibility);
        disposed = true;
        approaching.disconnect();
        videos.forEach(v => { v.pause(); v.removeAttribute("src"); v.load(); });
        if (clipUrl && clipUrl !== wallClip) URL.revokeObjectURL(clipUrl);
        canvas.remove();
      };
    }
  }, [wallRef, tileRefs, hovered, focused]);

  return live;
}

function PlateDetail({ index, onClose, onStep }) {
  const project = projects[index];
  const id = project.pixelArtwork;
  const close = useRef(null);
  useEffect(() => {
    close.current?.focus();
    document.documentElement.classList.add("print-open");
    const key = e => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onStep(1);
      if (e.key === "ArrowLeft") onStep(-1);
    };
    addEventListener("keydown", key);
    return () => { removeEventListener("keydown", key); document.documentElement.classList.remove("print-open"); };
  }, [onClose, onStep]);
  return (
    <div className="wall-detail" role="dialog" aria-modal="true" aria-labelledby="wall-detail-title" onClick={onClose}>
      <div className="wall-detail__panel" onClick={e => e.stopPropagation()}>
        <video className="wall-detail__clip" src={media[`../assets/plates/${id}.mp4`]} poster={media[`../assets/plates/${id}-poster.webp`]} autoPlay muted loop playsInline />
        <div className="wall-detail__text">
          <p className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-muted">plate {String(index + 1).padStart(2, "0")} of {projects.length}</p>
          <h3 id="wall-detail-title" className="headline-soft">{project.name}</h3>
          {plateQuotes[id] && <p className="wall-detail__quote">“{plateQuotes[id]}”</p>}
          <p className="wall-detail__description">{project.description}</p>
          <div className="wall-detail__tags">
            {project.tags.map(tag => <span key={tag.name} className={tag.color}>{tag.name}</span>)}
          </div>
          <div className="wall-detail__actions">
            <a href={project.source_code_link} target="_blank" rel="noopener noreferrer" className="wall-detail__open">Open project ↗</a>
            <span className="wall-detail__nav">
              <button type="button" onClick={() => onStep(-1)} aria-label="Previous project">←</button>
              <button type="button" onClick={() => onStep(1)} aria-label="Next project">→</button>
              <button type="button" ref={close} onClick={onClose}>close</button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Works() {
  const wallRef = useRef(null);
  const tileRefs = useRef([]);
  const hovered = useRef(-1);
  const focused = useRef(-1);
  const [open, setOpen] = useState(null);
  // The hover card: the full name and one quoted sentence, kept on screen.
  const [card, setCard] = useState(null);
  const showCard = (i, el) => {
    const r = el.getBoundingClientRect(), room = 170;
    setCard({ i, align: r.left < room ? "left" : innerWidth - r.right < room ? "right" : "center" });
  };
  const hideCard = i => setCard(c => (c?.i === i ? null : c));
  const live = useLivingWall(wallRef, tileRefs, hovered, focused);
  // The still frames (a 137 KB sheet) also wait until the wall is near.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "1200px 0px" });
    io.observe(wallRef.current);
    return () => io.disconnect();
  }, []);
  const step = useCallback(dir => setOpen(i => (i + dir + projects.length) % projects.length), []);
  const close = useCallback(() => setOpen(null), []);

  return (
    <section className="relative w-full">
      <span className="hash-span" id="work">&nbsp;</span>
      <div className={`${styles.paddingX} max-w-[1440px] mx-auto pt-6 pb-24`}>
        <SectionHead title="Projects" />
        <div ref={wallRef} id="plate-wall" className={`plate-wall ${live ? "is-live" : ""}`}>
          {projects.map((project, i) => (
            <button
              key={project.pixelArtwork}
              ref={el => { tileRefs.current[i] = el; }}
              type="button"
              className="wall-tile"
              data-tile={i}
              onClick={() => setOpen(i)}
              onPointerEnter={e => { hovered.current = i; if (e.pointerType !== "touch") showCard(i, e.currentTarget); }}
              onPointerLeave={() => { if (hovered.current === i) hovered.current = -1; hideCard(i); }}
              onFocus={e => { focused.current = i; showCard(i, e.currentTarget); }}
              onBlur={() => { if (focused.current === i) focused.current = -1; hideCard(i); }}
              aria-label={`${project.name}: open details`}
              aria-describedby={card?.i === i ? "wall-card" : undefined}
            >
              <span
                className="wall-tile__art"
                style={{
                  backgroundImage: near ? `url(${wallPoster})` : "none",
                  backgroundPosition: `${(i % GRID[0]) * 100 / (GRID[0] - 1)}% ${Math.floor(i / GRID[0]) * 100 / (GRID[1] - 1)}%`,
                  backgroundSize: `${GRID[0] * 100}% ${GRID[1] * 100}%`,
                }}
                aria-hidden="true"
              />
              <span className="wall-tile__name">
                {i === 0 && <span className="wall-tile__flag">flagship · </span>}
                {shortName(project.name)}
              </span>
              {card?.i === i && (
                <span id="wall-card" role="tooltip" className={`wall-card wall-card--${card.align}`}>
                  <span className="wall-card__name">{project.name}</span>
                  {plateQuotes[project.pixelArtwork] && <span className="wall-card__quote">“{plateQuotes[project.pixelArtwork]}”</span>}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {open !== null && <PlateDetail index={open} onClose={close} onStep={step} />}
    </section>
  );
}
