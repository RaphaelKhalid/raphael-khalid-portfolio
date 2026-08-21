import { Component, Suspense, lazy, useEffect, useRef, useState } from "react";

// Every demo on this page goes through here. The rule the site has to hold is
// that only what you are looking at is allowed to compute — there are already
// eighteen decorative card canvases sharing one budgeted scheduler, and these
// simulations are far heavier than a card.
//
// So: the demo component is not merely paused when off screen, it is not
// mounted at all. Its own effect cleanup tears down its rAF loop, and React
// throws away the state. Scrolling past a demo costs nothing.

const REGISTRY = {
  refusal: lazy(() => import("./RefusalMatrix")),
  pid: lazy(() => import("./PIDLab")),
  slam: lazy(() => import("./SLAMLab")),
  swarm: lazy(() => import("./SwarmLab")),
};

class Boundary extends Component {
  constructor(p) {
    super(p);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const Skeleton = ({ label }) => (
  <div className="flex items-center justify-center h-full min-h-[240px] text-fg-faint font-mono text-[11px]">
    {label}
  </div>
);

const Demo = ({ id, title, note, minHeight = 320 }) => {
  const hostRef = useRef(null);
  const [live, setLive] = useState(false);
  const [calm] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (calm) return undefined;
    const el = hostRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([e]) => setLive(e.isIntersecting),
      { rootMargin: "120px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [calm]);

  const Lab = REGISTRY[id];

  return (
    <figure ref={hostRef} className="lab panel-demo" style={{ minHeight }}>
      <figcaption className="flex items-baseline gap-3 flex-wrap px-4 py-2.5 border-b border-line-soft">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-fg-faint">
          {title}
        </span>
        {note ? (
          <span className="text-[12px] text-fg-dim">{note}</span>
        ) : null}
        <span
          className="ml-auto font-mono text-[10px]"
          style={{ color: live ? "#79C08E" : "#5B606C" }}
        >
          {live ? "running" : "idle"}
        </span>
      </figcaption>

      <div className="p-4">
        {calm ? (
          <Skeleton label="motion reduced — open the source repo to run this" />
        ) : live ? (
          <Boundary fallback={<Skeleton label="this demo failed to start" />}>
            <Suspense fallback={<Skeleton label="loading…" />}>
              <Lab />
            </Suspense>
          </Boundary>
        ) : (
          <Skeleton label="scroll into view to run" />
        )}
      </div>
    </figure>
  );
};

export default Demo;
