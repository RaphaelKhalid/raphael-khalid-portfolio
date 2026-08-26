import { Analytics } from "@vercel/analytics/react";
import { BrowserRouter } from "react-router-dom";
import {
  AmbientField,
  Contact,
  Demos,
  Experience,
  Hero,
  Navbar,
  Works,
} from "./components";

const App = () => {
  return (
    <BrowserRouter>
      <AmbientField />
      <div className="relative" style={{ zIndex: 1 }}>
        <Navbar />
        <Hero />
        <Demos />
        <Works />
        <Experience />
        <Contact />
      </div>
      <Analytics />
    </BrowserRouter>
  );
};

export default App;
