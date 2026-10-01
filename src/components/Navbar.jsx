import { useEffect, useState } from "react";
import { navLinks } from "../constants";
import { onRaly } from "../raly/store";
import { styles } from "../styles";
import { isDark, onTheme, setTheme } from "../utils/theme";

// A quiet top bar: the wordmark, the places to go, raly's tour, night mode and
// its music switch.
// It steps out of the way while you read downward and returns when you scroll
// back up.
const Listen = ({ compact = false }) => {
  const [engine, setEngine] = useState(null);
  const [state, setState] = useState("off");
  const [level, setLevel] = useState(0);

  useEffect(() => onRaly(setEngine), []);
  useEffect(() => {
    if (state !== "on" || !engine) return undefined;
    let frame = 0;
    const tick = () => { setLevel(engine.audio.state.level); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state, engine]);

  if (!engine) return null;
  const toggle = async () => {
    if (state === "on") { engine.audio.disable(); setState("off"); return; }
    setState("asking");
    const ok = await engine.audio.enable();
    setState(ok ? "on" : "denied");
  };
  const label = { off: "listen", asking: "asking…", on: "listening", denied: "no mic" }[state];
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={state === "on"}
      title="Let raly react to music playing near you, through your microphone. Audio is analysed on this device and never recorded or sent."
      className={`inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase transition-colors duration-200 ${state === "on" ? "text-coral" : "text-muted hover:text-ink-text"}`}
    >
      <span aria-hidden="true" className="relative inline-block w-[22px] h-[2px] bg-hair overflow-hidden">
        <span className="absolute inset-y-0 left-0 bg-coral origin-left" style={{ width: "100%", transform: `scaleX(${state === "on" ? level : 0})` }} />
      </span>
      {compact ? null : label}
    </button>
  );
};

// Night: the page goes dark and still, for sitting with raly and some music.
const Night = () => {
  const [dark, setDark] = useState(isDark);
  useEffect(() => onTheme(setDark), []);
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-pressed={dark}
      title={dark ? "Back to the paper journal" : "A dark, quiet page for sitting with raly"}
      className="font-mono text-[11px] tracking-[0.16em] uppercase text-muted hover:text-coral transition-colors duration-200"
    >
      {dark ? "day" : "night"}
    </button>
  );
};

const Navbar = () => {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let lastY = scrollY;
    const onScroll = () => {
      const y = scrollY;
      setHidden(y > 120 && y > lastY);
      lastY = y;
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-20 transition-transform duration-500 ease-out ${hidden && !open ? "-translate-y-full" : "translate-y-0"}`}
      style={{ background: "rgb(var(--paper-rgb) / 0.94)" }}
    >
      <div className={`${styles.paddingX} max-w-[1440px] mx-auto`}>
        <div className="flex items-center justify-between h-[68px] border-b border-hair">
          <a href="#top" className="font-serif text-[28px] leading-none tracking-[-0.02em] text-ink-text headline-soft" onClick={() => setOpen(false)}>
            raphael
          </a>
          <ul className="hidden md:flex items-center gap-10">
            {navLinks.map(link => (
              <li key={link.id}>
                <a href={`#${link.id}`} className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-text hover:text-coral transition-colors duration-200">
                  {link.title}
                </a>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => dispatchEvent(new Event("raly:tour"))} className="font-mono text-[11px] tracking-[0.16em] uppercase text-muted hover:text-coral transition-colors duration-200">
                tour
              </button>
            </li>
            <li><Night /></li>
            <li><Listen /></li>
          </ul>
          <div className="md:hidden flex items-center gap-5">
            <Night />
            <Listen compact />
            <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-text">
              {open ? "close" : "menu"}
            </button>
          </div>
        </div>
        {open && (
          <ul className="md:hidden flex flex-col gap-5 py-6 border-b border-hair">
            {navLinks.map(link => (
              <li key={link.id}>
                <a href={`#${link.id}`} onClick={() => setOpen(false)} className="font-serif text-[30px] leading-none text-ink-text">
                  {link.title.toLowerCase()}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
