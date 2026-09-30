import { styles } from "../styles";

// Every section opens the same way: a serif title (with an optional link on
// its right) and an optional line of context. No rules or index labels.
const SectionHead = ({ title, children, aside }) => (
  <header className="mb-12 pt-10">
    <div className="flex items-end justify-between gap-6">
      <h2 className={styles.sectionHeadText}>{title}</h2>
      {aside && <div className="pb-2">{aside}</div>}
    </div>
    {children && <p className="mt-5 max-w-[60ch] text-[15px] leading-relaxed text-fg-dim">{children}</p>}
  </header>
);

export default SectionHead;
