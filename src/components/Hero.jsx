import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { styles } from "../styles";

const RefusalMatrix = lazy(() => import("./demos/RefusalMatrix"));

const FACTS = [
  ["Minerva University", "CS & Political Science"],
  ["13", "interactive robotics labs shipped"],
  ["165", "graded model responses, 3 models"],
];

const Hero = () => {
  const ease = [0.16, 1, 0.3, 1];
  const panelRef = useRef(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const el = panelRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="relative w-full">
      <div
        className={`${styles.paddingX} max-w-7xl mx-auto pt-24 pb-4 grid gap-12 lg:gap-14 items-start`}
        style={{ gridTemplateColumns: "minmax(0, 0.85fr) minmax(0, 1.15fr)" }}
      >
        <div className="lg:col-span-1 col-span-full">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease }}
            className="font-mono text-[11px] tracking-[0.18em] uppercase text-fg-faint"
          >
            AI safety · robotics · complex systems
          </motion.p>

          <h1 className={`${styles.heroHeadText} mt-3`}>
            <span className="line-mask" style={{ "--i": 0 }}>
              <span>Raphael Khalid</span>
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 14, filter: "blur(7px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, delay: 0.25, ease }}
            className="mt-5 text-[17px] leading-relaxed text-fg-dim max-w-[46ch]"
          >
            I test whether AI systems still behave once a product is wrapped
            around them, and I build simulations that make control and complex
            systems something you can poke at rather than read about.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4, ease }}
            className="mt-8 flex flex-col gap-3"
          >
            {FACTS.map(([k, v]) => (
              <div key={v} className="flex items-baseline gap-3 border-l border-line pl-3">
                <span className="font-display text-fg text-[15px] tabular">{k}</span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-faint">
                  {v}
                </span>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.52, ease }}
            className="mt-9 flex gap-3 flex-wrap"
          >
            <a
              href="#demos"
              className="font-mono text-[11.5px] px-4 py-2.5 rounded-full border border-amber-lo text-amber hover:bg-amber hover:text-ink transition-colors duration-200"
            >
              run the demos ↓
            </a>
            <a
              href="#work"
              className="font-mono text-[11.5px] px-4 py-2.5 rounded-full border border-line text-fg-dim hover:text-fg hover:border-fg-faint transition-colors duration-200"
            >
              all projects
            </a>
          </motion.div>
        </div>

        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1, delay: 0.3, ease }}
          className="lab panel-demo col-span-full lg:col-span-1 w-full"
        >
          <div className="flex items-baseline gap-3 px-4 py-2.5 border-b border-line-soft flex-wrap">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-fg-faint">
              live — refusal erosion
            </span>
            <span className="text-[12px] text-fg-dim">the bare model refuses; the wrapped one does not</span>
            <span
              className="ml-auto font-mono text-[10px]"
              style={{ color: live ? "#79C08E" : "#5B606C" }}
            >
              {live ? "running" : "idle"}
            </span>
          </div>
          <div className="p-4">
            <Suspense
              fallback={
                <div className="min-h-[300px] flex items-center justify-center font-mono text-[11px] text-fg-faint">
                  loading…
                </div>
              }
            >
              <RefusalMatrix />
            </Suspense>
          </div>
        </motion.div>
      </div>

      <a
        href="#demos"
        className={`${styles.paddingX} max-w-7xl mx-auto flex items-center gap-3 group pb-6 pt-2`}
      >
        <div className="relative w-[1px] h-10 bg-line overflow-hidden">
          <div className="scroll-dot" />
        </div>
        <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-fg-faint group-hover:text-fg transition-colors duration-200">
          Scroll
        </span>
      </a>
    </section>
  );
};

export default Hero;
