import { motion, useScroll, useTransform } from "framer-motion";
import { styles } from "../styles";

const STRANDS = [
  { k: "safety", v: "evaluating the deployment layer" },
  { k: "control", v: "robot estimation and control" },
  { k: "complexity", v: "power, cities, collective behaviour" },
];

const Hero = () => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, -70]);
  const ease = [0.16, 1, 0.3, 1];

  return (
    <section className="relative w-full min-h-screen mx-auto overflow-hidden">
      <motion.div
        style={{ y, zIndex: 2 }}
        className={`${styles.paddingX} relative max-w-7xl mx-auto flex flex-col justify-center min-h-screen pt-24 pb-20`}
      >
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.05, ease }}
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-fg-faint"
        >
          Raphael Khalid
        </motion.p>

        <h1 className={`${styles.heroHeadText} mt-5 max-w-[min(100%,920px)]`}>
          <span className="line-mask" style={{ "--i": 0 }}>
            <span>I measure the systems</span>
          </span>
          <span className="line-mask" style={{ "--i": 1 }}>
            <span>that behave differently</span>
          </span>
          <span className="line-mask" style={{ "--i": 2 }}>
            <span>
              than their <span className="text-amber">parts predict.</span>
            </span>
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16, filter: "blur(7px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, delay: 0.42, ease }}
          className={`${styles.heroSubText} mt-7 max-w-[58ch]`}
        >
          Wrappers that void a model&apos;s safety training. Controllers that hold a
          robot up. Power transitions that show up in a phase space before they
          show up in the news. Below: the ones you can run.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.56, ease }}
          className="mt-10 flex flex-wrap gap-x-6 gap-y-4"
        >
          {STRANDS.map(({ k, v }) => (
            <div key={k} className="border-l border-line pl-3">
              <div className="font-display text-[14px] text-fg">{k}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-fg-faint mt-1">
                {v}
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      <a
        href="#work"
        className="absolute bottom-10 left-6 sm:left-16 flex items-center gap-3 group"
        style={{ zIndex: 3 }}
      >
        <div className="relative w-[1px] h-12 bg-line overflow-hidden">
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
