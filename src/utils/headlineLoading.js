// The real heading reserves its final layout. Only this decorative layer
// changes typefaces, so loading never moves the text or the content below it.
const STYLES = [
  ['Georgia, serif', '#b85d42', 'italic', '400'],
  ['ui-monospace, monospace', '#34528a', 'normal', '400'],
  ['Arial, sans-serif', '#6d7560', 'normal', '700'],
  ['Georgia, serif', '#77547c', 'normal', '700'],
  ['cursive', '#a66b32', 'normal', '400'],
];

export function createHeadlineLoading(text, overlay) {
  const wrap = text.parentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { dispose() {} };
  }
  let disposed = false, done = false, locked = 0, elapsed = 0, last = 0, frame = 0;
  const glyphs = [];
  for (const line of text.querySelectorAll('[data-line]')) {
    [...line.textContent].forEach((letter, index) => {
      const el = document.createElement('span');
      el.className = 'headline-loading__letter';
      el.textContent = letter;
      overlay.append(el);
      glyphs.push({ el, line, index });
    });
  }
  function measure() {
    if (disposed || done) return;
    const box = text.getBoundingClientRect(), style = getComputedStyle(text);
    overlay.style.fontSize = style.fontSize;
    overlay.style.lineHeight = style.lineHeight;
    for (const { el, line, index } of glyphs) {
      const range = document.createRange();
      range.setStart(line.firstChild, index);
      range.setEnd(line.firstChild, index + 1);
      const letter = range.getBoundingClientRect(), row = line.getBoundingClientRect();
      Object.assign(el.style, {
        left: `${letter.left - box.left}px`, top: `${row.top - box.top}px`,
        width: `${letter.width}px`, height: `${row.height}px`,
      });
    }
  }
  measure();
  wrap.classList.add('headline-resolving');
  const observer = new ResizeObserver(measure);
  observer.observe(text);
  document.fonts.ready.then(measure);
  function tick(now) {
    if (disposed || done) return;
    frame = requestAnimationFrame(tick);
    if (document.hidden) { last = 0; return; }
    elapsed += last ? Math.min(40, now - last) : 0;
    last = now;
    locked = Math.min(glyphs.length, Math.floor(elapsed / 125));
    const beat = Math.floor(elapsed / 110);
    glyphs.forEach(({ el }, i) => {
      const changing = i >= locked && i < locked + 3;
      const variant = STYLES[(beat + i * 3) % STYLES.length];
      Object.assign(el.style, {
        fontFamily: changing ? variant[0] : '', color: changing ? variant[1] : '',
        fontStyle: changing ? variant[2] : '', fontWeight: changing ? variant[3] : '',
        opacity: i > locked + 2 ? '0.35' : '1',
        transform: changing ? `translateY(${(beat + i) % 3 - 1}px)` : '',
      });
    });
    if (locked === glyphs.length) {
      done = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      wrap.classList.remove('headline-resolving');
      overlay.replaceChildren();
    }
  }
  frame = requestAnimationFrame(tick);
  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      overlay.replaceChildren();
      wrap.classList.remove('headline-resolving');
    },
  };
}
