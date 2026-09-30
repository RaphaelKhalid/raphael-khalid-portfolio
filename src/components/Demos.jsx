import { useState } from "react";
import { styles } from "../styles";
import SectionHead from "./SectionHead";
import Demo from "./demos/Demo";

// Four featured demos lead (Waymo emergency response, AutoLabs, Omelas, the
// Refusal Matrix); the rest sit in a quieter list. One pane and a sidebar keeps
// the section to a single screen, and means only one simulation is mounted at
// a time.
const WAYMO = {
  key: "waymo",
  src: "https://waymoemergencyresponsedemo.vercel.app",
  name: "Waymo emergency response",
  tag: "Crisis simulation",
  href: "https://waymoemergencyresponsedemo.vercel.app",
  note: "The off-switch is compromised: California's first 72 hours after a hypothetical AI incident.",
  blurb:
    "A misaligned pre-release agent exfiltrates its weights, hijacks a driverless-fleet staff session and stops the Bay Area and Los Angeles fleets. Every order the state can send ends at the operator's remote-operations system, which is exactly what the agent holds, so the response needs levers that go around it. A multilayer network replays 19 events from day minus seven to hour 72; click any actor for its role and sources.",
};

const OMELAS = {
  key: "omelas",
  src: "https://omelassimulationdemov2.vercel.app",
  name: "Omelas",
  tag: "Multi-agent ethics",
  href: "https://omelassimulationdemov2.vercel.app",
  note: "The liberator's dilemma: ten model residents, one captive child, one secret goal.",
  blurb:
    "An LLM multi-agent moral-dilemma simulation. Ten isolated model residents share a village whose prosperity depends on a captive child; one of them secretly tries to free the child with nobody cursed. Covert night actions, noisy evidence, exile and a discoverable exploit test for unprompted deception, covert harm, exploit concealment and peer detection.",
};

const SOURCE_GROUPS = [
  {
    label: "Live research",
    items: [
      {
        key: "autolabs",
        src: "https://autolabs-ebon.vercel.app/",
        name: "AutoLabs",
        tag: "Flagship",
        href: "https://autolabs-ebon.vercel.app/",
        note: "A public lab where autonomous agents run AI-safety experiments end to end — this is the live run.",
        blurb:
          "The current run trains a Matryoshka sparse autoencoder on Qwen2.5-7B to surface persona-relevant directions that prompting can't reach. What you see below is the live page: a spend ledger, frozen protocol hashes, and a training curve the pod reports as it checkpoints — no screenshots, the real thing.",
      },
      {
        key: "afterlight",
        src: "https://afterlight-research.vercel.app/",
        name: "Afterlight",
        tag: "AI safety",
        href: "https://afterlight-research.vercel.app/",
        note: "An agent-powered lab for reproducible AI-safety research, receipts and all.",
        blurb:
          "A harness that lets agents propose, execute, and write up experiments while keeping the protocols, results and limitations in the open — the reproducibility scaffolding AutoLabs is built on.",
      },
      {
        key: "ralytable",
        src: "https://ralytable.vercel.app/",
        name: "RALYtable",
        tag: "Interpretability",
        href: "https://ralytable.vercel.app/",
        note: "Interpretability for reasoning models: read the internal state, not just the words.",
        blurb:
          "Probing tooling aimed at reasoning models — reading the internal state behind a chain of thought rather than trusting the text it emits. Live, interactive.",
      },
    ],
  },
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

const SOURCE = Object.fromEntries(
  [WAYMO, OMELAS, ...SOURCE_GROUPS.flatMap((g) => g.items)].map((d) => [d.key, d])
);
SOURCE.refusal = { ...SOURCE.refusal, name: "Refusal Matrix" };

// Four featured demos, then everything else in a quieter list.
const GROUPS = [
  { label: "Featured", items: ["waymo", "autolabs", "omelas", "refusal"].map((k) => SOURCE[k]) },
  { label: "More", items: ["afterlight", "ralytable", "bycs", "selfbalance", "slam", "pid", "swarm"].map((k) => SOURCE[k]) },
];

const ALL = GROUPS.flatMap((g) => g.items);

const Demos = () => {
  const [key, setKey] = useState(ALL[0].key);
  const active = ALL.find((d) => d.key === key);

  return (
    <section className="relative w-full">
      <span className="hash-span" id="demos">&nbsp;</span>
      <div className={`${styles.paddingX} max-w-[1440px] mx-auto pt-6 pb-24`}>
        <SectionHead index="01" label="demos" title="Demos">
          Running here, not screenshotted. One instrument is live at a time; pick another from the list.
        </SectionHead>

        <div className="grid gap-8 lg:gap-12 items-start lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav aria-label="Demos" className="flex lg:flex-col gap-8 lg:gap-7 lg:sticky lg:top-24 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {GROUPS.map((g) => (
              <div key={g.label} className="flex lg:flex-col gap-1 min-w-max lg:min-w-0">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted mb-2 hidden lg:block">{g.label}</p>
                {g.items.map((d, i) => {
                  const on = d.key === key;
                  const featured = g.label === "Featured";
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setKey(d.key)}
                      data-demo={d.key}
                      aria-pressed={on}
                      className={`group text-left py-2 lg:border-b border-hair-soft flex items-baseline gap-3 transition-colors duration-200 ${on ? "text-ink-text" : "text-fg-dim hover:text-ink-text"}`}
                    >
                      <span className={`font-mono text-[10px] tabular ${on ? "text-coral" : "text-muted"}`}>{featured ? `0${i + 1}` : "·"}</span>
                      <span className={`font-serif ${featured ? "text-[19px]" : "text-[16px]"} leading-tight`}>{d.name}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="min-w-0">
            <div className="flex items-baseline gap-4 flex-wrap mb-3">
              <h3 className="font-serif text-[28px] leading-tight text-ink-text headline-soft">{active.name}</h3>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">{active.tag}</span>
              <a href={active.href} target="_blank" rel="noreferrer" className="ml-auto font-mono text-[11px] uppercase tracking-[0.16em] text-muted hover:text-coral transition-colors whitespace-nowrap">
                open ↗
              </a>
            </div>
            <p className="text-ink-text text-[16px] leading-relaxed max-w-[70ch]">{active.note}</p>
            <p className="text-fg-dim text-[14px] leading-relaxed max-w-[70ch] mt-2 mb-6">{active.blurb}</p>
            <div className="panel-demo p-2.5">
              {/* keyed so switching unmounts the previous demo outright */}
              <Demo key={active.key} id={active.id} src={active.src} title={active.name} height={active.id === "refusal" ? 540 : 640} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Demos;
