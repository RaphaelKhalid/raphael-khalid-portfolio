import { styles } from "../styles";

// Every section opens the same way: a numbered mono label on a hairline, then
// a serif title and an optional line of context.
const SectionHead = ({ index, label, title, children, aside }) => (
  <header className="mb-12">
    <div className="flex items-center justify-between h-[44px] border-t border-hair">
      <span className={styles.sectionLabel}>{index} / {label}</span>
      {aside}
    </div>
    <h2 className={`${styles.sectionHeadText} mt-8`}>{title}</h2>
    {children && <p className="mt-5 max-w-[60ch] text-[15px] leading-relaxed text-fg-dim">{children}</p>}
  </header>
);

export default SectionHead;
