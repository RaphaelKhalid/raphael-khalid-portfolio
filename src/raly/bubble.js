// raly's speech bubble, drawn like a doodle in a diary: a wobbly double
// outline with a little tail and two sparkles. The outline "boils" (it is
// redrawn slightly differently several times a second, like hand-drawn
// animation frames) and the words scribble in one letter at a time, each a
// little crooked, jittering with the same boil.

const SVG = 'http://www.w3.org/2000/svg';
const BOIL_MS = 125;

// A small seeded random, so each boil frame is a stable variation.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Points around a rounded rectangle with a tail at the bottom left, each
// nudged a little, joined with a smooth closed curve.
function wobblyBubble(w, h, seed, { amp = 1.6, grow = 0, flip = false } = {}) {
  const r = Math.min(18, h * 0.42), rand = rng(seed);
  const x0 = -grow, y0 = -grow, x1 = w + grow, y1 = h + grow;
  const tailX = Math.min(64, w * 0.28);
  const pts = [];
  const add = (x, y) => pts.push([x + (rand() - 0.5) * 2 * amp, y + (rand() - 0.5) * 2 * amp]);
  const arc = (cx, cy, a0, a1) => { for (let i = 0; i <= 3; i++) { const a = a0 + (a1 - a0) * i / 3; add(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } };
  const edge = (xa, ya, xb, yb, n) => { for (let i = 1; i < n; i++) add(xa + (xb - xa) * i / n, ya + (yb - ya) * i / n); };
  arc(x0 + r, y0 + r, Math.PI, Math.PI * 1.5);
  edge(x0 + r, y0, x1 - r, y0, Math.max(2, Math.round(w / 60)));
  arc(x1 - r, y0 + r, Math.PI * 1.5, Math.PI * 2);
  edge(x1, y0 + r, x1, y1 - r, 2);
  arc(x1 - r, y1 - r, 0, Math.PI * 0.5);
  edge(x1 - r, y1, x0 + tailX + 16, y1, Math.max(2, Math.round(w / 70)));
  // The tail: out, down toward raly, and back.
  add(x0 + tailX + 16, y1);
  pts.push([x0 + tailX - 6 + (rand() - 0.5) * 2, y1 + 17 + (rand() - 0.5) * 2]);
  add(x0 + tailX - 2, y1);
  edge(x0 + tailX - 2, y1, x0 + r, y1, 2);
  arc(x0 + r, y1 - r, Math.PI * 0.5, Math.PI);
  edge(x0, y1 - r, x0, y0 + r, 2);
  // Tail up instead: the same bubble, mirrored top to bottom.
  if (flip) for (const p of pts) p[1] = h - p[1];
  // Catmull-Rom through the points, as cubic Béziers.
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length], p1 = pts[i], p2 = pts[(i + 1) % pts.length], p3 = pts[(i + 2) % pts.length];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

// A four-pointed sparkle centred at x, y.
function sparkle(x, y, s) {
  const k = s * 0.22;
  return `M${x},${y - s}Q${x + k},${y - k} ${x + s},${y}Q${x + k},${y + k} ${x},${y + s}Q${x - k},${y + k} ${x - s},${y}Q${x - k},${y - k} ${x},${y - s}Z`;
}

export function createBubble(root) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'raly-says-frame');
  svg.setAttribute('aria-hidden', 'true');
  const fill = document.createElementNS(SVG, 'path'); fill.setAttribute('class', 'raly-says-fill');
  const lineA = document.createElementNS(SVG, 'path'); lineA.setAttribute('class', 'raly-says-line');
  const lineB = document.createElementNS(SVG, 'path'); lineB.setAttribute('class', 'raly-says-line raly-says-line-2');
  const sparks = document.createElementNS(SVG, 'path'); sparks.setAttribute('class', 'raly-says-spark');
  svg.append(fill, lineA, lineB, sparks);
  const text = document.createElement('span');
  text.className = 'raly-says-text';
  root.replaceChildren(svg, text);
  root.inert = true;

  let chars = [], size = [0, 0], boilFrame = -1, shownAt = 0, visible = false, flip = false;

  function drawFrame(frame) {
    const [w, h] = size;
    const seed = 1 + (frame % 4) * 977;
    fill.setAttribute('d', wobblyBubble(w, h, seed, { amp: 1.2, flip }));
    lineA.setAttribute('d', wobblyBubble(w, h, seed + 11, { amp: 1.6, flip }));
    lineB.setAttribute('d', wobblyBubble(w, h, seed + 53, { amp: 2.1, grow: 2.5, flip }));
    const twinkle = 0.8 + 0.25 * Math.sin(frame * 1.7);
    sparks.setAttribute('d', sparkle(w + 20, 2, 7 * twinkle) + sparkle(w + 11, 17, 4.2 * (1.9 - twinkle)));
    // Letters jitter with the same boil.
    const r = rng(seed + 7);
    for (const c of chars) c.el.style.transform = `translate(${((r() - 0.5) * 0.9).toFixed(2)}px, ${(c.dy + (r() - 0.5) * 0.9).toFixed(2)}px) rotate(${(c.rot + (r() - 0.5) * 1.5).toFixed(2)}deg)`;
  }

  return {
    get visible() { return visible; },
    /** Show a message; `tail` is 'down' (bubble above its subject) or 'up'. */
    say(message, { tail = 'down', links = {} } = {}) {
      flip = tail === 'up';
      root.style.transformOrigin = flip ? '22% -15%' : '';
      text.textContent = '';
      chars = [];
      // Letters are grouped by word so lines only wrap between words.
      message.split(' ').forEach((word, w) => {
        if (w) text.append(' ');
        const href = links[word];
        const group = document.createElement(href ? 'a' : 'span');
        group.className = 'raly-says-word';
        if (href) {
          group.classList.add('raly-says-link');
          group.href = href;
          group.target = '_blank';
          group.rel = 'noopener noreferrer';
          group.setAttribute('aria-label', word);
        }
        for (const ch of word) {
          const el = document.createElement('span');
          el.textContent = ch;
          el.className = 'raly-says-char';
          group.append(el);
          chars.push({ el, rot: (Math.random() - 0.5) * 7, dy: (Math.random() - 0.5) * 2.2 });
        }
        text.append(group);
      });
      size = [root.offsetWidth, root.offsetHeight];
      svg.setAttribute('width', size[0] + 40); svg.setAttribute('height', size[1] + 30);
      svg.setAttribute('viewBox', `-8 -8 ${size[0] + 40} ${size[1] + 30}`);
      boilFrame = -1; shownAt = performance.now(); visible = true;
      root.inert = false;
      root.classList.remove('on'); void root.offsetWidth; root.classList.add('on');
    },
    hide() { visible = false; root.inert = true; root.classList.remove('on'); },
    /** Call every animation frame while visible. */
    frame(now) {
      if (!visible) return;
      const frame = Math.floor(now / BOIL_MS);
      // Scribble the words in, a letter every 32 ms.
      const reveal = Math.floor((now - shownAt - 140) / 32);
      chars.forEach((c, i) => c.el.classList.toggle('in', i <= reveal));
      if (frame !== boilFrame) { boilFrame = frame; drawFrame(frame); }
    },
  };
}
