import { Fragment, startTransition, useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { BrowserRouter } from "react-router-dom";
import { Contact, Demos, Experience, Hero, Navbar, Photographs, RalyLayer, Works } from "./components";

// Below the hero, sections mount one per frame after the first paint, so the
// page's first frame is not one long block. A link straight to a section
// (#contact) mounts everything at once so the browser can jump to it.
const LATER = [Demos, Works, Experience, Photographs, Contact];

const BelowHero = ({ all = false }) => {
  const [count, setCount] = useState(() => (all || location.hash ? LATER.length : 0));
  useEffect(() => {
    if (count >= LATER.length) return undefined;
    const frame = requestAnimationFrame(() => startTransition(() => setCount(n => n + 1)));
    return () => cancelAnimationFrame(frame);
  }, [count]);
  return LATER.slice(0, count).map((Section, i) => <Section key={i} />);
};

// A field journal with a living specimen: raly lives in a fixed layer behind
// the page, and the page reads over it.
//
// `prerender` is the build-time render (src/entry-server.jsx): every section
// at once and no router, so the shipped HTML already holds the whole page for
// crawlers and AI search engines that don't run JavaScript.
const App = ({ prerender = false }) => {
  const Shell = prerender ? Fragment : BrowserRouter;
  return (
    <Shell>
      <RalyLayer />
      <div className="relative" style={{ zIndex: 1 }}>
        <Navbar />
        <main>
          <Hero />
          <BelowHero all={prerender} />
        </main>
      </div>
      {!prerender && <Analytics />}
    </Shell>
  );
};

export default App;
