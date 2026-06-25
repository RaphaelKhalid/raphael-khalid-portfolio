import { motion } from "framer-motion";
import { styles } from "../styles";
import { link } from "../assets";
import { projects } from "../constants/index";
import ProjectAnim from "./ProjectAnim";

const COLS = 3;

// Distribute cards round-robin across columns so they read left-to-right
const columns = Array.from({ length: COLS }, (_, ci) =>
  projects
    .map((p, i) => ({ ...p, globalIndex: i }))
    .filter((_, i) => i % COLS === ci)
);

// Column animation delays — left col fastest, right col slowest
const COL_DELAY = [0, 0.08, 0.16];

const cardVariants = {
  hidden: { opacity: 0, y: 36 },
  show: (delay) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 24,
      delay,
    },
  }),
};

const ProjectCard = ({ globalIndex, name, description, tags, source_code_link, colIndex, rowIndex }) => {
  const delay = COL_DELAY[colIndex] + rowIndex * 0.06;

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      whileInView="show"
      custom={delay}
      viewport={{ once: true, amount: 0.15 }}
      className="bg-tertiary rounded-2xl overflow-hidden border border-[rgba(139,250,255,0.07)] hover:border-[rgba(139,250,255,0.2)] transition-colors duration-300 hover:shadow-[0_16px_48px_rgba(139,250,255,0.07)]"
    >
      <div className="relative w-full h-[170px]">
        <ProjectAnim index={globalIndex} />
        <div className="absolute inset-0 flex justify-end m-2">
          <a
            href={source_code_link}
            target="_blank"
            rel="noopener noreferrer"
            className="white w-9 h-9 rounded-full flex justify-center items-center cursor-pointer hover:scale-110 transition-transform"
          >
            <img src={link} alt="source code" className="w-1/2 h-1/2 object-contain" />
          </a>
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-white font-bold text-[15px] leading-snug">{name}</h3>
        <p className="mt-1.5 text-secondary text-[12px] leading-relaxed line-clamp-3">{description}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag.name} className={`text-[11px] ${tag.color}`}>
              #{tag.name}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const Works = () => (
  <section className="relative w-full" style={{ background: "transparent" }}>
    <span className="hash-span" id="work">&nbsp;</span>

    <div className={`${styles.paddingX} max-w-7xl mx-auto pt-16 pb-20`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="mb-12"
      >
        <p className={styles.sectionSubText}>My Work</p>
        <h2 className={styles.sectionHeadText}>Projects.</h2>
        <p className="mt-2 text-secondary text-[14px] max-w-xl leading-relaxed">
          A diverse showcase — from machine learning to political science and the intersections in between.
        </p>
      </motion.div>

      {/* Masonry grid — 3 cols desktop, 2 tablet, 1 mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
        {columns.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-5">
            {col.map((project, ri) => (
              <ProjectCard
                key={project.globalIndex}
                {...project}
                colIndex={ci}
                rowIndex={ri}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Works;
