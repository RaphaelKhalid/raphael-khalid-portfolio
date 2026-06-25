import { useRef, useEffect, useState } from "react";
import ParallaxTilt from "react-parallax-tilt";
import { motion, useScroll, useTransform } from "framer-motion";
import { styles } from "../styles";
import { link } from "../assets";
import { projects } from "../constants/index";
import ProjectAnim from "./ProjectAnim";

const ProjectCard = ({ index, name, description, tags, source_code_link }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: (index % 3) * 0.1 }}
  >
  <ParallaxTilt
    options={{ max: 25, scale: 1, speed: 450 }}
    className="bg-tertiary p-5 rounded-2xl w-[340px] flex-shrink-0 border border-[rgba(139,250,255,0.07)] hover:border-[rgba(139,250,255,0.22)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(139,250,255,0.06)]"
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
  </motion.div>
);

const CARD_WIDTH = 340;
const GAP = 28;

const Works = () => {
  const containerRef = useRef(null);
  const [endX, setEndX] = useState(-3000);

  useEffect(() => {
    const totalStripWidth = projects.length * (CARD_WIDTH + GAP) + 160;
    setEndX(-(totalStripWidth - window.innerWidth + 80));
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const x = useTransform(scrollYProgress, [0, 1], [80, endX]);

  const sectionHeight = projects.length * (CARD_WIDTH + GAP) + 400;

  return (
    <section className="relative w-full bg-[#0d0b22]">
      {/* Top fade from Hero (#050816) into this section */}
      <div
        className="absolute top-0 left-0 right-0 h-[140px] pointer-events-none z-10"
        style={{ background: 'linear-gradient(to bottom, #050816, transparent)' }}
      />
      <span className="hash-span" id="work">&nbsp;</span>
      <div ref={containerRef} className="relative" style={{ height: sectionHeight }}>
        <div className="sticky top-0 h-screen flex flex-col overflow-hidden">

          {/* Header */}
          <div className={`${styles.paddingX} pt-20 pb-6 max-w-7xl mx-auto w-full`}>
            <p className={styles.sectionSubText}>My Work</p>
            <h2 className={styles.sectionHeadText}>Projects.</h2>
            <p className="mt-1 text-secondary text-[14px] max-w-xl">
              A diverse showcase — from machine learning to political science and the intersections in between.
            </p>
          </div>

          {/* Horizontally panning cards */}
          <div className="flex-1 flex items-center overflow-hidden">
            <motion.div
              style={{ x }}
              className="flex gap-7 will-change-transform"
            >
              {projects.map((project, index) => (
                <ProjectCard key={`project-${index}`} index={index} {...project} />
              ))}
            </motion.div>
          </div>

          {/* Scroll hint */}
          <div className="pb-4 flex justify-center">
            <p className="text-secondary text-[11px] tracking-widest uppercase opacity-40">
              scroll to explore →
            </p>
          </div>

        </div>
      </div>
      {/* Bottom fade into Experience (#050816) */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[140px] pointer-events-none z-10"
        style={{ background: 'linear-gradient(to bottom, transparent, #050816)' }}
      />
    </section>
  );
};

export default Works;
