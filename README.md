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
| Font | Space Grotesk (Google Fonts) |
| Deployment | Vercel (Node 24) |

---

## Features

### Hero
- Three slow-drifting radial gradient orbs (teal + violet) behind the text
- Typewriter role cycler — cycles through *Computer Scientist · Political Scientist · ML Engineer · Complexity Scientist* at 62 ms/char with a blinking cyan cursor
- Staggered entrance animations (spring easing, 0 / 0.1 / 0.2 s delay)
- Parallax: text drifts up 80 px over the first 500 px of scroll
- Minimalist scroll indicator: 1 px line with an animated travelling dot

### Projects
- Pinned horizontal scroll — the section is ~6 000 px tall; the card strip pans left as you scroll down, driven by `useScroll` + `useTransform`
- 15 unique Canvas 2D animations per card (via `ProjectAnim.jsx`), one per project
- Subtle cyan border glow on hover

### Experience
- Ladder UI: two animated vertical rails (scaleY draw-in on scroll) connected by horizontal rungs
- Each rung shows *Company · Title · Date*; hover/click expands bullet points via `AnimatePresence`
- Rungs stagger in from the left with `whileInView`

### Section transitions
- Hero → Projects: 200 px bottom gradient fade (`transparent → #050816`)
- Projects section: `bg-[#0d0b22]` with 140 px top + bottom fades
- All section reveals use `whileInView + viewport: { once: true, amount: 0.15 }`

---

## Project structure

```
src/
  components/
    Hero.jsx          # Orb hero, typewriter, parallax
    Works.jsx         # Pinned horizontal scroll, project cards
    Experience.jsx    # Ladder UI with animated rails
    ProjectAnim.jsx   # 15 Canvas 2D animation factories
    Navbar.jsx
    Contact.jsx
    canvas/           # Three.js scenes (Stars, Earth, Computers)
  constants/
    index.js          # All project and experience data
  assets/             # Images, logos, icons
  styles.js
  index.css
tailwind.config.js
index.html
```

---

## Local development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

---

## Deployment

Deployed automatically to Vercel on push to `master`. Build command: `vite build`. `vite` is listed under `dependencies` (not `devDependencies`) so Vercel's production install picks it up.
