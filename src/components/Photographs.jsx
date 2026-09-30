import { useEffect, useRef, useState } from "react";
import { styles } from "../styles";
import SectionHead from "./SectionHead";

// Photographs as a contact strip of mounted prints: one row you drag or scroll
// sideways through, rather than another grid to scroll down past. The images
// are served by the photography site itself, so it stays the one source.
const HOST = "https://raphael-photography.vercel.app";

// Each photo: its file, Raphael's own caption (shown under the print), and a
// description for screen readers.
const PHOTOS = [
  ["0292", "Bay Bridge from Ina Coolbrith Park", "A full moon over the lit span of the Bay Bridge at blue hour."],
  ["0300", "View Looking Down California Street", "A motorcyclist riding up the cable car tracks of California Street, traffic stretching down the hill behind."],
  ["0240", "Fireworks Over UPenn", "Fireworks bursting in pale gold against the night sky."],
  ["0416", "Firetruck somewhere in SF", "A fire truck's red lights streaking down a San Francisco hill after dark."],
  ["0468", "Corona heights or Tank hill I forgot", "A rocky peak silhouetted against a deep blue night sky above scattered city lights."],
  ["0407", "Bush", "A dense bush of autumn leaves with a single warm light glowing through it at dusk."],
  ["0446", "I liked the sharp angles in this one", "The sharp, angled rooflines of a wooden house against a clear blue evening sky."],
  ["0406", "Same bush from before but zoomed in", "A close-up of the same bush, its dark leaves lit by a single point of light."],
  ["0475", "This evoked a feeling of deep loneliness when I came across it in the middle of the night", "A lone floodlight glowing in the dark above black trees."],
  ["0363", "Caught this tiny plane right as it emerged from behind the Transamerica Pyramid", "A small plane emerging from behind the Transamerica Pyramid against a blue sky."],
  ["0307", "Caught the ferry", "Twin white church spires in front of the bay as a ferry crosses behind them."],
  ["0324", "Secret garden behind Ina Coolbrith Park", "Rows of houses and gardens climbing a hill toward the water."],
  ["0315", "Free little library", "A little free library box beside a weathered garden ornament."],
  ["0351", "Parrots of Nob Hill", "A flock of wild parrots gathered on a bare branch."],
  ["0662", "Rainbow cloud", "A small rainbow-tinted cloud above the ocean at sunset, a few people on the beach below."],
  ["0551", "Bird", "A gull flying low over blue water, hills behind it."],
  ["0253", "Plane leaving JFK", "A plane climbing across a burning orange sunset, past power lines and silhouetted trees."],
  ["0555", "Surf fishing at high tide on Baker Beach", "Waves breaking below coastal cliffs at high tide."],
].map(([id, caption, alt]) => ({ id, caption, alt, src: `${HOST}/img/DSC_${id}-768.webp`, full: `${HOST}/img/DSC_${id}-1280.webp` }));

const Print = ({ photo, index, onOpen }) => (
  <figure className="shrink-0 snap-start" data-photo={index}>
    <button
      type="button"
      onClick={() => onOpen(index)}
      className="block bg-raised p-2.5 pb-3 border border-hair shadow-[0_22px_36px_-30px_rgba(46,40,38,0.55)] transition-transform duration-300 ease-out hover:-translate-y-1"
      aria-label={`Open photograph: ${photo.caption}`}
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
    <figcaption className="mt-3 max-w-[300px] text-[13px] leading-snug text-fg-dim">
      <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-text mr-2">fig. {String(index + 1).padStart(2, "0")}</span>
      {photo.caption}
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
        <SectionHead index="04" label="photographs" title="Photography" aside={
          <a href={HOST} target="_blank" rel="noreferrer" className="font-mono text-[11px] tracking-[0.16em] uppercase text-muted hover:text-coral transition-colors">full portfolio ↗</a>
        } />
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
          <p className="text-[14px] text-[#e6dccf] text-center max-w-[70ch]">
            <span className="font-mono text-[10.5px] tracking-[0.14em] uppercase mr-2">fig. {String(open + 1).padStart(2, "0")}</span>
            {PHOTOS[open].caption}
            <span className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#86796f] ml-2">← → · esc</span>
          </p>
        </div>
      )}
    </section>
  );
};

export default Photographs;
