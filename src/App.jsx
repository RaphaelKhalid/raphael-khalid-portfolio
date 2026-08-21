import { BrowserRouter } from "react-router-dom";
import {
  AmbientField,
  Contact,
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
        <Works />
        <Experience />
        <Contact />
      </div>
    </BrowserRouter>
  );
};

export default App;
