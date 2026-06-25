import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { styles } from "../styles";
import { link } from "../assets";
import { projects } from "../constants/index";
import ProjectAnim from "./ProjectAnim";

const ProjectCard = ({ index, name, description, tags, source_code_link }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { margin: "-15% 0px -15% 0px", once: false });
  const fromLeft = index % 2 === 0;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: fromLeft ? -60 : 60 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0.25, x: fromLeft ? -30 : 30 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[560px] mx-auto"
    >
      <div
        className="bg-tertiary rounded-2xl overflow-hidden border transition-all duration-500"
        style={{
          borderColor: isInView
            ? "rgba(139,250,255,0.22)"
            : "rgba(139,250,255,0.05)",
          boxShadow: isInView
            ? "0 0 40px rgba(139,250,255,0.07), 0 20px 60px rgba(0,0,0,0.4)"
            : "none",
        }}
      >
        {/* Animated background */}
        <div className="relative w-full h-[200px]">
          <ProjectAnim index={index} />
          <div className="absolute inset-0 flex justify-end m-3">
            <a
              href={source_code_link}
              target="_blank"
              rel="noopener noreferrer"
              className="white w-10 h-10 rounded-full flex justify-center items-center cursor-pointer hover:scale-110 transition-transform"
            >
              <img src={link} alt="source code" className="w-1/2 h-1/2 object-contain" />
            </a>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="text-white font-bold text-[19px] leading-snug">{name}</h3>
          <p className="mt-2 text-secondary text-[13px] leading-relaxed">{description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag.name} className={`text-[12px] ${tag.color}`}>
                #{tag.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const Works = () => (
  <section className="relative w-full" style={{ background: "transparent" }}>
    <span className="hash-span" id="work">&nbsp;</span>

    <div className={`${styles.paddingX} max-w-3xl mx-auto pt-16 pb-20`}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-14"
      >
        <p className={styles.sectionSubText}>My Work</p>
        <h2 className={styles.sectionHeadText}>Projects.</h2>
        <p className="mt-2 text-secondary text-[14px] max-w-xl leading-relaxed">
          A diverse showcase — from machine learning to political science and the intersections in between.
        </p>
      </motion.div>

      {/* Card river */}
      <div className="flex flex-col gap-10">
        {projects.map((project, i) => (
          <ProjectCard key={i} index={i} {...project} />
        ))}
      </div>
    </div>
  </section>
);

export default Works;
