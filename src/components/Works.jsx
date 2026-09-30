import { motion } from "framer-motion";
import { styles } from "../styles";
import { projects } from "../constants/index";
import ProjectAnim from "./ProjectAnim";
import SectionHead from "./SectionHead";

// Projects as numbered specimen plates. AutoLabs, the flagship, gets the
// large plate; the rest follow in reading order.

const rise = {
  hidden: { opacity: 0, y: 24 },
  show: (delay) => ({ opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1], delay } }),
};

const Tags = ({ tags }) => (
  <div className="flex flex-wrap gap-x-3 gap-y-1">
    {tags.map((tag) => (
      <span key={tag.name} className={`font-mono text-[10.5px] uppercase tracking-[0.12em] ${tag.color}`}>{tag.name}</span>
    ))}
  </div>
);

const Plate = ({ project, index, featured = false }) => (
  <motion.a
    href={project.source_code_link}
    target="_blank"
    rel="noopener noreferrer"
    variants={rise}
    initial="hidden"
    whileInView="show"
    custom={featured ? 0 : (index % 3) * 0.06}
    viewport={{ once: true, amount: 0.2 }}
    className={`plate group block rounded-[6px] overflow-hidden transition-transform duration-300 ease-out hover:-translate-y-0.5 ${featured ? "lg:grid lg:grid-cols-[1.15fr_1fr]" : ""}`}
  >
    <div className={`plate-art relative ${featured ? "h-[220px] lg:h-full lg:min-h-[340px] lg:border-b-0 lg:border-r lg:border-hair-soft" : "h-[150px]"}`}>
      {/* Each project's own animation from the original site, in ink on paper. */}
      <ProjectAnim artwork={project.artwork} tone="paper" />
      <span className="absolute top-3 left-4 font-mono text-[10px] tracking-[0.16em] uppercase text-muted">
        plate {String(index + 1).padStart(2, "0")}
      </span>
    </div>
    <div className={featured ? "p-7 lg:p-10 flex flex-col justify-center" : "p-5"}>
      {featured && <p className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-coral mb-4">flagship · live</p>}
      <h3 className={`font-serif text-ink-text leading-[1.12] headline-soft ${featured ? "text-[40px]" : "text-[21px]"}`}>{project.name}</h3>
      <p className={`mt-3 text-fg-dim leading-relaxed ${featured ? "text-[15.5px] max-w-[52ch]" : "text-[13.5px] line-clamp-4"}`}>{project.description}</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <Tags tags={project.tags} />
        <span className="font-mono text-[11px] text-muted group-hover:text-coral transition-colors" aria-hidden="true">↗</span>
      </div>
    </div>
  </motion.a>
);

const Works = () => {
  const [flagship, ...rest] = projects;
  return (
    <section className="relative w-full">
      <span className="hash-span" id="work">&nbsp;</span>
      <div className={`${styles.paddingX} max-w-[1440px] mx-auto pt-6 pb-24`}>
        <SectionHead index="02" label="projects" title="Projects">
          AutoLabs and a cluster of live AI-safety and interpretability labs lead, then the wider body of work:
          machine learning, robotics, complex systems and political science.
        </SectionHead>
        <Plate project={flagship} index={0} featured />
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {rest.map((project, i) => (
            <Plate key={project.name} project={project} index={i + 1} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Works;
