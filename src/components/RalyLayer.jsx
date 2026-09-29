import { useEffect, useRef } from "react";
import { setRaly, ralyScreen } from "../raly/store";
import { createTour } from "../raly/tour";

// raly's layer: a fixed, transparent canvas across the whole viewport, behind
// the page's text. raly follows the mouse. The canvas never takes pointer
// events; clicks are hit-tested against raly's body instead, so the page
// underneath stays fully usable.
//
// It is also the site's guide: on a first visit, if the visitor lets the hero
// sit for a few seconds (or arrives with ?tour, or presses "tour"), raly leads
// them through the sections. Any real scroll, key, click or touch ends it.

const INTERACTIVE = "a, button, input, textarea, select, label, iframe, summary, [role='button'], [data-no-raly]";

const RalyLayer = () => {
  const canvasRef = useRef(null);
  const captionRef = useRef(null);
  const captionTextRef = useRef(null);
  const markRef = useRef(null);
  const labelRef = useRef(null);
  const tapRef = useRef(null);

  useEffect(() => {
    let engine = null, frame = 0, disposed = false, pressed = null, hoverQueued = false, lastPointer = null;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const quality = matchMedia("(pointer: coarse)").matches || innerWidth < 900 ? "medium" : "high";
    const caption = captionRef.current;
    const smooth = { x: 0, y: 0, ready: false };
    const captionText = captionTextRef.current;
    const tour = createTour({
      getEngine: () => engine,
      mark: markRef.current,
      label: labelRef.current,
      tapRing: tapRef.current,
      onChange: ({ active }) => { captionText.textContent = active ? "guiding · esc to stop" : "click to interact"; },
    });
    let autoTimer = 0;
    const startTour = () => { clearTimeout(autoTimer); if (engine && !reduced) tour.start(); };

    function follow() {
      frame = requestAnimationFrame(follow);
      if (!engine) return;
      tour.frame();
      // Its floor: the contact section's sunlit floor when on screen.
      const floor = document.getElementById("sunlit-floor");
      if (floor) {
        const r = floor.getBoundingClientRect();
        const line = r.top + Math.min(r.height * 0.42, 160);
        engine.setFloor(line < innerHeight - 6 ? Math.max(line, innerHeight * 0.45) : null);
      }
      // In the hero it keeps right, clear of the headline.
      const hero = document.getElementById("top");
      if (hero) engine.setHeroBias(Math.min(1, Math.max(0, hero.getBoundingClientRect().bottom / innerHeight - 0.35) / 0.5));
      // The caption trails raly's leading edge.
      if (!ralyScreen.visible) { caption.style.opacity = "0"; return; }
      // Just above its outline, toward whichever end leads.
      const tx = Math.min(ralyScreen.right - 170, Math.max(ralyScreen.left, ralyScreen.headX - 40)), ty = ralyScreen.top - 26;
      if (!smooth.ready) { smooth.x = tx; smooth.y = ty; smooth.ready = true; }
      smooth.x += (tx - smooth.x) * 0.08; smooth.y += (ty - smooth.y) * 0.08;
      const x = Math.min(document.documentElement.clientWidth - caption.offsetWidth - 12, Math.max(12, smooth.x)), y = Math.min(innerHeight - 30, Math.max(76, smooth.y));
      caption.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      caption.style.opacity = "1";
    }

    import("../raly/engine").then(({ createRaly }) => {
      if (disposed) return;
      try {
        engine = createRaly(canvasRef.current, { reducedMotion: reduced, quality });
      } catch (error) {
        console.warn("raly could not start here", error);
        return;
      }
      setRaly(engine);
      engine.start();
      window.raly = engine;
      frame = requestAnimationFrame(follow);
      // A first visit that lets the hero sit gets the tour; ?tour asks for it.
      let toured = false;
      try { toured = localStorage.getItem("raly-toured") === "1"; } catch { /* no storage */ }
      const asked = new URLSearchParams(location.search).has("tour");
      if (!reduced && (asked || !toured)) {
        autoTimer = setTimeout(() => { if (asked || scrollY < 60) startTour(); }, asked ? 2200 : 8000);
      }
    });

    const isInteractive = target => target instanceof Element && target.closest(INTERACTIVE);
    // Real input hands the page back: it ends the tour, or cancels one waiting to start.
    const interrupt = event => {
      if (!event.isTrusted) return;
      clearTimeout(autoTimer);
      if (tour.active) tour.stop();
    };
    const onDown = event => { interrupt(event); pressed = { x: event.clientX, y: event.clientY }; };
    const onUp = event => {
      if (!engine || !pressed) return;
      const moved = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
      pressed = null;
      if (moved > 8 || isInteractive(event.target)) return;
      if (engine.touch(event.clientX, event.clientY)) caption.dataset.touched = "true";
    };
    const onMove = event => {
      lastPointer = event;
      // raly follows the mouse (unless it is guiding); touch is left alone so the page can scroll.
      if (engine && event.pointerType !== "touch" && !tour.active) engine.setPointer(event.clientX, event.clientY);
      if (hoverQueued || event.pointerType === "touch") return;
      hoverQueued = true;
      requestAnimationFrame(() => {
        hoverQueued = false;
        if (!engine || !lastPointer) return;
        const over = !isInteractive(lastPointer.target) && engine.hover(lastPointer.clientX, lastPointer.clientY);
        document.documentElement.classList.toggle("over-raly", over);
      });
    };
    addEventListener("pointerdown", onDown, { passive: true });
    addEventListener("pointerup", onUp, { passive: true });
    addEventListener("pointermove", onMove, { passive: true });
    const onLeave = () => { if (!tour.active) engine?.setPointer(null); };
    document.addEventListener("pointerleave", onLeave);
    const onTourRequest = () => { if (tour.active) tour.stop(); else startTour(); };
    addEventListener("raly:tour", onTourRequest);
    for (const type of ["wheel", "touchstart", "keydown"]) addEventListener(type, interrupt, { passive: true });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      removeEventListener("pointerdown", onDown);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      removeEventListener("raly:tour", onTourRequest);
      for (const type of ["wheel", "touchstart", "keydown"]) removeEventListener(type, interrupt);
      clearTimeout(autoTimer);
      tour.stop();
      engine?.dispose();
      setRaly(null);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="raly-canvas" aria-hidden="true" />
      <p ref={captionRef} className="raly-caption" aria-hidden="true">
        <span className="normal-case">raly</span> · <span ref={captionTextRef}>click to interact</span>
      </p>
      {/* The guide's mark: a hairline drawn around what raly is showing, with a caption. */}
      <div ref={markRef} className="raly-mark" aria-live="polite">
        <svg aria-hidden="true"><rect x="1" y="1" rx="7" pathLength="1" /></svg>
        <p className="raly-mark-label"><span className="normal-case text-coral">raly</span> · <span ref={labelRef} /></p>
      </div>
      <span ref={tapRef} className="raly-tap" aria-hidden="true" />
    </>
  );
};

export default RalyLayer;
