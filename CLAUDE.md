# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (Vite, localhost:5173)
npm run build     # production build → dist/
npm run preview   # serve the dist/ build locally
npm run lint      # ESLint across src/ (max-warnings 0)
```

No test suite exists. Verify changes by running `npm run build` (catches import/JSX errors) and visually inspecting via `npm run dev`.

## Architecture

Single-page React app built with Vite. All content is on one scrolling page — no routes are used despite `react-router-dom` being installed (only `<BrowserRouter>` wraps the app for `<Link>` in the Navbar).

**Rendering layers (z-index order):**
1. `StarsCanvas` — `position: fixed`, `z-index: 0`, pitch-black background with a rotating WebGL star field. Covers the entire page permanently.
2. Main content div — `z-index: 1`, all sections are `background: transparent` so stars show through.

**Section flow (`App.jsx`):** `Navbar → Hero → Works → Experience → Contact`

**`SectionWrapper` HOC** (`src/hoc/SectionWrapper.jsx`) wraps `Experience` and `Contact`. It adds `max-w-7xl mx-auto` padding, a `whileInView` stagger animation trigger, and injects a `<span id={idName}>` anchor for nav links. Components wrapped with it receive the animation variants from `src/utils/motions.js` automatically.

**Key components:**

- `Hero` — full-viewport intro with typewriter role cycling and a Three.js `KnowledgeGraph` canvas on the right half. The graph renders 7 skill-domain nodes (ML, Complexity, Political Science, etc.) as glowing spheres connected by edges, with `OrbitControls` for drag interaction.

- `Works` — masonry grid. Cards are distributed round-robin across 3 columns so reading order is left-to-right. Each `ProjectCard` uses `whileInView` with `once: true` and column/row-staggered spring delays. Card backgrounds are driven by `ProjectAnim`.

- `ProjectAnim` — pure Canvas 2D. There are 15 unique animation factories (one per project, indexed by `index % 15`). Each factory closes over its own particle/geometry state and returns a `draw(ctx, t)` function called via `requestAnimationFrame`. A `ResizeObserver` re-initialises the factory when the card resizes.

- `Experience` — ladder UI. Each row is a `LadderRung` with expand/collapse via `AnimatePresence`. Two vertical rail lines animate in with `scaleY` on `whileInView`.

- `KnowledgeGraph` — separate Three.js canvas (`@react-three/fiber`). Hover labels are plain DOM `<div>` overlays (not `Html` from drei, which is expensive). Performance hints: `dpr={[1, 1.5]}`, `powerPreference: "high-performance"`, `gl={{ alpha: true }}`.

- `StarsCanvas` — `maath` random sphere distribution, `PointMaterial`, rotates every frame. 4 000 points, `dpr` capped at 1.5.

**Content data** lives entirely in `src/constants/index.js` — `navLinks`, `experiences`, and `projects` arrays. Adding/editing projects or experience entries only requires editing this file.

**Styling:** Tailwind utility classes + `src/index.css` for custom animations (orb drifts, scroll-dot, blink-cursor, per-project blob keyframes). `src/styles.js` exports a `styles` object with shared responsive text/padding class strings.

**Deployment:** Vercel (`.vercel/project.json` present). `npm run build` then push to `master` triggers auto-deploy.
