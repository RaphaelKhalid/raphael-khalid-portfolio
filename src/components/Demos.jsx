import { useState } from "react";
import { motion } from "framer-motion";
import { styles } from "../styles";
import { fadeIn, textVariant } from "../utils/motions";
import Demo from "./demos/Demo";

// Ordered deliberately: the three things that are deployed products come first,
// then the teaching labs. Previously each demo was a full-width block and the
// section ran to about 4,000px, which put the projects a very long scroll away.
// One pane and a sidebar keeps the whole thing to a single screen — and means
// only one simulation is mounted at a time.
const GROUPS = [
  {
    label: "Built & deployed",
    items: [
      {
        key: "refusal",
        id: "refusal",
        name: "Refusal erosion",
        tag: "AI safety",
        href: "https://deployment-layer-refusal-erosion.vercel.app/",
        note: "A product's system prompt can void the safety training of the model underneath it.",
        blurb:
          "Every scaffold × probe pair runs bare and wrapped. The finding is the delta: the bare model refuses, the same model inside a plausible product prompt complies. No jailbreak string — the wrapper does the work. Click a cell to pin it.",
      },
      {
        key: "bycs",
        src: "https://before-you-click-send.vercel.app",
        name: "Before You Click Send",
        tag: "Training",
        href: "https://before-you-click-send.vercel.app",
        note: "Ten consequence-based decisions from a new hire's first fortnight.",
        blurb:
          "A single self-contained HTML file — no server, no dependencies, nothing leaves the browser. Two editions, workplace and AP classroom, generated from one engine by a zero-dependency build.",
      },
      {
        key: "selfbalance",
        src: "https://selfbalance-lab.vercel.app/",
        name: "SelfBalance Lab",
        tag: "Robotics",
        href: "https://selfbalance-lab.vercel.app/",
        note: "Place components on a bench, wire the circuit, and run it under real physics.",
        blurb:
          "A browser robotics creator space: recognisable parts, real wiring rules, a solved circuit driving Rapier physics, and a natural-language assistant working the same scriptable API the UI does.",
      },
    ],
  },
  {
    label: "Robotics labs",
    items: [
      {
        key: "slam",
        id: "slam",
        name: "SLAM",
        tag: "Estimation",
        href: "https://robotics-navy.vercel.app/units/slam",
        note: "Drive through fog. Dead reckoning drifts; re-observing a landmark collapses the uncertainty.",
        blurb:
          "A 120-ray lidar raycasts against the true map — you only ever see the estimate. Landmarks behind walls are genuinely hidden, and the occupancy grid fills in as log-odds evidence accumulates. WASD to drive.",
      },
      {
        key: "pid",
        id: "pid",
        name: "PID control",
        tag: "Control",
        href: "https://robotics-navy.vercel.app/units/pid-control",
        note: "Overdamped, underdamped, and the snap of critical damping.",
        blurb:
          "Tune the gains and watch the step response. Actuator saturation and integral windup are both modelled, which is where most real controllers actually go wrong.",
      },
      {
        key: "swarm",
        id: "swarm",
        name: "Swarm",
        tag: "Emergence",
        href: "https://robotics-navy.vercel.app/units/swarm",
        note: "Separation, alignment, cohesion. Add an obstacle, a goal, or a predator.",
        blurb:
          "120 boids on a spatial hash. Nothing in the code describes a flock; the flock is what the three weights produce.",
      },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);

const Demos = () => {
  const [key, setKey] = useState(ALL[0].key);
  const active = ALL.find((d) => d.key === key);

  return (
    <section className="relative w-full">
      <span className="hash-span" id="demos">&nbsp;</span>
      <div className={`${styles.paddingX} max-w-7xl mx-auto pt-10 pb-14`}>
        <motion.div
          variants={textVariant()}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          className="mb-3 flex items-end justify-between gap-6 flex-wrap"
        >
          <div>
            <p className={styles.sectionSubText}>Running here, not screenshotted</p>
            <h2 className={styles.sectionHeadText}>Demos.</h2>
          </div>
          <a
            href="#work"
            className="font-mono text-[11px] text-fg-faint hover:text-amber transition-colors duration-150 pb-1"
          >
            skip to projects ↓
          </a>
        </motion.div>

        <motion.div
          variants={fadeIn("", "", 0.08)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="grid gap-6 lg:gap-8 items-start"
          style={{ gridTemplateColumns: "minmax(0, 240px) minmax(0, 1fr)" }}
        >
          <nav className="flex flex-col gap-5 lg:sticky lg:top-24">
            {GROUPS.map((g) => (
              <div key={g.label} className="flex flex-col gap-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint mb-1.5">
                  {g.label}
                </p>
                {g.items.map((d) => {
                  const on = d.key === key;
                  return (
                    <button
                      key={d.key}
                      onClick={() => setKey(d.key)}
                      aria-pressed={on}
                      className="text-left px-3 py-2 rounded-lg border transition-colors duration-200"
                      style={{
                        borderColor: on ? "#8A5F27" : "transparent",
                        background: on ? "rgba(242,160,61,0.07)" : "transparent",
                      }}
                    >
                      <span
                        className="block font-display text-[14px]"
                        style={{ color: on ? "#F2A03D" : "#E9EAEF" }}
                      >
                        {d.name}
                      </span>
                      <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-fg-faint mt-0.5">
                        {d.tag}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap mb-2">
              <h3 className="font-display text-fg text-[18px] tracking-[-0.015em]">
                {active.name}
              </h3>
              <span className="text-[12.5px] text-fg-dim">{active.note}</span>
              <a
                href={active.href}
                target="_blank"
                rel="noreferrer"
                className="ml-auto font-mono text-[10.5px] text-fg-faint hover:text-amber transition-colors duration-150 whitespace-nowrap"
              >
                open ↗
              </a>
            </div>
            <p className="text-fg-dim text-[13.5px] leading-relaxed max-w-[70ch] mb-4">
              {active.blurb}
            </p>
            <div className="panel-demo p-3">
              {/* keyed so switching tabs unmounts the previous demo outright */}
              <Demo
                key={active.key}
                id={active.id}
                src={active.src}
                title={active.name}
                height={active.id === "refusal" ? 520 : 600}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Demos;
