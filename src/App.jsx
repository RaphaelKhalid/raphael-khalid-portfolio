import { BrowserRouter } from "react-router-dom";
import {
  Contact,
  Experience,
  Hero,
  Navbar,
  Works,
  StarsCanvas,
} from "./components";

const App = () => {
  return (
    <BrowserRouter>
      <StarsCanvas />
      <div className="relative" style={{ zIndex: 1 }}>
        <Navbar />
        <Hero />
        <Works />
        <Experience />
        <Contact />
      </div>
    </BrowserRouter>
  );
};

export default App;
