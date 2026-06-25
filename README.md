# Raphael Khalid — Portfolio

**Live site:** [raphael-khalid.vercel.app](https://raphael-khalid.vercel.app)

Personal portfolio showcasing projects and work experience across computer science, machine learning, political science, and complexity science.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite 4 |
| Styling | Tailwind CSS 3 + custom CSS |
| Animation | Framer Motion 10 |
| 3D | Three.js via `@react-three/fiber` + `@react-three/drei` |
| Email | EmailJS |
| Deployment | Vercel |

---

## Features

### Hero
- Interactive 3D knowledge graph (Three.js) — 7 skill-domain nodes (Machine Learning, Complexity Science, Political Science, Robotics, Network Theory, Audio AI, Software Dev) rendered as glowing spheres connected by edges. Drag to rotate.
- Typewriter role cycler — cycles through *Computer Scientist · Political Scientist · ML Engineer · Complexity Scientist* with a blinking cyan cursor
- Three subtle radial gradient orbs (teal + violet) with `mix-blend-mode: screen` so they glow additively into the star field
- Staggered entrance animations and parallax scroll on the text block
- Unified pitch-black star field background (`position: fixed`) covering the entire page — all sections are transparent so stars show through continuously

### Projects
- 3-column masonry grid — cards distributed round-robin across columns so reading order is left-to-right
- Cards spring up (`stiffness: 260, damping: 24`) as they scroll into view, staggered by column and row
- 15 unique Canvas 2D animations per card (`ProjectAnim.jsx`): orbital rings, grid waves, particle storms, network pulses, spiral galaxies, and more — one animation per project, running at 60 fps via `requestAnimationFrame`
- Cyan border glow on hover

### Experience
- Ladder UI: two animated vertical rails (scaleY draw-in on scroll) connected by horizontal rungs
- Each rung shows *Company · Title · Date*; hover/click expands bullet points via `AnimatePresence`
- Rungs stagger in from the left with `whileInView`

### Contact
- EmailJS contact form, centred single-column layout

---

## Project structure

```
src/
  components/
    Hero.jsx          # Typewriter, knowledge graph, orbs
    Works.jsx         # Masonry grid, spring card reveals
    Experience.jsx    # Ladder UI with animated rails
    ProjectAnim.jsx   # 15 Canvas 2D animation factories
    Navbar.jsx        # Fades out on scroll, hash-link nav
    Contact.jsx       # EmailJS form
    canvas/
      Stars.jsx       # Fixed full-page WebGL star field
      KnowledgeGraph.jsx  # Interactive 3D skill node graph
  constants/
    index.js          # All project + experience data (edit here)
  hoc/
    SectionWrapper.jsx  # Adds max-width, padding, whileInView to wrapped sections
  utils/
    motions.js        # Reusable Framer Motion variant factories
  styles.js           # Shared Tailwind class strings
  index.css           # Custom keyframe animations (orbs, cursor, blobs)
```

---

## Local development

```bash
npm install
npm run dev      # localhost:5173
npm run build    # production build → dist/
npm run lint     # ESLint (zero warnings policy)
```

Deployed automatically to Vercel on push to `master`.
