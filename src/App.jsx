import { startTransition, useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { BrowserRouter } from "react-router-dom";
import { Contact, Demos, Experience, Hero, Navbar, Photographs, RalyLayer, Works } from "./components";

// Below the hero, sections mount one per frame after the first paint, so the
// page's first frame is not one long block. A link straight to a section
// (#contact) mounts everything at once so the browser can jump to it.
const LATER = [Demos, Works, Experience, Photographs, Contact];

const BelowHero = () => {
  const [count, setCount] = useState(() => (location.hash ? LATER.length : 0));
  useEffect(() => {
    if (count >= LATER.length) return undefined;
    const frame = requestAnimationFrame(() => startTransition(() => setCount(n => n + 1)));
    return () => cancelAnimationFrame(frame);
  }, [count]);
  return LATER.slice(0, count).map((Section, i) => <Section key={i} />);
};

// A field journal with a living specimen: raly lives in a fixed layer behind
// the page, and the page reads over it.
const App = () => {
  return (
    <BrowserRouter>
      <RalyLayer />
      <div className="relative" style={{ zIndex: 1 }}>
        <Navbar />
        <main>
          <Hero />
          <BelowHero />
        </main>
      </div>
      <Analytics />
    </BrowserRouter>
  );
};

export default App;
