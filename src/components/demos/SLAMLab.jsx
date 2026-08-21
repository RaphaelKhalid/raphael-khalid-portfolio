"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { clampShadow, makeFrameGate } from "./canvasBudget";
const W = 580, H = 460;
const RAY_COUNT = 120;
const MAX_RANGE = 150;
const LANDMARK_DETECT_RANGE = 110;
const CELL = 8;
const GW = Math.ceil(W / CELL);
const GH = Math.ceil(H / CELL);
const L_OCC = 0.85;
const L_FREE = 0.28;
const L_CLAMP = 8;
const OCC_THRESH = 1.5;
const FREE_THRESH = -1.5;
const ACCENT = "#F2A03D";
const WALLS = [
  { x1: 30, y1: 30, x2: 550, y2: 30 },
  { x1: 550, y1: 30, x2: 550, y2: 430 },
  { x1: 550, y1: 430, x2: 30, y2: 430 },
  { x1: 30, y1: 430, x2: 30, y2: 30 },
  { x1: 150, y1: 30, x2: 150, y2: 160 },
  { x1: 150, y1: 200, x2: 150, y2: 300 },
  { x1: 300, y1: 150, x2: 430, y2: 150 },
  { x1: 380, y1: 280, x2: 380, y2: 430 },
  { x1: 200, y1: 310, x2: 320, y2: 310 }
];
const LANDMARKS = [
  { id: 1, x: 80, y: 80, color: "#F2A03D" },
  { id: 2, x: 460, y: 80, color: "#4FB6D6" },
  { id: 3, x: 80, y: 380, color: "#79C08E" },
  { id: 4, x: 460, y: 380, color: "#D9756A" },
  { id: 5, x: 290, y: 230, color: "#8E86D8" }
];
function raycast(ox, oy, angle) {
  let minDist = MAX_RANGE;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  for (const w of WALLS) {
    const wx = w.x2 - w.x1, wy = w.y2 - w.y1;
    const denom = dx * wy - dy * wx;
    if (Math.abs(denom) < 1e-6)
      continue;
    const t1 = ((w.x1 - ox) * wy - (w.y1 - oy) * wx) / denom;
    const t2 = ((w.x1 - ox) * dy - (w.y1 - oy) * dx) / denom;
    if (t1 > 0 && t2 >= 0 && t2 <= 1)
      minDist = Math.min(minDist, t1);
  }
  return minDist;
}
function computeRays(ox, oy) {
  const results = new Array(RAY_COUNT);
  for (let i = 0; i < RAY_COUNT; i++) {
    const a = i / RAY_COUNT * Math.PI * 2;
    results[i] = raycast(ox, oy, a);
  }
  return results;
}
function SLAMLab({ onUncertaintyLow }) {
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const robotRef = useRef({
    x: 290,
    y: 230,
    angle: 0,
    vx: 0,
    vy: 0,
    va: 0,
    posUncertainty: 40,
    driftX: 0,
    driftY: 0
  });
  const observedRef = useRef([]);
  const waypointRef = useRef(null);
  const gridRef = useRef(new Float32Array(GW * GH));
  const visitedRef = useRef(/* @__PURE__ */ new Set());
  const loopFlashRef = useRef(0);
  const loopBannerRef = useRef(0);
  const loopCountRef = useRef(0);
  const loopCooldownRef = useRef(0);
  const trailRef = useRef([]);
  const keysRef = useRef(/* @__PURE__ */ new Set());
  const rafRef = useRef(0);
  const notifiedRef = useRef(false);
  const dirtyRef = useRef(true);
  const mapDirtyRef = useRef(true);
  const raysRef = useRef([]);
  const lastRayPosRef = useRef({ x: -999, y: -999 });
  const frameCountRef = useRef(0);
  const exploredRef = useRef(0);
  const [info, setInfo] = useState({ uncertainty: 40, observed: 0, explored: 0, loops: 0 });
  const updateGrid = useCallback((ox, oy, rays) => {
    const grid = gridRef.current;
    for (let i = 0; i < RAY_COUNT; i++) {
      const a = i / RAY_COUNT * Math.PI * 2;
      const dist = rays[i];
      const ca = Math.cos(a), sa = Math.sin(a);
      const hit = dist < MAX_RANGE;
      for (let d = 4; d < dist - 2; d += CELL * 0.6) {
        const gx = Math.floor((ox + d * ca) / CELL);
        const gy = Math.floor((oy + d * sa) / CELL);
        if (gx >= 0 && gx < GW && gy >= 0 && gy < GH) {
          const idx = gy * GW + gx;
          grid[idx] = Math.max(-L_CLAMP, grid[idx] - L_FREE);
        }
      }
      if (hit) {
        const gx = Math.floor((ox + dist * ca) / CELL);
        const gy = Math.floor((oy + dist * sa) / CELL);
        if (gx >= 0 && gx < GW && gy >= 0 && gy < GH) {
          const idx = gy * GW + gx;
          grid[idx] = Math.min(L_CLAMP, grid[idx] + L_OCC);
        }
      }
    }
    mapDirtyRef.current = true;
  }, []);
  const draw = useCallback((rays) => {
    const canvas = canvasRef.current;
    if (!canvas)
      return;
    const ctx = clampShadow(canvas.getContext("2d"));
    const r = robotRef.current;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(242,160,61,0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    const wp = waypointRef.current;
    if (wp) {
      ctx.strokeStyle = "rgba(242,160,61,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(wp.x - 12, wp.y);
      ctx.lineTo(wp.x + 12, wp.y);
      ctx.moveTo(wp.x, wp.y - 12);
      ctx.lineTo(wp.x, wp.y + 12);
      ctx.stroke();
    }
    for (let i = 0; i < RAY_COUNT; i++) {
      const angle = i / RAY_COUNT * Math.PI * 2;
      const dist = rays[i] ?? MAX_RANGE;
      const ex = r.x + dist * Math.cos(angle);
      const ey = r.y + dist * Math.sin(angle);
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (dist < MAX_RANGE - 1) {
        ctx.fillStyle = ACCENT;
        ctx.fillRect(ex - 1.3, ey - 1.3, 2.6, 2.6);
      }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(242,160,61,0.16)";
    ctx.lineWidth = 2;
    for (const w of WALLS) {
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    }
    for (const lm of LANDMARKS) {
      const dist = Math.hypot(lm.x - r.x, lm.y - r.y);
      const obs = observedRef.current.find((o) => o.id === lm.id);
      const isVisible = dist < LANDMARK_DETECT_RANGE;
      if (isVisible && !obs) {
        observedRef.current.push({
          id: lm.id,
          observedCount: 1,
          x: lm.x + r.driftX * 0.5,
          y: lm.y + r.driftY * 0.5,
          color: lm.color
        });
      } else if (isVisible && obs) {
        obs.observedCount++;
        r.posUncertainty = Math.max(6, r.posUncertainty - 0.9);
        r.driftX *= 0.96;
        r.driftY *= 0.96;
        obs.x += (lm.x - obs.x) * 0.05;
        obs.y += (lm.y - obs.y) * 0.05;
      }
      const known = !!obs;
      if (isVisible) {
        ctx.strokeStyle = lm.color + "66";
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(lm.x, lm.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.shadowColor = known ? lm.color : "rgba(242,160,61,0.1)";
      ctx.shadowBlur = known ? 12 : 3;
      ctx.beginPath();
      ctx.arc(lm.x, lm.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = known ? lm.color + "33" : "rgba(242,160,61,0.04)";
      ctx.strokeStyle = known ? lm.color : "rgba(242,160,61,0.15)";
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = known ? lm.color : "rgba(242,160,61,0.25)";
      ctx.textAlign = "center";
      ctx.fillText(known ? String(lm.id) : "?", lm.x, lm.y + 4);
      ctx.textAlign = "left";
    }
    const trail = trailRef.current;
    const AXLE = 6;
    for (let i = 1; i < trail.length; i++) {
      const alpha = i / trail.length * 0.18;
      const p = trail[i - 1], q = trail[i];
      const perpPx = Math.sin(p.a) * AXLE, perpPy = -Math.cos(p.a) * AXLE;
      const perpQx = Math.sin(q.a) * AXLE, perpQy = -Math.cos(q.a) * AXLE;
      ctx.strokeStyle = `rgba(121,192,142,${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - perpPx, p.y - perpPy);
      ctx.lineTo(q.x - perpQx, q.y - perpQy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x + perpPx, p.y + perpPy);
      ctx.lineTo(q.x + perpQx, q.y + perpQy);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.posUncertainty, r.posUncertainty * 0.7, r.angle, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(217,117,106,${Math.min(0.55, r.posUncertainty / 60)})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 12;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.roundRect(-10, -6, 20, 12, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(2, -4, 7, 8, 2);
    ctx.fill();
    ctx.fillStyle = "#33230D";
    [[-7, -7], [-7, 7], [5, -7], [5, 7]].forEach(([wx, wy]) => {
      ctx.beginPath();
      ctx.roundRect(wx - 3, wy - 2, 6, 4, 1);
      ctx.fill();
    });
    ctx.restore();
    if (loopFlashRef.current > 0) {
      const a = Math.min(0.9, loopFlashRef.current / 30);
      ctx.strokeStyle = `rgba(242,160,61,${a})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, W - 6, H - 6);
    }
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(10, 10, 230, 54);
    ctx.strokeStyle = "rgba(242,160,61,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 230, 54);
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(242,160,61,0.6)";
    ctx.fillText(`uncertainty: ${r.posUncertainty.toFixed(1)}px   drift: ${Math.hypot(r.driftX, r.driftY).toFixed(1)}`, 20, 28);
    ctx.fillText(`landmarks: ${observedRef.current.length}/${LANDMARKS.length}   loops: ${loopCountRef.current}`, 20, 44);
    ctx.fillText(`WASD/arrows \xB7 click = waypoint`, 20, 58);
    if (loopBannerRef.current > 0) {
      ctx.fillStyle = "rgba(11,13,18,0.92)";
      ctx.fillRect(W / 2 - 110, 16, 220, 26);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1;
      ctx.strokeRect(W / 2 - 110, 16, 220, 26);
      ctx.fillStyle = ACCENT;
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText("LOOP CLOSURE \u2014 MAP CORRECTED", W / 2, 33);
      ctx.textAlign = "left";
    }
  }, []);
  const drawMap = useCallback(() => {
    const canvas = mapRef.current;
    if (!canvas)
      return;
    const ctx = clampShadow(canvas.getContext("2d"));
    const grid = gridRef.current;
    ctx.fillStyle = "#0B0D12";
    ctx.fillRect(0, 0, W, H);
    let known = 0;
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        const v = grid[gy * GW + gx];
        if (v === 0)
          continue;
        known++;
        if (v >= OCC_THRESH) {
          const t = Math.min(1, v / L_CLAMP);
          ctx.fillStyle = `rgba(242,160,61,${0.35 + t * 0.55})`;
        } else if (v <= FREE_THRESH) {
          ctx.fillStyle = "rgba(90,100,116,0.5)";
        } else {
          ctx.fillStyle = "rgba(60,68,82,0.18)";
        }
        ctx.fillRect(gx * CELL, gy * CELL, CELL, CELL);
      }
    }
    for (const o of observedRef.current) {
      ctx.beginPath();
      ctx.arc(o.x, o.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = o.color + "55";
      ctx.strokeStyle = o.color;
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = o.color;
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("L" + o.id, o.x, o.y - 9);
      ctx.textAlign = "left";
    }
    const r = robotRef.current;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const explored = Math.round(known / (GW * GH) * 100);
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(10, 10, 170, 34);
    ctx.strokeStyle = "rgba(242,160,61,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 170, 34);
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(242,160,61,0.6)";
    ctx.fillText("OCCUPANCY MAP (log-odds)", 18, 26);
    ctx.fillText(`explored: ${explored}%`, 18, 39);
    return explored;
  }, []);
  const checkLoopClosure = useCallback((r) => {
    if (loopCooldownRef.current > 0) {
      loopCooldownRef.current--;
      return;
    }
    const key = Math.floor(r.x / 24) * 1e3 + Math.floor(r.y / 24);
    const visited = visitedRef.current;
    const drift = Math.hypot(r.driftX, r.driftY);
    if (visited.has(key) && trailRef.current.length > 60 && drift > 6) {
      loopCountRef.current++;
      loopFlashRef.current = 40;
      loopBannerRef.current = 120;
      loopCooldownRef.current = 180;
      r.posUncertainty = Math.max(6, r.posUncertainty * 0.4);
      r.driftX *= 0.15;
      r.driftY *= 0.15;
      for (const o of observedRef.current) {
        const lm = LANDMARKS.find((l) => l.id === o.id);
        o.x += (lm.x - o.x) * 0.6;
        o.y += (lm.y - o.y) * 0.6;
      }
    }
    visited.add(key);
  }, []);
  const resetMap = useCallback(() => {
    gridRef.current = new Float32Array(GW * GH);
    observedRef.current = [];
    visitedRef.current = /* @__PURE__ */ new Set();
    trailRef.current = [];
    loopCountRef.current = 0;
    loopFlashRef.current = 0;
    loopBannerRef.current = 0;
    loopCooldownRef.current = 0;
    exploredRef.current = 0;
    notifiedRef.current = false;
    const r = robotRef.current;
    r.posUncertainty = 40;
    r.driftX = 0;
    r.driftY = 0;
    dirtyRef.current = true;
    mapDirtyRef.current = true;
    setInfo({ uncertainty: 40, observed: 0, explored: 0, loops: 0 });
  }, []);
  useEffect(() => {
    const gate = makeFrameGate(30);
    const update = () => {
      const r = robotRef.current;
      const keys = keysRef.current;
      const MAX_SPEED = 4.5;
      const ACCEL = 0.45;
      const FRICTION = 0.82;
      const MAX_TURN = 0.055;
      const speed = Math.hypot(r.vx, r.vy);
      const turnFactor = Math.min(1, speed / 2);
      const wp = waypointRef.current;
      let autoTurn = 0, autoThrust = false;
      if (wp) {
        const dx = wp.x - r.x, dy = wp.y - r.y;
        const distWp = Math.hypot(dx, dy);
        if (distWp < 12) {
          waypointRef.current = null;
        } else {
          const desired = Math.atan2(dy, dx);
          let da = desired - r.angle;
          while (da > Math.PI)
            da -= Math.PI * 2;
          while (da < -Math.PI)
            da += Math.PI * 2;
          autoTurn = Math.max(-1, Math.min(1, da * 3)) * MAX_TURN;
          autoThrust = Math.abs(da) < 1;
        }
      }
      const manualTurn = keys.has("ArrowLeft") || keys.has("a") ? -MAX_TURN * turnFactor : keys.has("ArrowRight") || keys.has("d") ? MAX_TURN * turnFactor : 0;
      r.va = manualTurn !== 0 ? manualTurn : autoTurn * Math.max(0.2, turnFactor);
      if (keys.has("ArrowUp") || keys.has("w") || autoThrust) {
        r.vx += ACCEL * Math.cos(r.angle);
        r.vy += ACCEL * Math.sin(r.angle);
      } else if (keys.has("ArrowDown") || keys.has("s")) {
        r.vx -= ACCEL * Math.cos(r.angle) * 0.7;
        r.vy -= ACCEL * Math.sin(r.angle) * 0.7;
      }
      const spd0 = Math.hypot(r.vx, r.vy);
      if (spd0 > MAX_SPEED) {
        r.vx = r.vx / spd0 * MAX_SPEED;
        r.vy = r.vy / spd0 * MAX_SPEED;
      }
      r.vx *= FRICTION;
      r.vy *= FRICTION;
      const nx = r.x + r.vx, ny = r.y + r.vy;
      let blocked = false;
      for (const w of WALLS) {
        const wx = w.x2 - w.x1, wy = w.y2 - w.y1;
        const len2 = wx * wx + wy * wy;
        const t = Math.max(0, Math.min(1, ((nx - w.x1) * wx + (ny - w.y1) * wy) / len2));
        const cx = w.x1 + t * wx, cy = w.y1 + t * wy;
        if (Math.hypot(nx - cx, ny - cy) < 14) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        r.x = nx;
        r.y = ny;
      } else {
        r.vx *= -0.3;
        r.vy *= -0.3;
        waypointRef.current = null;
      }
      r.angle += r.va;
      const spd = Math.hypot(r.vx, r.vy);
      const moving = spd > 0.2;
      const trail = trailRef.current;
      if (spd > 0.3) {
        trail.push({ x: r.x, y: r.y, a: r.angle });
        if (trail.length > 160)
          trail.shift();
        dirtyRef.current = true;
      }
      if (moving && !blocked) {
        r.posUncertainty = Math.min(60, r.posUncertainty + 0.05);
        r.driftX += (Math.random() - 0.5) * 0.35 * spd * 0.3;
        r.driftY += (Math.random() - 0.5) * 0.35 * spd * 0.3;
        checkLoopClosure(r);
      }
      if (loopFlashRef.current > 0) {
        loopFlashRef.current--;
        dirtyRef.current = true;
      }
      if (loopBannerRef.current > 0) {
        loopBannerRef.current--;
        dirtyRef.current = true;
      }
      const lp = lastRayPosRef.current;
      const moved = Math.hypot(r.x - lp.x, r.y - lp.y) > 1.5;
      if (moved || raysRef.current.length === 0) {
        raysRef.current = computeRays(r.x, r.y);
        updateGrid(r.x, r.y, raysRef.current);
        lastRayPosRef.current = { x: r.x, y: r.y };
        dirtyRef.current = true;
      }
      if (dirtyRef.current) {
        draw(raysRef.current);
        dirtyRef.current = false;
      }
      if (mapDirtyRef.current) {
        exploredRef.current = drawMap() ?? exploredRef.current;
        mapDirtyRef.current = false;
      }
      frameCountRef.current++;
      if (frameCountRef.current % 6 === 0) {
        setInfo({
          uncertainty: r.posUncertainty,
          observed: observedRef.current.length,
          explored: exploredRef.current,
          loops: loopCountRef.current
        });
      }
      if (r.posUncertainty < 12 && observedRef.current.length >= 3 && !notifiedRef.current) {
        notifiedRef.current = true;
        onUncertaintyLow?.();
      }
      gate(rafRef, update);
    };
    gate(rafRef, update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw, drawMap, updateGrid, checkLoopClosure, onUncertaintyLow]);
  useEffect(() => {
    const down = (e) => {
      const k = e.key;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "w", "a", "s", "d", "W", "A", "S", "D"].includes(k)) {
        keysRef.current.add(k.length === 1 ? k.toLowerCase() : k);
        dirtyRef.current = true;
        e.preventDefault();
      }
    };
    const up = (e) => {
      const k = e.key;
      keysRef.current.delete(k.length === 1 ? k.toLowerCase() : k);
      dirtyRef.current = true;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
  const onCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas)
      return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * W;
    const y = (e.clientY - rect.top) / rect.height * H;
    waypointRef.current = { x, y };
    dirtyRef.current = true;
  }, []);
  const chipStyle = {
    background: "#000",
    border: "1px solid rgba(242,160,61,0.1)",
    borderRadius: 3,
    padding: "10px 12px"
  };
  const monoFont = "var(--font-jetbrains-mono, var(--font-geist-mono))";
  return <div>
    <div style={{
      marginBottom: 10,
      fontSize: 11,
      color: "#3A3F4C",
      fontFamily: monoFont,
      letterSpacing: "0.04em",
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap"
    }}>
      <span>
        {"drive:"}
        {" "}
        {["W", "A", "S", "D"].map((k) => <kbd key={k} style={{
          background: "#000",
          border: "1px solid rgba(242,160,61,0.2)",
          borderRadius: 2,
          padding: "2px 5px",
          fontSize: 10,
          marginRight: 3,
          fontFamily: "inherit"
        }}>{k}</kbd>)}
        {"\u2014 click canvas to set a waypoint"}
      </span>
      <button
        onClick={resetMap}
        style={{
          marginLeft: "auto",
          background: "#000",
          border: "1px solid rgba(242,160,61,0.35)",
          color: ACCENT,
          borderRadius: 3,
          padding: "5px 12px",
          fontSize: 10,
          fontFamily: monoFont,
          letterSpacing: "0.06em",
          cursor: "pointer",
          textTransform: "uppercase"
        }}
      >Reset Map</button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
      <div className="sim-canvas-wrap"><canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={onCanvasClick}
        style={{ display: "block", width: "100%", height: "auto", cursor: "crosshair" }}
      /></div>
      <div className="sim-canvas-wrap"><canvas
        ref={mapRef}
        width={W}
        height={H}
        style={{ display: "block", width: "100%", height: "auto" }}
      /></div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>{[
      {
        label: "POS_UNCERTAINTY",
        value: info.uncertainty.toFixed(1) + "px",
        color: info.uncertainty < 15 ? ACCENT : info.uncertainty < 30 ? "#F2A03D" : "#F2A03D"
      },
      { label: "LANDMARKS_SEEN", value: `${info.observed}/${LANDMARKS.length}`, color: "#E9EAEF" },
      { label: "EXPLORED", value: info.explored + "%", color: "#E9EAEF" },
      { label: "LOOP_CLOSURES", value: String(info.loops), color: info.loops > 0 ? ACCENT : "#3A3F4C" }
    ].map((chip) => <div key={chip.label} style={chipStyle}>
      <div style={{
        fontSize: 9,
        color: "#3A3F4C",
        fontFamily: monoFont,
        letterSpacing: "0.08em",
        textTransform: "uppercase"
      }}>{chip.label}</div>
      <div style={{
        fontFamily: monoFont,
        fontSize: 14,
        fontWeight: 700,
        color: chip.color,
        marginTop: 3
      }}>{chip.value}</div>
    </div>)}</div>
  </div>;
}
export {
  SLAMLab as default
};
