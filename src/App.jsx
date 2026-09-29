import { Analytics } from "@vercel/analytics/react";
import { BrowserRouter } from "react-router-dom";
import { Contact, Demos, Experience, Hero, Navbar, RalyLayer, Works } from "./components";

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
          <Demos />
          <Works />
          <Experience />
          <Contact />
        </main>
      </div>
      <Analytics />
    </BrowserRouter>
  );
};

export default App;
