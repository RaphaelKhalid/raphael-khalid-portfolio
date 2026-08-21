// Only what is actually imported. Anything re-exported from here is emitted by
// Rollup whether or not a component renders it — the previous barrel pulled 26MB
// of project screenshots into dist/assets for a `image` field that ProjectCard
// never read. Add an import here only when something on screen uses it.
import logo from "./logo.png";
import menu from "./menu.svg";
import close from "./close.svg";
import link from "./link.png";

import web from "./web.png";
import mobile from "./mobile.png";
import backend from "./backend.png";
import creator from "./creator.png";

import cfgl from "./company/cfgl.png";
import wharton from "./company/wharton.png";
import minerva from "./company/minerva.png";

export {
  logo,
  menu,
  close,
  link,
  web,
  mobile,
  backend,
  creator,
  cfgl,
  wharton,
  minerva,
};
