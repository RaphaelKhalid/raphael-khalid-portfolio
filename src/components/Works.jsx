import { useRef } from "react";
import ParallaxTilt from "react-parallax-tilt";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { styles } from "../styles";
import { link } from "../assets";
import { projects } from "../constants/index";
import ProjectAnim from "./ProjectAnim";

const CARD_W = 340;
const GAP = 28;
const STEP = CARD_W + GAP;

/*
  Each card derives its opacity/scale from its screen-space x position,
  computed from the spring-driven strip offset. Cards fade + shrink
  slightly as they approach the viewport edges — spotlight effect.
  No extra x offset is added so positioning is always correct.
*/
const CardWrapper = ({ index, springX, children }) => {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const cardCenter = index * STEP + CARD_W / 2;

  const screenCenter = useTransform(springX, (x) => x + cardCenter);
  const scale = useTransform(
    screenCenter,
    [vw * 0.05, vw * 0.45, vw * 0.55, vw * 0.95],
    [0.84,       1,          1,           0.84]
  );
  const opacity = useTransform(
    screenCenter,
    [-CARD_W * 0.5, CARD_W * 0.5, vw - CARD_W * 0.5, vw + CARD_W * 0.5],
    [0, 1, 1, 0]
  );

  return (
    <motion.div style={{ scale, opacity }} className="flex-shrink-0">
      {children}
    </motion.div>
  );
};

const ProjectCard = ({ index, name, description, tags, source_code_link }) => (
  <ParallaxTilt
    options={{ max: 15, scale: 1, speed: 450 }}
    className="bg-tertiary p-5 rounded-2xl border border-[rgba(139,250,255,0.07)] hover:border-[rgba(139,250,255,0.22)] transition-all duration-300 hover:shadow-[0_20px_60px_rgba(139,250,255,0.06)]"
    style={{ width: CARD_W }}
  >
    <div className="relative w-full h-[200px]">
      <ProjectAnim index={index} />
      <div className="absolute inset-0 flex justify-end m-3">
        <a
          href={source_code_link}
          target="_blank"
          rel="noopener noreferrer"
          className="white w-10 h-10 rounded-full flex justify-center items-center cursor-pointer"
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
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;

  const startX = 80;
  const endX = -(total * STEP - vw + 80);
  const sectionHeight = total * STEP * 0.8 + 400;

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const rawX = useTransform(scrollYProgress, [0, 1], [startX, endX]);
  // Spring adds a subtle organic lag — gives the "flying" feeling
  const springX = useSpring(rawX, { stiffness: 55, damping: 18, mass: 0.9 });

  return (
    <section className="relative w-full" style={{ background: "transparent" }}>
      <span className="hash-span" id="work">&nbsp;</span>

      <div ref={containerRef} className="relative" style={{ height: sectionHeight }}>
        <div className="sticky top-0 h-screen flex flex-col">

          {/* Header */}
          <div className={`${styles.paddingX} pt-16 pb-4 max-w-7xl mx-auto w-full flex-shrink-0`}>
            <p className={styles.sectionSubText}>My Work</p>
            <h2 className={styles.sectionHeadText}>Projects.</h2>
            <p className="mt-1 text-secondary text-[14px] max-w-xl leading-relaxed">
              A diverse showcase — from machine learning to political science and the intersections in between.
            </p>
          </div>

          {/*
            Card track: position-relative, no overflow clipping.
            Strip is absolute-centered vertically so cards are never
            cut off by the container boundary regardless of screen size.
          */}
          <div className="flex-1 relative">
            <motion.div
              className="absolute flex"
              style={{
                x: springX,
                top: "50%",
                translateY: "-50%",
                gap: `${GAP}px`,
                left: 0,
              }}
            >
              {projects.map((project, i) => (
                <CardWrapper key={i} index={i} springX={springX}>
                  <ProjectCard index={i} {...project} />
                </CardWrapper>
              ))}
            </motion.div>
          </div>

          {/* Scroll hint */}
          <div className="pb-4 flex-shrink-0 flex justify-center">
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
