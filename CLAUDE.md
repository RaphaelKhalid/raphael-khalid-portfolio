# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (Vite, localhost:5173)
npm run build     # production build → dist/
npm run preview   # serve the dist/ build locally
npm run lint      # ESLint across src/ (max-warnings 0; the older demo labs carry pre-existing warnings)
```

No test suite exists. Verify changes by running `npm run build` (catches import/JSX errors) and visually inspecting via `npm run dev`.

## Architecture

Single-page React app built with Vite, designed as a naturalist's field journal: warm paper (#F4EBDF), ink text, hairline rules, Fraunces for headlines, IBM Plex Sans for body text, IBM Plex Mono for labels. `<BrowserRouter>` only wraps the app for links; there are no routes.

**Rendering layers (z-index order):**
1. `RalyLayer` renders a `position: fixed`, transparent, full-viewport WebGL canvas (`z-index: 0`) where raly, the site's resident organism, swims behind the page. It never takes pointer events; clicks are hit-tested against raly's projected body instead.
2. The main content wrapper (`z-index: 1`). Sections have no backgrounds, so raly shows through.

**Section flow (`App.jsx`):** `Navbar → Hero → Demos → Works → Experience → Photographs → Contact`

**raly (`src/raly/`):** a three.js organism ported from the membrane studies (study 08).
- `engine.js` builds the scene, runs the swimmer and skin simulation, handles viewport-edge and floor collisions and the click response, and publishes raly's screen position to `ralyScreen` in `store.js`. It is loaded lazily.
- `anatomy.js` grows a seeded specimen, and `swimmer.js` steers it so the body follows its own wake.
- `materials.js` holds the skin shaders, `pattern.js` a reaction-diffusion pigment on the GPU, `frames.js` the body frames used for collisions and hit tests, `audio.js` opt-in microphone music analysis, and `palettes.js` its appearance cycle: five natural palettes interleaved with art styles, 30 s each, a click advances. `looks.js` holds the art styles (ink brushwork, watercolor, porcelain with kintsugi, embroidered fabric, oil painting, cosmic whale shark, hand-drawn cartoon) as GLSL that repaints the finished pixel from the body's own coordinates; `?look=ink` shows and holds one. `bubble.js` draws the doodled speech bubble shown when raly is clicked. The nav's "listen" toggle reaches the engine through `store.js`.
- Floor: the contact section's `#sunlit-floor` when it is on screen, otherwise the bottom of the viewport. While `#top` (the hero) is visible, raly keeps to the right half.

**Key components:**
- `ReactiveHeadline`: "running experiments" rendered by a WebGL2 shader over a signed-distance field of the real glyphs. Each letter moves between seven styles (engraving, interference, wet ink, geometric, marbling, risograph, watercolor), driven by cursor proximity and speed, raly's position, neighbor coupling and a slow idle wave; which style attention brings out rotates over time. Letter tilt is capped and the springs damped so letters sway rather than flip. The DOM keeps the real text for accessibility. Reduced motion or no WebGL2 falls back to plain type.
- `Demos`: four featured demos (Waymo emergency response, AutoLabs, Omelas, Refusal Matrix), then a "more" list. Only one demo is mounted at a time (`demos/Demo.jsx` lazy-loads internal labs or iframes external ones).
- `Works`: projects as numbered specimen plates with `PlateArt` (deterministic SVG line art); AutoLabs is the featured plate.
- `Experience`: a notebook timeline. `Photographs`: a draggable strip of mounted prints with a lightbox; images are served from raphael-photography.vercel.app. `Contact`: an emailjs form on the `SunlitFloor` caustic band.
- `src/raly/tour.js`: raly as a guide. It auto-starts once per browser after 8 s idle on the hero (or with `?tour`, or the nav/hero buttons), scrolls through the sections, draws a hairline mark and caption around each stop, selects the Waymo demo and posts `{type: "replay:play"}` to its iframe. Any real scroll, key, click or touch ends it. Steps are the `STEPS` array.

**Theme tokens:** `tailwind.config.js` defines the journal palette (`paper`, `raised`, `ink-text`, `muted`, `hair`, `cobalt`, `magenta`, `coral`). The old dark-theme token names (`fg`, `panel`, `line`, …) are remapped to paper equivalents so the demo labs follow the theme without edits. Base styles are in `src/index.css`, including the paper halo (a paper-colored outline under each glyph) that keeps page text legible when raly swims behind it.

**Content data** lives in `src/constants/index.js` (`navLinks`, `experiences`, `projects`). Demo entries live in `src/components/Demos.jsx`.

**Deployment:** Vercel project `raphael-khalid-eb4r`, served at raphaelkhalid.com. `vercel.json` permanently redirects the old `raphael-khalid.vercel.app` host to the custom domain. Pushing to `master` deploys.
