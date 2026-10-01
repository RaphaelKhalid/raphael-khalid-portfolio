import { useEffect, useRef } from "react";
import { setRaly, ralyScreen } from "../raly/store";
import { createTour } from "../raly/tour";
import { createBubble } from "../raly/bubble";

// raly's layer: a fixed, transparent canvas across the whole viewport, behind
// the page's text. raly follows the mouse. The canvas never takes pointer
// events; clicks are hit-tested against raly's body instead, so the page
// underneath stays fully usable.
//
// It is also the site's guide: on a first visit, if the visitor lets the hero
// sit for a few seconds (or arrives with ?tour, or presses "tour"), raly leads
// them through the sections. Any real scroll, key, click or touch ends it.
//
// Click raly and it changes into its next design and says something, a line
// at a time, in a doodled bubble; click again quickly and it protests. Press
// and drag to pick it up and carry it anywhere, with a mouse or a finger.

const LINES = [
  "i'm raly",
  "i'm ticklish",
  "i change colors",
  "look at my dots",
  "what do you think i was inspired by?",
  "click on 'listen' top-right to have me react to your mic, make me boogie!",
  "what makes you happy?",
  "i wish game of thrones had a better ending",
  "the best book I read recently was The Karma of Brown Folk by Vijay Prashad",
  "i once walked 50km around sf",
  "pink floyd is my favourite band, dark side of the moon my favourite album",
  "long hair, don't care",
  "work work work",
  "sleepy time *yawn*",
  "my total level in runescape is 2,496",
  "are gas prices stable yet",
];
const TICKLED = "i'm ticklish, stop!";
const CARRIED = ["wheee!", "where are we going?", "carry me with you", "ooh, a ride"];

const INTERACTIVE = "a, button, input, textarea, select, label, iframe, summary, [role='button'], [data-no-raly]";

const RalyLayer = () => {
  const canvasRef = useRef(null);
  const formationRef = useRef(null);
  const saysRef = useRef(null);
  const markRef = useRef(null);
  const tourSaysRef = useRef(null);
  const tapRef = useRef(null);

  useEffect(() => {
    let engine = null, frame = 0, disposed = false, pressed = null, hoverQueued = false, lastPointer = null;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const quality = matchMedia("(pointer: coarse)").matches || innerWidth < 900 ? "medium" : "high";
    const bubbleEl = saysRef.current;
    const bubble = createBubble(bubbleEl);
    const smooth = { x: 0, y: 0, ready: false };
    const tour = createTour({
      getEngine: () => engine,
      mark: markRef.current,
      bubble: createBubble(tourSaysRef.current),
      bubbleEl: tourSaysRef.current,
      tapRing: tapRef.current,
    });
    let autoTimer = 0, line = 0, lastHit = -1e9, sayUntil = 0;
    function say(text) {
      bubble.say(text);
      sayUntil = performance.now() + 2600 + text.length * 55;
      smooth.ready = false;
    }
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
      // What it says floats just above its head while it swims.
      if (!sayUntil) return;
      const now = performance.now();
      if (now > sayUntil || !ralyScreen.visible) { bubble.hide(); sayUntil = 0; return; }
      bubble.frame(now);
      // The tail sits over raly's head.
      const w = bubbleEl.offsetWidth, h = bubbleEl.offsetHeight;
      const tx = ralyScreen.headX - Math.min(64, w * 0.28), ty = ralyScreen.top - h - 30;
      if (!smooth.ready) { smooth.x = tx; smooth.y = ty; smooth.ready = true; }
      smooth.x += (tx - smooth.x) * 0.12; smooth.y += (ty - smooth.y) * 0.12;
      const x = Math.min(document.documentElement.clientWidth - w - 36, Math.max(12, smooth.x)), y = Math.min(innerHeight - h - 30, Math.max(80, smooth.y));
      bubbleEl.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }

    import("../raly/client").then(async ({ createRalyClient }) => {
      if (disposed) return;
      try {
        engine = await createRalyClient(canvasRef.current, formationRef.current, { reducedMotion: reduced, quality, onReady: () => {
          if (disposed || interrupted) return;
          // Give the visitor time with the completed organism before its tour.
          let toured = false;
          try { toured = localStorage.getItem("raly-toured") === "1"; } catch { /* no storage */ }
          const asked = new URLSearchParams(location.search).has("tour");
          if (!reduced && (asked || !toured)) {
            autoTimer = setTimeout(() => { if (asked || scrollY < 60) startTour(); }, asked ? 2200 : 8000);
          }
        } });
      } catch (error) {
        console.warn("raly could not start here", error);
        return;
      }
      if (disposed) { engine.dispose(); return; }
      setRaly(engine);
      engine.start();
      window.raly = engine;
      frame = requestAnimationFrame(follow);
    }).catch(error => { if (!disposed) console.warn("raly could not load", error); });

    const isInteractive = target => target instanceof Element && target.closest(INTERACTIVE);
    let interrupted = false;
    // Real input hands the page back: it ends the tour, or cancels one waiting to start.
    const interrupt = event => {
      if (!event.isTrusted) return;
      interrupted = true;
      const tourLink = event.target instanceof Element && event.target.closest('.raly-says-tour.on a');
      // Keep native link activation and Tab navigation available during the tour.
      if (tour.active && (
        (tourLink && ['pointerdown', 'touchstart'].includes(event.type)) ||
        (event.type === 'keydown' && (
          (tourLink && event.key === 'Enter') ||
          (event.key === 'Tab' && tourSaysRef.current.querySelector('a'))
        ))
      )) return;
      clearTimeout(autoTimer);
      if (tour.active) tour.stop();
    };
    const onRaly = (x, y, target) => Boolean(engine) && !isInteractive(target) && engine.hover(x, y);
    const onDown = event => {
      interrupt(event);
      const on = onRaly(event.clientX, event.clientY, event.target);
      pressed = { x: event.clientX, y: event.clientY, on, dragging: false };
      // Pressing raly: no text selection starts under it.
      if (on && event.pointerType === "mouse") event.preventDefault();
    };
    const endDrag = () => {
      engine?.release();
      document.documentElement.classList.remove("dragging-raly");
    };
    const onUp = event => {
      if (!engine || !pressed) return;
      const { on, dragging, x, y } = pressed;
      pressed = null;
      if (dragging) {
        endDrag();
        if (event.pointerType !== "touch") engine.setPointer(event.clientX, event.clientY);
        return;
      }
      // A press that stayed put is a click on raly.
      if (!on || Math.hypot(event.clientX - x, event.clientY - y) > 8) return;
      if (!engine.touch(event.clientX, event.clientY)) return;
      // A second poke in quick succession tickles.
      const now = performance.now(), quick = now - lastHit < 900;
      lastHit = now;
      say(quick ? TICKLED : LINES[line++ % LINES.length]);
    };
    const onCancel = () => { if (pressed?.dragging) endDrag(); pressed = null; };
    const onMove = event => {
      lastPointer = event;
      // Pressed on raly and moved: pick it up and carry it.
      if (pressed?.on && engine) {
        if (!pressed.dragging && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 6) {
          pressed.dragging = engine.grab(pressed.x, pressed.y);
          if (pressed.dragging) {
            document.documentElement.classList.add("dragging-raly");
            if (!sayUntil) say(CARRIED[Math.floor(Math.random() * CARRIED.length)]);
          }
        }
        if (pressed.dragging) { engine.drag(event.clientX, event.clientY); return; }
      }
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
    addEventListener("pointerdown", onDown);
    addEventListener("pointerup", onUp, { passive: true });
    addEventListener("pointercancel", onCancel, { passive: true });
    addEventListener("pointermove", onMove, { passive: true });
    // A finger on raly holds the page still so it can be dragged; anywhere
    // else, touch scrolls as usual.
    const onTouchStart = event => {
      const t = event.touches[0];
      if (event.touches.length === 1 && onRaly(t.clientX, t.clientY, event.target)) event.preventDefault();
    };
    addEventListener("touchstart", onTouchStart, { passive: false });
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
      removeEventListener("pointercancel", onCancel);
      removeEventListener("touchstart", onTouchStart);
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
      <div ref={canvasRef} className="raly-layer" aria-hidden="true">
        <div ref={formationRef} className="raly-formation">
          <svg viewBox="0 0 600 300" fill="none">
            {[-1, -0.65, -0.3, 0, 0.3, 0.65, 1].map((side, i) => (
              <path key={side} pathLength="1" style={{ '--line': i }}
                d={`M40,150 C120,${150 + side * 130} 210,${150 + side * 100} 310,${150 + side * 40} S460,${150 + side * 75} 550,150`} />
            ))}
          </svg>
        </div>
        <span className="raly-formation-note">a little life, taking shape</span>
      </div>
      {/* What raly says when it is clicked. */}
      <div ref={saysRef} className="raly-says" aria-live="polite" />
      {/* The guide's mark: a hairline drawn around what raly is showing, with a caption. */}
      <div ref={markRef} className="raly-mark" aria-hidden="true">
        <svg><rect x="1" y="1" rx="7" pathLength="1" /></svg>
      </div>
      {/* The tour's captions, in the same doodled bubble, bigger. */}
      <div ref={tourSaysRef} className="raly-says raly-says-tour" aria-live="polite" />
      <span ref={tapRef} className="raly-tap" aria-hidden="true" />
    </>
  );
};

export default RalyLayer;
