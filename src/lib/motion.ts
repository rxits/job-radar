import type { Variants } from "framer-motion";

export const DECK_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: DECK_EASE } },
};

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: DECK_EASE } },
};

export const drawerVariants: Variants = {
  hidden: { x: "100%" },
  show: { x: 0, transition: { duration: 0.26, ease: DECK_EASE } },
  exit: { x: "100%", transition: { duration: 0.2, ease: DECK_EASE } },
};
