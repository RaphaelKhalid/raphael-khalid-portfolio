// One easing token and one duration scale, reused everywhere.
// Entrances resolve blur -> sharp as well as up -> place: fading alone reads
// as a slideshow, a de-focusing blur reads as something arriving.
const EASE_OUT = [0.16, 1, 0.3, 1];

export const DURATION = { fast: 0.16, base: 0.32, slow: 0.64, entrance: 0.9 };
export const STAGGER = 0.075;

export const reveal = (delay = 0, travel = 20) => ({
  hidden: { opacity: 0, y: travel, filter: "blur(7px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: DURATION.entrance, delay, ease: EASE_OUT },
  },
});

export const textVariant = (delay = 0) => ({
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: DURATION.entrance, delay, ease: EASE_OUT },
  },
});

// Signature kept for existing call sites. `type` is ignored: everything on the
// page now shares one curve, which is most of why a set of animations reads as
// a system rather than as a pile of effects.
export const fadeIn = (direction, _type, delay = 0, duration = DURATION.entrance) => ({
  hidden: {
    opacity: 0,
    filter: "blur(7px)",
    x: direction === "left" ? 24 : direction === "right" ? -24 : 0,
    y: direction === "up" ? 24 : direction === "down" ? -24 : 0,
  },
  show: {
    opacity: 1,
    filter: "blur(0px)",
    x: 0,
    y: 0,
    transition: { duration, delay, ease: EASE_OUT },
  },
});

export const zoomIn = (delay = 0, duration = DURATION.slow) => ({
  hidden: { opacity: 0, scale: 0.94, filter: "blur(6px)" },
  show: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration, delay, ease: EASE_OUT },
  },
});

export const slideIn = (direction, _type, delay = 0, duration = DURATION.entrance) => ({
  hidden: {
    x: direction === "left" ? "-100%" : direction === "right" ? "100%" : 0,
    y: direction === "up" ? "100%" : direction === "down" ? "100%" : 0,
  },
  show: { x: 0, y: 0, transition: { duration, delay, ease: EASE_OUT } },
});

// Cap the total: never let the eighth sibling wait most of a second.
export const staggerContainer = (staggerChildren = STAGGER, delayChildren = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren, delayChildren } },
});
