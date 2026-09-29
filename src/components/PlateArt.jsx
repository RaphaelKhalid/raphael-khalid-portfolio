import { useMemo } from "react";

// A small engraved figure for each specimen plate: hairline ink on paper, one
// touch of a skin colour, drawn once and deterministic per project. It stands
// in for the old glowing card animations, which belonged to the dark theme.

const ACCENTS = ["#1F2F9E", "#B3135C", "#E0552F", "#2F6F63"];
const INK = "#2E2826";

function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const figures = {
  // Nested contours, like a depth sounding.
  contours(r, w, h) {
    const cx = w * (0.4 + r() * 0.2), cy = h * (0.45 + r() * 0.1);
    return Array.from({ length: 11 }, (_, i) => {
      const rad = 10 + i * 9;
      const points = Array.from({ length: 64 }, (_, k) => {
        const a = (k / 64) * Math.PI * 2;
        const wobble = 1 + 0.12 * Math.sin(a * 3 + i * 0.7) + 0.06 * Math.sin(a * 5 + i);
        return `${(cx + Math.cos(a) * rad * 1.6 * wobble).toFixed(1)},${(cy + Math.sin(a) * rad * wobble).toFixed(1)}`;
      });
      return { d: `M${points.join("L")}Z`, accent: i === 6 };
    });
  },
  // Orbits around a centre.
  orbits(r, w, h) {
    const cx = w / 2, cy = h / 2;
    return Array.from({ length: 8 }, (_, i) => {
      const rx = 20 + i * 17, ry = rx * (0.28 + r() * 0.2), rot = r() * 60 - 30;
      return { ellipse: { cx, cy, rx, ry, rot }, accent: i === 4 };
    });
  },
  // A field of flow lines.
  flow(r, w, h) {
    const phase = r() * 6;
    return Array.from({ length: 16 }, (_, i) => {
      const y0 = 12 + i * ((h - 24) / 15);
      const points = Array.from({ length: 40 }, (_, k) => {
        const x = (k / 39) * w;
        const y = y0 + 9 * Math.sin(x * 0.03 + phase + i * 0.35) * Math.sin(i * 0.4 + x * 0.008);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      return { d: `M${points.join("L")}`, accent: i === 9 };
    });
  },
  // A branching tree.
  tree(r, w, h) {
    const lines = [];
    const grow = (x, y, a, len, depth) => {
      if (depth === 0 || len < 4) return;
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      lines.push({ d: `M${x.toFixed(1)},${y.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`, accent: depth === 2 && lines.length % 5 === 0 });
      grow(x2, y2, a - 0.35 - r() * 0.3, len * 0.74, depth - 1);
      grow(x2, y2, a + 0.3 + r() * 0.3, len * 0.72, depth - 1);
    };
    grow(w / 2, h - 8, -Math.PI / 2, h * 0.3, 7);
    return lines;
  },
  // A lattice of points, some joined.
  lattice(r, w, h) {
    const items = [];
    const cols = 13, rows = 6;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = 18 + i * ((w - 36) / (cols - 1)), y = 16 + j * ((h - 32) / (rows - 1));
      items.push({ dot: { x, y, r: 1.2 + r() * 1.6 }, accent: r() > 0.94 });
      if (r() > 0.55 && i < cols - 1) items.push({ d: `M${x},${y}L${x + (w - 36) / (cols - 1)},${y}` });
      if (r() > 0.7 && j < rows - 1) items.push({ d: `M${x},${y}L${x},${y + (h - 32) / (rows - 1)}` });
    }
    return items;
  },
  // A spiral.
  spiral(r, w, h) {
    const cx = w / 2, cy = h / 2, turns = 5 + r() * 2;
    const points = Array.from({ length: 360 }, (_, k) => {
      const t = k / 359, a = t * turns * Math.PI * 2, rad = 4 + t * Math.min(w, h * 1.8) * 0.42;
      return `${(cx + Math.cos(a) * rad * 1.5).toFixed(1)},${(cy + Math.sin(a) * rad * 0.8).toFixed(1)}`;
    });
    return [{ d: `M${points.join("L")}` }, { dot: { x: cx, y: cy, r: 3 }, accent: true }];
  },
};
const ORDER = ["contours", "orbits", "flow", "tree", "lattice", "spiral"];

const PlateArt = ({ name, index = 0, height = 150 }) => {
  const width = 360;
  const { items, accent } = useMemo(() => {
    const r = seeded(name);
    const kind = ORDER[index % ORDER.length];
    return { items: figures[kind](r, width, height), accent: ACCENTS[Math.floor(r() * ACCENTS.length)] };
  }, [name, index, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" className="w-full h-full block" aria-hidden="true">
      {items.map((item, i) => {
        const stroke = item.accent ? accent : INK;
        const opacity = item.accent ? 0.95 : 0.55;
        if (item.ellipse) {
          const e = item.ellipse;
          return <ellipse key={i} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} transform={`rotate(${e.rot} ${e.cx} ${e.cy})`} fill="none" stroke={stroke} strokeOpacity={opacity} strokeWidth={item.accent ? 1.1 : 0.7} />;
        }
        if (item.dot) return <circle key={i} cx={item.dot.x} cy={item.dot.y} r={item.dot.r} fill={stroke} fillOpacity={item.accent ? 1 : 0.6} />;
        return <path key={i} d={item.d} fill="none" stroke={stroke} strokeOpacity={opacity} strokeWidth={item.accent ? 1.1 : 0.7} strokeLinecap="round" />;
      })}
    </svg>
  );
};

export default PlateArt;
