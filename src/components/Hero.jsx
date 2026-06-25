import { useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { styles } from "../styles";

const ROLES = ['Computer Scientist', 'Political Scientist', 'ML Engineer', 'Complexity Scientist'];

const Hero = () => {
  const [roleIndex, setRoleIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [phase, setPhase] = useState('typing');

  useEffect(() => {
    const target = ROLES[roleIndex];
    let timeout;
    if (phase === 'typing') {
      if (displayed.length < target.length) {
        timeout = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 62);
      } else {
        timeout = setTimeout(() => setPhase('erasing'), 2200);
      }
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 32);
      } else {
        setRoleIndex((i) => (i + 1) % ROLES.length);
        setPhase('typing');
      }
    }
    return () => clearTimeout(timeout);
  }, [displayed, phase, roleIndex]);

  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, -80]);
  const spring = (delay) => ({ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay });

  return (
    <section className="relative w-full h-screen mx-auto overflow-hidden" style={{ background: "transparent" }}>
      <div className="orb-1" />
      <div className="orb-2" />
      <div className="orb-3" />

      <motion.div
        style={{ y }}
        className={`${styles.paddingX} absolute inset-0 top-[120px] max-w-7xl mx-auto flex flex-col justify-start items-start`}
      >
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring(0)}
          className="text-secondary text-[14px] tracking-widest uppercase mb-3"
        >
          Hello, I'm
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring(0.1)}
          className={`${styles.heroHeadText} text-white`}
        >
          Raphael Khalid
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring(0.2)}
          className={`${styles.heroSubText} mt-3 flex items-baseline gap-2 flex-wrap`}
        >
          <span className="text-secondary">I am a</span>
          <span className="text-white inline-flex items-baseline min-w-[260px]">
            {displayed}
            <span className="blink-cursor ml-[1px]" style={{ color: '#8BFAFF' }}>|</span>
          </span>
        </motion.div>
      </motion.div>


      {/* Minimalist scroll indicator */}
      <a href="#work" className="absolute bottom-10 left-8 flex items-center gap-3 group z-20">
        <div className="relative w-[1px] h-12 bg-[rgba(139,250,255,0.12)] overflow-hidden">
          <div className="scroll-dot" />
        </div>
        <span className="text-[9px] tracking-[0.2em] uppercase text-secondary group-hover:text-white/60 transition-colors">
          Scroll
        </span>
      </a>
    </section>
  );
};

export default Hero;
