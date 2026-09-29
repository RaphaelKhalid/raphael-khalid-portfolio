import { motion } from "framer-motion";
import { styles } from "../styles";
import { experiences } from "../constants/index";
import SectionHead from "./SectionHead";

// Experience as a field notebook: dates in the margin, the role in serif, the
// notes beneath, one hairline running down the page.
const Experience = () => (
  <section className="relative w-full">
    <span className="hash-span" id="experience">&nbsp;</span>
    <div className={`${styles.paddingX} max-w-[1440px] mx-auto pt-6 pb-24`}>
      <SectionHead index="03" label="experience" title="Field notes" />
      <ol className="relative">
        {experiences.map((exp, i) => (
          <motion.li
            key={`${exp.company_name}-${exp.date}`}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
            className="grid md:grid-cols-[180px_28px_minmax(0,1fr)] grid-cols-[18px_minmax(0,1fr)] gap-x-4 pb-12 last:pb-0"
          >
            <p className="hidden md:block font-mono text-[11px] tracking-[0.12em] uppercase text-muted pt-2 text-right">{exp.date}</p>
            <div className="relative flex justify-center">
              <span className="absolute top-0 bottom-[-3rem] w-px bg-hair" aria-hidden="true" />
              <span className="relative mt-[11px] w-[7px] h-[7px] rounded-full border border-ink-text bg-paper" aria-hidden="true" />
            </div>
            <div>
              <p className="md:hidden font-mono text-[10.5px] tracking-[0.12em] uppercase text-muted mb-1">{exp.date}</p>
              <h3 className="font-serif text-[26px] leading-tight text-ink-text headline-soft">{exp.title}</h3>
              <p className="mt-1 text-[14px] text-fg-dim">{exp.company_name}</p>
              <ul className="mt-4 space-y-2 max-w-[70ch]">
                {exp.points.map((point, k) => (
                  <li key={k} className="text-[14px] leading-relaxed text-fg-dim pl-4 relative">
                    <span className="absolute left-0 top-[0.7em] w-2 h-px bg-muted" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  </section>
);

export default Experience;
