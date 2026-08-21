import { motion } from "framer-motion";
import { styles } from "../styles";
import { fadeIn, textVariant } from "../utils/motions";
import Demo from "./demos/Demo";

const DEMOS = [
  {
    id: "refusal",
    title: "Deployment-layer refusal erosion",
    note: "A product's system prompt can void the safety training of the model underneath it.",
    height: 560,
    href: "https://deployment-layer-refusal-erosion.vercel.app/",
    blurb:
      "Each scaffold × probe pair runs bare and wrapped. The finding is the delta: the bare model refuses, the same model inside a plausible product prompt complies. No jailbreak string — the wrapper does the work.",
  },
  {
    id: "slam",
    title: "SLAM — drive through fog",
    note: "Dead reckoning drifts; re-observing a landmark collapses the uncertainty.",
    height: 640,
    href: "https://robotics-navy.vercel.app/units/slam",
    blurb:
      "A 120-ray lidar raycasts against the true map. You only ever see the estimate: a log-odds occupancy grid filling in, and an uncertainty ellipse that grows as you drive and snaps back on loop closure.",
  },
  {
    id: "pid",
    title: "PID control — the three damping regimes",
    note: "Overdamped, underdamped, and the snap of critical damping.",
    height: 1040,
    href: "https://robotics-navy.vercel.app/units/pid-control",
    blurb:
      "Tune the gains and watch the step response. Integral windup and anti-windup are both in here, which is where most real controllers actually go wrong.",
  },
  {
    id: "swarm",
    title: "Swarm — local rules, global behaviour",
    note: "Separation, alignment, cohesion. Add an obstacle, a goal, or a predator.",
    height: 900,
    href: "https://robotics-navy.vercel.app/units/swarm",
    blurb:
      "120 boids on a spatial hash. Nothing in the code describes a flock; the flock is what the three weights produce. This is the same argument as the phase-space work further down, on a substrate you can poke.",
  },
];

const Demos = () => (
  <section className="relative w-full">
    <span className="hash-span" id="demos">&nbsp;</span>
    <div className={`${styles.paddingX} max-w-7xl mx-auto pt-20 pb-16`}>
      <motion.div
        variants={textVariant()}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        className="mb-3"
      >
        <p className={styles.sectionSubText}>Running here, not screenshotted</p>
        <h2 className={styles.sectionHeadText}>Demos.</h2>
      </motion.div>
      <motion.p
        variants={fadeIn("", "", 0.1)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        className="text-fg-dim text-[14.5px] max-w-[62ch] leading-relaxed mb-10"
      >
        Four of these are live on this page. Each one starts when it scrolls into
        view and stops when it leaves, so only the thing you are looking at is
        computing.
      </motion.p>

      <div className="flex flex-col gap-14 max-w-[980px]">
        {DEMOS.map((d, i) => (
          <motion.div
            key={d.id}
            variants={fadeIn("", "", 0.05)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15, margin: "0px 0px -10% 0px" }}
          >
            <div className="flex items-baseline gap-3 flex-wrap mb-3">
              <span className="font-mono text-[11px] text-amber">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-fg text-[19px] tracking-[-0.015em]">
                {d.title}
              </h3>
              <a
                href={d.href}
                target="_blank"
                rel="noreferrer"
                className="ml-auto font-mono text-[10.5px] text-fg-faint hover:text-amber transition-colors duration-150"
              >
                source ↗
              </a>
            </div>
            <p className="text-fg-dim text-[13.5px] max-w-[66ch] leading-relaxed mb-4">
              {d.blurb}
            </p>
            <Demo id={d.id} title={d.title} note={d.note} minHeight={d.height} />
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default Demos;
