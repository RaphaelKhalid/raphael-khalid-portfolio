import { styles } from "../styles";
import ReactiveHeadline from "./ReactiveHeadline";

// The hero is mostly paper: a headline that behaves like a small complex
// system, one line of who and what, and room on the right for raly (who
// lives in its own layer behind the page, see RalyLayer).
const Hero = () => (
  <section id="top" className="relative w-full min-h-[100svh] flex flex-col">
    <div className={`${styles.paddingX} max-w-[1440px] w-full mx-auto flex-1 flex flex-col justify-center pt-[110px] pb-10`}>
      <ReactiveHeadline className="w-fit" />
      <p className="mt-10 max-w-[44ch] text-[16px] leading-relaxed text-fg-dim">
        I&apos;m Raphael Khalid. I run AutoLabs, a public lab where autonomous agents
        design, run and report AI-safety experiments, and I build simulations that let
        you poke at control, emergence and institutions instead of reading about them.
      </p>
      <p className="mt-5 flex gap-6 font-mono text-[11px] tracking-[0.16em] uppercase">
        <a href="https://www.linkedin.com/in/raphael-khalid/" target="_blank" rel="noreferrer" className="text-ink-text hover:text-coral transition-colors">LinkedIn ↗</a>
        <a href="https://github.com/RaphaelKhalid" target="_blank" rel="noreferrer" className="text-ink-text hover:text-coral transition-colors">GitHub ↗</a>
      </p>
      <button
        type="button"
        onClick={() => dispatchEvent(new Event("raly:tour"))}
        className="mt-8 w-fit inline-flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase text-coral hover:text-ink-text transition-colors"
      >
        <span aria-hidden="true" className="inline-block w-6 h-px bg-current" />
        let raly show you around
      </button>
    </div>
    <div className={`${styles.paddingX} max-w-[1440px] w-full mx-auto`}>
      <a href="#demos" className="flex items-center justify-between h-[60px] border-t border-hair group">
        <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-text">01 / demos</span>
        <svg width="22" height="12" viewBox="0 0 22 12" fill="none" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-y-0.5">
          <path d="M1 1l10 10L21 1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </a>
    </div>
  </section>
);

export default Hero;
