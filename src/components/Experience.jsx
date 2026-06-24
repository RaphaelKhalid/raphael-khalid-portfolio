import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { styles } from "../styles";
import { experiences } from "../constants/index";
import SectionWrapper from "../hoc";
import { textVariant } from "../utils/motions";

const LadderRung = ({ experience, index }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {/* Rung row */}
      <div
        className="relative flex items-center cursor-pointer group select-none"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Left knot */}
        <div
          className={`w-3 h-3 rounded-full border-2 flex-shrink-0 transition-colors duration-200 z-10
            ${open ? "border-white bg-white" : "border-[#8BFAFF] bg-transparent"}`}
        />

        {/* Left bar segment */}
        <div
          className={`h-[2px] w-6 flex-shrink-0 transition-colors duration-200
            ${open ? "bg-white" : "bg-[#8BFAFF] opacity-50"}`}
        />

        {/* Rung label */}
        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 px-5 py-3 rounded-xl
            transition-all duration-200 flex-1
            ${open ? "bg-white/8" : "group-hover:bg-white/5"}`}
        >
          <span
            className={`font-semibold text-[15px] transition-colors duration-200
              ${open ? "text-white" : "text-[#8BFAFF]"}`}
          >
            {experience.company_name}
          </span>
          <span className="text-secondary text-[13px]">·</span>
          <span
            className={`text-[14px] transition-colors duration-200
              ${open ? "text-white" : "text-white/70"}`}
          >
            {experience.title}
          </span>
          <span className="text-secondary text-[13px]">·</span>
          <span className="text-secondary text-[13px]">{experience.date}</span>

          <span
            className={`ml-auto text-[11px] transition-all duration-200 opacity-0 group-hover:opacity-60
              ${open ? "opacity-60" : ""}`}
          >
            {open ? "▲ collapse" : "▼ expand"}
          </span>
        </div>

        {/* Right bar segment */}
        <div
          className={`h-[2px] w-6 flex-shrink-0 transition-colors duration-200
            ${open ? "bg-white" : "bg-[#8BFAFF] opacity-50"}`}
        />

        {/* Right knot */}
        <div
          className={`w-3 h-3 rounded-full border-2 flex-shrink-0 transition-colors duration-200 z-10
            ${open ? "border-white bg-white" : "border-[#8BFAFF] bg-transparent"}`}
        />
      </div>

      {/* Expandable detail panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <ul className="ml-[3.25rem] mr-[3.25rem] mt-2 mb-3 pl-4 space-y-2 border-l border-white/10">
              {experience.points.map((point, i) => (
                <li
                  key={i}
                  className="text-secondary text-[13px] leading-relaxed pl-3"
                >
                  {point}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Experience = () => (
  <>
    <motion.div variants={textVariant()}>
      <p className={styles.sectionSubText}>What I have done so far</p>
      <h2 className={styles.sectionHeadText}>Work Experience.</h2>
    </motion.div>

    <div className="mt-16 relative">
      {/* Left rail */}
      <div
        className="absolute top-0 bottom-0 w-[2px] pointer-events-none"
        style={{
          left: "0.375rem",
          background: "linear-gradient(to bottom, transparent, rgba(139,250,255,0.25) 20%, rgba(139,250,255,0.25) 80%, transparent)",
        }}
      />
      {/* Right rail */}
      <div
        className="absolute top-0 bottom-0 w-[2px] pointer-events-none"
        style={{
          right: "0.375rem",
          background: "linear-gradient(to bottom, transparent, rgba(139,250,255,0.25) 20%, rgba(139,250,255,0.25) 80%, transparent)",
        }}
      />

      {/* Rungs */}
      <div className="flex flex-col gap-4 py-4">
        {experiences.map((exp, i) => (
          <LadderRung key={i} experience={exp} index={i} />
        ))}
      </div>
    </div>
  </>
);

export default SectionWrapper(Experience, "experience");
