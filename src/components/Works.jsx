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

const CardWrapper = ({ index, springX, children }) => {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const cardCenter = index * STEP + CARD_W / 2;

  const screenCenter = useTransform(springX, (x) => x + cardCenter);
  const scale = useTransform(
    screenCenter,
    [vw * 0.05, vw * 0.45, vw * 0.55, vw * 0.95],
    [0.86, 1, 1, 0.86]
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
    tiltEnable={true}
    tiltMaxAngleX={10}
    tiltMaxAngleY={10}
    scale={1}
    transitionSpeed={600}
    className="bg-tertiary p-5 rounded-2xl border border-[rgba(139,250,255,0.07)] hover:border-[rgba(139,250,255,0.22)] transition-colors duration-300 hover:shadow-[0_20px_60px_rgba(139,250,255,0.06)]"
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
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;

  const startX = 80;
  // endX: position strip so last card's right edge is 80px from right edge
  const endX = -(total * STEP - vw + 80);

  // Section must be tall enough for the strip to fully travel.
  // useScroll "start start"→"end end" maps sectionHeight - vh pixels of scroll to 0→1.
  // So: sectionHeight - vh = |endX - startX|, plus buffer for spring settle.
  const stripTravel = Math.abs(endX - startX);
  const sectionHeight = stripTravel + vh + 320;

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const rawX = useTransform(scrollYProgress, [0, 1], [startX, endX]);
  const springX = useSpring(rawX, { stiffness: 60, damping: 20, mass: 0.8 });

  return (
    <section className="relative w-full" style={{ background: "transparent" }}>
      <span className="hash-span" id="work">&nbsp;</span>

      <div ref={containerRef} className="relative" style={{ height: sectionHeight }}>
        <div className="sticky top-0 h-screen flex flex-col">

          <div className={`${styles.paddingX} pt-16 pb-4 max-w-7xl mx-auto w-full flex-shrink-0`}>
            <p className={styles.sectionSubText}>My Work</p>
            <h2 className={styles.sectionHeadText}>Projects.</h2>
            <p className="mt-1 text-secondary text-[14px] max-w-xl leading-relaxed">
              A diverse showcase — from machine learning to political science and the intersections in between.
            </p>
          </div>

          {/* Strip absolutely centered — no overflow container clipping cards */}
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
