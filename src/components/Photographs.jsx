import { useEffect, useRef, useState } from "react";
import { styles } from "../styles";
import SectionHead from "./SectionHead";

// Photographs as a contact strip of mounted prints: one row you drag or scroll
// sideways through, rather than another grid to scroll down past. The images
// are served by the photography site itself, so it stays the one source.
const HOST = "https://raphael-photography.vercel.app";

const PHOTOS = [
  ["0292", "A full moon over the lit span of a bridge at blue hour."],
  ["0300", "A lone figure on a steep street at dusk."],
  ["0240", "Fireworks bursting in gold over a waterfront."],
  ["0416", "A fire truck's red lights streaking down a hill after dark."],
  ["0468", "City lights scattered across the hills at blue hour."],
  ["0407", "String lights glowing through dark foliage at night."],
  ["0446", "A weathered wooden house against a deep blue dusk sky."],
  ["0406", "Backlit autumn leaves catching a single point of light at dusk."],
  ["0475", "A stadium floodlight standing alone against the night."],
  ["0363", "A pyramid tower tapering into a clear sky."],
  ["0279", "Rail yards seen from above."],
  ["0307", "Twin church spires rising above the water."],
  ["0324", "Rows of houses climbing a hill toward the water."],
  ["0315", "A little free library box beside a weathered garden ornament."],
  ["0351", "A flock of wild parrots gathered on a bare branch."],
  ["0662", "Fog rolling low over the Pacific at day's end."],
  ["0551", "A gull banking low over open water."],
  ["0253", "A bird resting on a wire against a burning orange sunset."],
  ["0555", "Waves breaking below coastal cliffs."],
].map(([id, alt]) => ({ id, alt, src: `${HOST}/img/DSC_${id}-768.webp`, full: `${HOST}/img/DSC_${id}-1280.webp` }));

const Print = ({ photo, index, onOpen }) => (
  <figure className="shrink-0 snap-start" data-photo={index}>
    <button
      type="button"
      onClick={() => onOpen(index)}
      className="block bg-raised p-2.5 pb-3 border border-hair shadow-[0_22px_36px_-30px_rgba(46,40,38,0.55)] transition-transform duration-300 ease-out hover:-translate-y-1"
      aria-label={`Open photograph: ${photo.alt}`}
    >
      <img
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        decoding="async"
        draggable="false"
        className="block h-[260px] sm:h-[340px] w-auto min-w-[160px] bg-[#1f1b19] select-none"
      />
    </button>
    <figcaption className="mt-3 max-w-[300px] font-mono text-[10px] tracking-[0.12em] uppercase text-muted leading-relaxed">
      <span className="text-ink-text">fig. {String(index + 1).padStart(2, "0")}</span> · {photo.alt.replace(/\.$/, "")}
    </figcaption>
  </figure>
);

const Photographs = () => {
  const strip = useRef(null);
  const [open, setOpen] = useState(null);

  // Drag to pan with a mouse; touch and trackpads scroll natively.
  useEffect(() => {
    const el = strip.current;
    let drag = null;
    const down = e => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      drag = { x: e.clientX, left: el.scrollLeft, moved: false };
    };
    const move = e => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) drag.moved = true;
      el.scrollLeft = drag.left - dx;
    };
    const up = () => { if (drag?.moved) el.dataset.dragged = "1"; drag = null; setTimeout(() => delete el.dataset.dragged, 0); };
    const click = e => { if (el.dataset.dragged) { e.preventDefault(); e.stopPropagation(); } };
    el.addEventListener("pointerdown", down);
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    el.addEventListener("click", click, true);
    return () => {
      el.removeEventListener("pointerdown", down);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      el.removeEventListener("click", click, true);
    };
  }, []);

  useEffect(() => {
    if (open === null) return undefined;
    document.documentElement.classList.add("print-open");
    const key = e => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen(i => (i + 1) % PHOTOS.length);
      if (e.key === "ArrowLeft") setOpen(i => (i + PHOTOS.length - 1) % PHOTOS.length);
    };
    addEventListener("keydown", key);
    return () => { removeEventListener("keydown", key); document.documentElement.classList.remove("print-open"); };
  }, [open]);

  const nudge = dir => strip.current.scrollBy({ left: dir * strip.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="relative w-full">
      <span className="hash-span" id="photographs">&nbsp;</span>
      <div className={`${styles.paddingX} max-w-[1440px] mx-auto pt-6 pb-10`}>
        <SectionHead index="04" label="photographs" title="After hours" aside={
          <a href={HOST} target="_blank" rel="noreferrer" className="font-mono text-[11px] tracking-[0.16em] uppercase text-muted hover:text-coral transition-colors">full portfolio ↗</a>
        }>
          Night and low light, and the in-between minutes either side of it. Drag the strip, or open a print.
        </SectionHead>
        <div className="flex justify-end gap-5 -mt-4 mb-4">
          <button type="button" onClick={() => nudge(-1)} className="font-mono text-[11px] tracking-[0.16em] uppercase text-muted hover:text-ink-text" aria-label="Previous photographs">← back</button>
          <button type="button" onClick={() => nudge(1)} className="font-mono text-[11px] tracking-[0.16em] uppercase text-muted hover:text-ink-text" aria-label="More photographs">more →</button>
        </div>
      </div>
      <div
        ref={strip}
        id="photo-strip"
        className="flex gap-7 overflow-x-auto snap-x snap-proximity pb-10 cursor-grab active:cursor-grabbing"
        style={{ paddingInline: "max(20px, calc((100vw - 1440px) / 2 + 64px))", scrollPaddingInline: "max(20px, calc((100vw - 1440px) / 2 + 64px))" }}
      >
        {PHOTOS.map((photo, i) => <Print key={photo.id} photo={photo} index={i} onOpen={setOpen} />)}
      </div>

      {open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={PHOTOS[open].alt}
          className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-4 p-5 sm:p-10"
          style={{ background: "rgba(31,27,25,0.94)" }}
          onClick={() => setOpen(null)}
        >
          <img src={PHOTOS[open].full} alt={PHOTOS[open].alt} className="max-h-[82vh] max-w-full object-contain shadow-2xl" onClick={e => e.stopPropagation()} />
          <p className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#d9cfc2] text-center">
            fig. {String(open + 1).padStart(2, "0")} · {PHOTOS[open].alt.replace(/\.$/, "")} <span className="text-[#86796f]">· ← → · esc</span>
          </p>
        </div>
      )}
    </section>
  );
};

export default Photographs;
