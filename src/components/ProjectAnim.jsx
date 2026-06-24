import { useEffect, useRef } from 'react';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (min, max) => Math.random() * (max - min) + min;

// Each factory(w, h) returns draw(ctx, t) using closure for state.

// 0 — Orbital Rings  [indigo / violet]
function anim0(w, h) {
  const cx = w / 2, cy = h / 2;
  const rings = [
    { r: w * 0.09, n: 6,  speed:  0.9,  col: '#818cf8', sz: 4   },
    { r: w * 0.18, n: 10, speed: -0.55, col: '#a78bfa', sz: 3   },
    { r: w * 0.27, n: 15, speed:  0.35, col: '#c4b5fd', sz: 2   },
    { r: w * 0.36, n: 20, speed: -0.2,  col: '#e0e7ff', sz: 1.5 },
  ];
  return (ctx, t) => {
    ctx.fillStyle = 'rgba(10,8,32,0.18)';
    ctx.fillRect(0, 0, w, h);
    rings.forEach(ring => {
      for (let i = 0; i < ring.n; i++) {
        const a = TAU * i / ring.n + t * ring.speed;
        const x = cx + ring.r * Math.cos(a);
        const y = cy + ring.r * Math.sin(a) * 0.55;
        ctx.beginPath();
        ctx.arc(x, y, ring.sz, 0, TAU);
        ctx.fillStyle = ring.col;
        ctx.shadowColor = ring.col;
        ctx.shadowBlur = 10;
        ctx.fill();
      }
    });
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, TAU);
    ctx.fillStyle = '#e0e7ff';
    ctx.shadowColor = '#818cf8';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;
  };
}

// 1 — Grid Wave  [teal / emerald]
function anim1(w, h) {
  const cols = 14, rows = 8;
  const cw = w / cols, ch = h / rows;
  return (ctx, t) => {
    ctx.fillStyle = '#021a10';
    ctx.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const d = Math.hypot(c - cols / 2, r - rows / 2);
        const v = Math.pow(Math.sin(d * 0.9 - t * 2.2) * 0.5 + 0.5, 1.5);
        const alpha = 0.15 + v * 0.85;
        ctx.fillStyle = v > 0.6
          ? `rgba(52,211,153,${alpha})`
          : `rgba(20,184,166,${alpha})`;
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = v * 10;
        ctx.fillRect(c * cw + 2, r * ch + 2, cw - 4, ch - 4);
      }
    }
    ctx.shadowBlur = 0;
  };
}

// 2 — Particle Storm  [crimson / amber]
function anim2(w, h) {
  const N = 65;
  const pts = Array.from({ length: N }, () => ({
    x: rand(0, w), y: rand(0, h),
    vx: rand(-2.5, 2.5), vy: rand(-2.5, 2.5),
    sz: rand(1.5, 3.5), warm: Math.random() < 0.5,
    phase: rand(0, TAU),
  }));
  return (ctx, t) => {
    ctx.fillStyle = 'rgba(28,4,4,0.22)';
    ctx.fillRect(0, 0, w, h);
    pts.forEach(p => {
      p.x += p.vx + Math.sin(t * 0.6 + p.phase) * 0.8;
      p.y += p.vy + Math.cos(t * 0.4 + p.phase) * 0.8;
      if (p.x < 0) p.x += w; if (p.x > w) p.x -= w;
      if (p.y < 0) p.y += h; if (p.y > h) p.y -= h;
      const spd = Math.hypot(p.vx, p.vy);
      const hue = p.warm ? 35 : 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.sz, 0, TAU);
      ctx.fillStyle = `hsl(${hue},92%,${52 + spd * 8}%)`;
      ctx.shadowColor = `hsl(${hue},90%,60%)`;
      ctx.shadowBlur = 8;
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  };
}

// 3 — Network Pulse  [fuchsia / violet]
function anim3(w, h) {
  const nodes = [
    [0.15,0.25],[0.5,0.12],[0.85,0.28],[0.72,0.7],
    [0.28,0.78],[0.5,0.5],[0.12,0.58],[0.88,0.55],
  ].map(([rx, ry]) => ({ x: rx * w, y: ry * h }));
  const edges = [];
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++)
      if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < w * 0.5)
        edges.push({ a: i, b: j, phase: rand(0, TAU) });

  return (ctx, t) => {
    ctx.fillStyle = '#100820';
    ctx.fillRect(0, 0, w, h);
    edges.forEach(e => {
      const pulse = Math.sin(t * 1.8 + e.phase) * 0.5 + 0.5;
      const { x: ax, y: ay } = nodes[e.a];
      const { x: bx, y: by } = nodes[e.b];
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = `rgba(192,38,211,${0.08 + pulse * 0.35})`;
      ctx.lineWidth = 1 + pulse;
      ctx.stroke();
      const px = lerp(ax, bx, (t * 0.4 + e.phase) % 1);
      const py = lerp(ay, by, (t * 0.4 + e.phase) % 1);
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, TAU);
      ctx.fillStyle = `rgba(216,180,254,${pulse})`;
      ctx.shadowColor = '#d946ef';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    nodes.forEach((n, i) => {
      const pulse = Math.sin(t * 1.2 + i) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 5 + pulse * 3, 0, TAU);
      ctx.fillStyle = `rgba(139,92,246,${0.5 + pulse * 0.5})`;
      ctx.shadowColor = '#8b5cf6';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  };
}

// 4 — Ripple Field  [lavender / rose]
function anim4(w, h) {
  const sources = [[0.2, 0.3], [0.8, 0.7], [0.6, 0.2], [0.3, 0.75]]
    .map(([rx, ry]) => ({ x: rx * w, y: ry * h, phase: rand(0, TAU) }));
  return (ctx, t) => {
    ctx.fillStyle = '#0e0618';
    ctx.fillRect(0, 0, w, h);
    sources.forEach((s, si) => {
      for (let ring = 0; ring < 5; ring++) {
        const radius = ((t * 60 + ring * 40 + si * 25) % 200);
        const alpha = Math.max(0, 1 - radius / 200);
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, TAU);
        const hue = si % 2 === 0 ? 270 : 330;
        ctx.strokeStyle = `hsla(${hue},80%,70%,${alpha * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
    sources.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, TAU);
      ctx.fillStyle = '#f0abfc';
      ctx.shadowColor = '#d946ef';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  };
}

// 5 — Fireflies  [orange / amber]
function anim5(w, h) {
  const N = 45;
  const flies = Array.from({ length: N }, () => ({
    x: rand(0, w), y: rand(0, h),
    ox: rand(0, w), oy: rand(0, h),
    rx: rand(20, 60), ry: rand(15, 45),
    speed: rand(0.3, 0.9), phase: rand(0, TAU),
    sz: rand(2, 5), warm: Math.random() < 0.6,
  }));
  return (ctx, t) => {
    ctx.fillStyle = 'rgba(18,8,0,0.2)';
    ctx.fillRect(0, 0, w, h);
    flies.forEach(f => {
      f.x = f.ox + f.rx * Math.cos(t * f.speed + f.phase);
      f.y = f.oy + f.ry * Math.sin(t * f.speed * 0.7 + f.phase);
      const pulse = Math.sin(t * 2.5 + f.phase) * 0.5 + 0.5;
      const sz = f.sz * (0.6 + pulse * 0.8);
      const hue = f.warm ? rand(25, 45) : rand(40, 55);
      ctx.beginPath();
      ctx.arc(f.x, f.y, sz, 0, TAU);
      ctx.fillStyle = `hsla(${hue},95%,${55 + pulse * 20}%,${0.7 + pulse * 0.3})`;
      ctx.shadowColor = `hsl(${hue},95%,65%)`;
      ctx.shadowBlur = 12 + pulse * 8;
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  };
}

// 6 — Spectrum  [cyan / sky]
function anim6(w, h) {
  const N = 28;
  const phases = Array.from({ length: N }, () => rand(0, TAU));
  const speeds = Array.from({ length: N }, () => rand(1.5, 3.5));
  return (ctx, t) => {
    ctx.fillStyle = '#020d14';
    ctx.fillRect(0, 0, w, h);
    const bw = w / N;
    const baseline = h * 0.85;
    ctx.beginPath();
    ctx.moveTo(0, baseline);
    for (let i = 0; i < N; i++) {
      const barH = (Math.sin(t * speeds[i] + phases[i]) * 0.5 + 0.5) * h * 0.7;
      const x = i * bw + bw / 2;
      const top = baseline - barH;
      const grad = ctx.createLinearGradient(0, baseline, 0, top);
      grad.addColorStop(0, 'rgba(6,182,212,0.2)');
      grad.addColorStop(1, `rgba(${56 + i * 4},${189},248,0.9)`);
      ctx.fillStyle = grad;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 6;
      ctx.fillRect(x - bw * 0.35, top, bw * 0.7, barH);
      ctx.lineTo(x, top);
    }
    ctx.lineTo(w, baseline);
    ctx.strokeStyle = 'rgba(56,189,248,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
}

// 7 — Lissajous Web  [emerald / lime]
function anim7(w, h) {
  const trails = Array.from({ length: 4 }, (_, i) => ({
    ax: rand(0.5, 1.5), ay: rand(0.5, 1.5),
    bx: rand(0.5, 1.5), by: rand(0.5, 1.5),
    dx: rand(0, TAU), dy: rand(0, TAU),
    col: i % 2 === 0 ? '#10b981' : '#84cc16',
  }));
  const pts = trails.map(() => []);
  return (ctx, t) => {
    ctx.fillStyle = 'rgba(2,18,8,0.25)';
    ctx.fillRect(0, 0, w, h);
    trails.forEach((tr, i) => {
      const x = w / 2 + (w * 0.4) * Math.sin(tr.ax * t + tr.dx);
      const y = h / 2 + (h * 0.4) * Math.sin(tr.ay * t + tr.dy);
      pts[i].push({ x, y });
      if (pts[i].length > 120) pts[i].shift();
      if (pts[i].length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[i][0].x, pts[i][0].y);
      pts[i].forEach((p, j) => {
        ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = tr.col;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = tr.col;
      ctx.shadowBlur = 6;
      ctx.globalAlpha = 0.75;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    });
    ctx.beginPath();
    const tx = w / 2 + (w * 0.4) * Math.sin(trails[0].ax * t + trails[0].dx);
    const ty = h / 2 + (h * 0.4) * Math.sin(trails[0].ay * t + trails[0].dy);
    ctx.arc(tx, ty, 4, 0, TAU);
    ctx.fillStyle = '#a3e635';
    ctx.shadowColor = '#84cc16';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
  };
}

// 8 — Spiral Galaxy  [gold / amber]
function anim8(w, h) {
  const N = 180;
  const cx = w / 2, cy = h / 2;
  const stars = Array.from({ length: N }, (_, i) => {
    const t = i / N;
    const r = t * Math.min(w, h) * 0.44;
    const angle = t * TAU * 3.5;
    const arm = Math.floor(Math.random() * 2) * Math.PI;
    return {
      r, angle: angle + arm + rand(-0.3, 0.3),
      sz: rand(1, 3.5 - t * 2), bright: Math.random(),
    };
  });
  return (ctx, t) => {
    ctx.fillStyle = 'rgba(18,12,2,0.18)';
    ctx.fillRect(0, 0, w, h);
    stars.forEach((s, i) => {
      const a = s.angle + t * (0.15 + (1 - i / N) * 0.25);
      const x = cx + s.r * Math.cos(a);
      const y = cy + s.r * Math.sin(a) * 0.6;
      const pulse = Math.sin(t * 1.5 + i * 0.3) * 0.4 + 0.6;
      const warm = i / N;
      const hue = lerp(42, 25, warm);
      const light = lerp(75, 45, warm);
      ctx.beginPath();
      ctx.arc(x, y, s.sz * pulse, 0, TAU);
      ctx.fillStyle = `hsl(${hue},90%,${light}%)`;
      ctx.shadowColor = `hsl(${hue},90%,70%)`;
      ctx.shadowBlur = s.sz * 4;
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, TAU);
    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#eab308';
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.shadowBlur = 0;
  };
}

// 9 — Branching Tree  [green / teal]
function anim9(w, h) {
  function branch(ctx, x, y, angle, len, depth, t) {
    if (depth === 0 || len < 2) return;
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;
    const hue = lerp(160, 140, depth / 7);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = `hsla(${hue},80%,${35 + (7 - depth) * 8}%,0.85)`;
    ctx.lineWidth = depth * 0.8;
    ctx.shadowColor = `hsl(${hue},80%,60%)`;
    ctx.shadowBlur = 4;
    ctx.stroke();
    const spread = 0.4 + 0.15 * Math.sin(t * 0.7 + depth);
    branch(ctx, ex, ey, angle - spread, len * 0.68, depth - 1, t);
    branch(ctx, ex, ey, angle + spread, len * 0.68, depth - 1, t);
  }
  return (ctx, t) => {
    ctx.fillStyle = 'rgba(2,14,6,0.35)';
    ctx.fillRect(0, 0, w, h);
    ctx.shadowBlur = 0;
    const growCycle = (t * 0.25) % 1;
    const depth = Math.floor(growCycle * 8);
    const startLen = h * 0.28;
    branch(ctx, w / 2, h, -Math.PI / 2, startLen * Math.min(growCycle * 3, 1), Math.min(depth, 7), t);
    ctx.shadowBlur = 0;
  };
}

// 10 — Solar Power  [deep red / gold]
function anim10(w, h) {
  const cx = w / 2, cy = h / 2;
  const moons = [
    { r: w * 0.28, speed: 0.5,  sz: 9,  col: '#fbbf24', moonR: w*0.1, moonSz: 5, moonSpeed: 2.2 },
    { r: w * 0.18, speed: -0.8, sz: 7,  col: '#f59e0b', moonR: 0,    moonSz: 0, moonSpeed: 0 },
    { r: w * 0.38, speed: 0.3,  sz: 6,  col: '#fde68a', moonR: w*0.07,moonSz: 3, moonSpeed: 3.0 },
  ];
  return (ctx, t) => {
    ctx.fillStyle = 'rgba(18,3,6,0.2)';
    ctx.fillRect(0, 0, w, h);
    moons.forEach(m => {
      const a = t * m.speed;
      const mx = cx + m.r * Math.cos(a);
      const my = cy + m.r * Math.sin(a) * 0.55;
      ctx.beginPath();
      ctx.arc(cx, cy, m.r, 0, TAU);
      ctx.strokeStyle = 'rgba(159,18,57,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(mx, my);
      ctx.strokeStyle = 'rgba(251,191,36,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (m.moonR > 0) {
        const ma = t * m.moonSpeed;
        const mmx = mx + m.moonR * Math.cos(ma);
        const mmy = my + m.moonR * Math.sin(ma) * 0.55;
        ctx.beginPath();
        ctx.arc(mmx, mmy, m.moonSz, 0, TAU);
        ctx.fillStyle = 'rgba(253,230,138,0.9)';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(mx, my, m.sz, 0, TAU);
      ctx.fillStyle = m.col;
      ctx.shadowColor = m.col;
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, TAU);
    ctx.fillStyle = '#9f1239';
    ctx.shadowColor = '#be123c';
    ctx.shadowBlur = 28;
    ctx.fill();
    ctx.shadowBlur = 0;
  };
}

// 11 — Bubble Drift  [blue / indigo]
function anim11(w, h) {
  const N = 18;
  const bubbles = Array.from({ length: N }, () => ({
    x: rand(0, w), y: rand(0, h),
    vx: rand(-0.4, 0.4), vy: rand(-0.3, 0.3),
    r: rand(12, 38), phase: rand(0, TAU),
    hue: Math.random() < 0.5 ? 225 : 245,
  }));
  return (ctx, t) => {
    ctx.fillStyle = 'rgba(4,6,28,0.2)';
    ctx.fillRect(0, 0, w, h);
    bubbles.forEach(b => {
      b.x += b.vx + Math.sin(t * 0.3 + b.phase) * 0.4;
      b.y += b.vy + Math.cos(t * 0.25 + b.phase) * 0.35;
      if (b.x < -b.r) b.x = w + b.r;
      if (b.x > w + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = h + b.r;
      if (b.y > h + b.r) b.y = -b.r;
    });
    bubbles.forEach((a, i) => {
      bubbles.forEach((b, j) => {
        if (j <= i) return;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < (a.r + b.r) * 1.5) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(99,102,241,${0.12 * (1 - d / ((a.r + b.r) * 1.5))})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
    });
    bubbles.forEach(b => {
      const pulse = Math.sin(t * 1.1 + b.phase) * 0.12 + 0.88;
      const grad = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r * pulse);
      grad.addColorStop(0, `hsla(${b.hue},80%,80%,0.5)`);
      grad.addColorStop(0.7, `hsla(${b.hue},70%,55%,0.15)`);
      grad.addColorStop(1, `hsla(${b.hue},80%,65%,0.4)`);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * pulse, 0, TAU);
      ctx.fillStyle = grad;
      ctx.shadowColor = `hsl(${b.hue},80%,65%)`;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.strokeStyle = `hsla(${b.hue},80%,80%,0.5)`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  };
}

// 12 — Kaleidoscope  [purple / rose]
function anim12(w, h) {
  const cx = w / 2, cy = h / 2;
  const ARMS = 6;
  return (ctx, t) => {
    ctx.fillStyle = 'rgba(14,6,20,0.25)';
    ctx.fillRect(0, 0, w, h);
    const shapes = [
      { r: w * 0.1, a: t * 0.7,          col: '#c026d3', sz: w * 0.04 },
      { r: w * 0.2, a: t * -0.5 + Math.PI, col: '#e11d48', sz: w * 0.03 },
      { r: w * 0.3, a: t * 0.3,          col: '#9333ea', sz: w * 0.025 },
    ];
    for (let arm = 0; arm < ARMS; arm++) {
      const rot = (TAU / ARMS) * arm;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot + t * 0.1);
      shapes.forEach(s => {
        const x = s.r * Math.cos(s.a);
        const y = s.r * Math.sin(s.a) * 0.7;
        const pulse = Math.sin(t * 1.5 + arm) * 0.3 + 0.7;
        ctx.beginPath();
        for (let v = 0; v < 6; v++) {
          const va = (TAU / 6) * v + t * 0.5;
          const vx = x + s.sz * pulse * Math.cos(va);
          const vy = y + s.sz * pulse * Math.sin(va);
          v === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.fillStyle = s.col + '99';
        ctx.strokeStyle = s.col;
        ctx.lineWidth = 1;
        ctx.shadowColor = s.col;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
      ctx.restore();
    }
  };
}

// 13 — Falling Pieces  [slate / amber]
function anim13(w, h) {
  const N = 30;
  const pieces = Array.from({ length: N }, () => ({
    x: rand(0, w), y: rand(-h, 0),
    vy: rand(0.4, 1.2), vx: rand(-0.4, 0.4),
    rot: rand(0, TAU), rotV: rand(-0.02, 0.02),
    sz: rand(6, 16), warm: Math.random() < 0.5,
  }));
  return (ctx, t) => {
    ctx.fillStyle = 'rgba(10,10,14,0.22)';
    ctx.fillRect(0, 0, w, h);
    pieces.forEach(p => {
      p.y += p.vy;
      p.x += p.vx + Math.sin(t * 0.4 + p.y * 0.02) * 0.3;
      p.rot += p.rotV;
      if (p.y > h + p.sz) { p.y = -p.sz; p.x = rand(0, w); }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const col = p.warm ? '#d97706' : '#94a3b8';
      ctx.shadowColor = col;
      ctx.shadowBlur = 8;
      ctx.fillStyle = col + 'cc';
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let v = 0; v < 4; v++) {
        const a = (TAU / 4) * v;
        const r = v % 2 === 0 ? p.sz : p.sz * 0.6;
        v === 0 ? ctx.moveTo(r * Math.cos(a), r * Math.sin(a))
                : ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    });
  };
}

// 14 — Fluid Smoke  [crimson / magenta]
function anim14(w, h) {
  const N = 90;
  const pts = Array.from({ length: N }, () => ({
    x: rand(0, w), y: rand(0, h),
    phase: rand(0, TAU), speed: rand(0.5, 1.5),
    sz: rand(3, 7),
  }));
  return (ctx, t) => {
    ctx.fillStyle = 'rgba(22,2,14,0.2)';
    ctx.fillRect(0, 0, w, h);
    pts.forEach(p => {
      const angle = Math.sin(p.x * 0.012 + t * 0.6) * Math.PI +
                    Math.cos(p.y * 0.012 + t * 0.4) * Math.PI;
      p.x += Math.cos(angle) * p.speed;
      p.y += Math.sin(angle) * p.speed;
      if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
        p.x = rand(0, w); p.y = rand(0, h);
      }
      const xn = p.x / w;
      const hue = lerp(340, 310, xn);
      const pulse = Math.sin(t * 2 + p.phase) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.sz * pulse, 0, TAU);
      ctx.fillStyle = `hsla(${hue},90%,${50 + pulse * 15}%,0.65)`;
      ctx.shadowColor = `hsl(${hue},90%,60%)`;
      ctx.shadowBlur = 8;
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  };
}

const ANIMS = [
  anim0, anim1, anim2, anim3, anim4, anim5, anim6, anim7,
  anim8, anim9, anim10, anim11, anim12, anim13, anim14,
];

const ProjectAnim = ({ index }) => {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const setSize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    setSize();

    const factory = ANIMS[index % ANIMS.length];
    let draw = factory(canvas.width, canvas.height);
    let startTime = null;

    const loop = (ts) => {
      if (!startTime) startTime = ts;
      const t = (ts - startTime) / 1000;
      draw(ctx, t);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      setSize();
      draw = factory(canvas.width, canvas.height);
    });
    ro.observe(canvas.parentElement || canvas);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [index]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', borderRadius: '1rem' }}
    />
  );
};

export default ProjectAnim;
