import Hero from "./Hero";
import Navbar from "./Navbar";
import Experience from "./Experience";
import Works from "./Works";
import Contact from "./Contact";
import AmbientField from "./AmbientField";
import Demos from "./Demos";

export { Hero, Navbar, Experience, Works, Contact, AmbientField, Demos };

// The three.js canvases (StarsCanvas, KnowledgeGraph, Earth, Ball, Computers)
// are intentionally no longer re-exported here. They are the forked template's
// signature, and they compete with the demo canvases for GPU time. The files
// remain in src/components/canvas/ — import them directly if one is ever
// wanted back.
