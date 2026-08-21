import { motion } from "framer-motion";
import { styles } from "../styles";
import { staggerContainer } from "../utils/motions";

const SectionWrapper = (Component, idName) =>
  function HOC() {
    return (
      <motion.section
        variants={staggerContainer()}
        initial="hidden"
        whileInView="show"
        // Negative bottom margin so content is already resolving as it enters,
        // rather than popping at the fold. once:true — a section that
        // re-animates every time you scroll past turns the page into a tic.
        viewport={{ once: true, amount: 0.2, margin: "0px 0px -12% 0px" }}
        className={`${styles.padding} max-w-7xl mx-auto relative z-0`}
      >
        <span className="hash-span" id={idName}>
          &nbsp;
        </span>
        <Component />
      </motion.section>
    );
  };

export default SectionWrapper;
