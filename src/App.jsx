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
    </BrowserRouter>
  );
};

export default App;
