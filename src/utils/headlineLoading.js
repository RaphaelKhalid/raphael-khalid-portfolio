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
    return { finish() {}, dispose() {} };
  }
  let disposed = false, done = false, finishAt = null, locked = 0, finishFrom = 0;
  const started = performance.now(), glyphs = [];
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
  function tick() {
    if (disposed || done || document.hidden) return;
    const now = performance.now();
    locked = finishAt === null
      ? Math.min(glyphs.length - 3, Math.floor((now - started) / 180))
      : Math.min(glyphs.length, finishFrom + Math.floor((now - finishAt) / 26));
    const beat = Math.floor((now - started) / 160);
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
      clearInterval(timer);
      observer.disconnect();
      wrap.classList.remove('headline-resolving');
      overlay.replaceChildren();
    }
  }
  const timer = setInterval(tick, 80);
  tick();
  return {
    finish() { if (finishAt !== null) return; finishFrom = locked; finishAt = performance.now(); },
    dispose() {
      disposed = true;
      clearInterval(timer);
      observer.disconnect();
      overlay.replaceChildren();
      wrap.classList.remove('headline-resolving');
    },
  };
}
