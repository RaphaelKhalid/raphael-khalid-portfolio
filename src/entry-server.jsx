import { renderToString } from "react-dom/server";
import App from "./App";

// Build-time render of the whole page (see tools/prerender.mjs).
export { projects, experiences } from "./constants";
export const render = () => renderToString(<App prerender />);
