import { useRef } from "react";
import ParallaxTilt from "react-parallax-tilt";
import { motion, useScroll, useTransform } from "framer-motion";
import { styles } from "../styles";
import { link } from "../assets";
import { projects } from "../constants/index";
import ProjectAnim from "./ProjectAnim";

const CARD_WIDTH = 340;
const GAP = 28;

/* Per-card scroll-driven entrance — shoots in from the right like a meteor */
const ScrollCard = ({ index, total, scrollYProgress, children }) => {
  const enterStart = (index / total) * 0.72;
  const enterEnd = Math.min(enterStart + 0.14, 0.98);
  const opacityEnd = Math.min(enterStart + 0.07, 0.98);

  const extraX = useTransform(scrollYProgress, [enterStart, enterEnd], [520, 0]);
  const opacity = useTransform(scrollYProgress, [enterStart, opacityEnd], [0, 1]);
  const scale = useTransform(scrollYProgress, [enterStart, enterEnd], [0.82, 1]);
  const rotate = useTransform(scrollYProgress, [enterStart, enterEnd], [6, 0]);

  return (
    <motion.div style={{ x: extraX, opacity, scale, rotateZ: rotate }}>
      {children}
    </motion.div>
  );
};

const ProjectCard = ({ index, name, description, tags, source_code_link }) => (
  <ParallaxTilt
    options={{ max: 18, scale: 1, speed: 450 }}
    className="bg-tertiary p-5 rounded-2xl flex-shrink-0 border border-[rgba(139,250,255,0.07)] hover:border-[rgba(139,250,255,0.22)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(139,250,255,0.06)]"
    style={{ width: CARD_WIDTH }}
  >
    <div className="relative w-full h-[200px]">
      <ProjectAnim index={index} />
      <div className="absolute inset-0 flex justify-end m-3 card-img_hover">
        <a
          className="white w-10 h-10 rounded-full flex justify-center items-center cursor-pointer"
          href={source_code_link}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={link} alt="source code" className="w-1/2 h-1/2 object-contain" />
        </a>
      </div>
    </div>

    <div className="mt-4">
      <h3 className="text-white font-bold text-[20px] leading-tight">{name}</h3>
      <p className="mt-2 text-secondary text-[13px] leading-relaxed line-clamp-3">{description}</p>
    </div>

    <div className="mt-3 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <p key={`${name}-${tag.name}`} className={`text-[12px] ${tag.color}`}>
          #{tag.name}
        </p>
      ))}
    </div>
  </ParallaxTilt>
);

const Works = () => {
  const containerRef = useRef(null);
  const total = projects.length;

  const totalStripWidth = total * (CARD_WIDTH + GAP) + 240;
  const endX = -(totalStripWidth - (typeof window !== "undefined" ? window.innerWidth : 1440) + 80);

  const sectionHeight = total * (CARD_WIDTH + GAP) * 0.82 + 500;

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  /* Base strip translation — pans the whole row left as you scroll */
  const stripX = useTransform(scrollYProgress, [0, 1], [100, endX]);

  return (
    <section className="relative w-full" style={{ background: "transparent" }}>
      <span className="hash-span" id="work">&nbsp;</span>
      <div ref={containerRef} className="relative" style={{ height: sectionHeight }}>
        <div className="sticky top-0 h-screen flex flex-col" style={{ overflow: "visible" }}>

          {/* Header */}
          <div className={`${styles.paddingX} pt-20 pb-6 max-w-7xl mx-auto w-full flex-shrink-0`}>
            <p className={styles.sectionSubText}>My Work</p>
            <h2 className={styles.sectionHeadText}>Projects.</h2>
            <p className="mt-1 text-secondary text-[14px] max-w-xl">
              A diverse showcase — from machine learning to political science and the intersections in between.
            </p>
          </div>

          {/* Card strip — clip x only so card tops/bottoms aren't cut */}
          <div className="flex-1 flex items-center" style={{ overflowX: "clip", overflowY: "visible" }}>
            <motion.div
              className="flex will-change-transform"
              style={{ gap: GAP, x: stripX }}
            >
              {projects.map((project, index) => (
                <ScrollCard
                  key={`project-${index}`}
                  index={index}
                  total={total}
                  scrollYProgress={scrollYProgress}
                >
                  <ProjectCard index={index} {...project} />
                </ScrollCard>
              ))}
            </motion.div>
          </div>

          {/* Scroll hint */}
          <div className="pb-5 flex-shrink-0 flex justify-center">
            <p className="text-secondary text-[11px] tracking-widest uppercase opacity-30">
              scroll to explore →
            </p>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Works;
