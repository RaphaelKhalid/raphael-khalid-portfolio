import { Component, Suspense, lazy, useEffect, useRef, useState } from "react";

// Only what you are looking at is allowed to compute. A demo is not merely
// paused when it is not selected — it is not mounted, so its effect cleanup
// tears down its rAF loop and React discards the state. With one pane and a
// sidebar, that means exactly one simulation is ever running.

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

const Note = ({ children }) => (
  <div className="flex items-center justify-center h-full min-h-[240px] text-fg-faint font-mono text-[11px] text-center px-6">
    {children}
  </div>
);

// An embedded site can refuse to be framed, and a cross-origin frame will not
// tell us that it did. So the escape hatch is always present in the header
// rather than something we try to detect and swap in.
const Embed = ({ src, title }) => (
  <iframe
    src={src}
    title={title}
    loading="lazy"
    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
    className="w-full h-full block rounded-lg border border-line-soft bg-[#0b0d12]"
  />
);

const Demo = ({ id, src, title, height = 560 }) => {
  const hostRef = useRef(null);
  const [near, setNear] = useState(false);
  const [calm] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (calm) return undefined;
    const el = hostRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), {
      rootMargin: "200px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [calm]);

  const Lab = id ? REGISTRY[id] : null;

  return (
    <div ref={hostRef} className="lab w-full" style={{ height }}>
      {calm ? (
        <Note>motion reduced — open the source for the live version</Note>
      ) : !near ? (
        <Note>scroll into view to run</Note>
      ) : src ? (
        <Embed src={src} title={title} />
      ) : (
        <Boundary fallback={<Note>this demo failed to start</Note>}>
          <Suspense fallback={<Note>loading…</Note>}>
            <div className="h-full overflow-y-auto pr-1">
              <Lab />
            </div>
          </Suspense>
        </Boundary>
      )}
    </div>
  );
};

export default Demo;
