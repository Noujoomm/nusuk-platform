/**
 * Shared Framer Motion variants for منصة رؤية.
 *
 * Rules baked in here (match the project's motion constraints):
 *   - Animate ONLY `opacity` and `transform` (x/y/scale) — never width/
 *     height/top/left — so nothing triggers layout/paint and FPS stays
 *     at 60.
 *   - Entrance motion is vertical (`y`) by default, which is RTL-neutral.
 *     Horizontal slides use `slideInFromEnd` (positive x → 0 = enters
 *     from the right, the correct "start" edge in RTL).
 *   - Reduced motion is handled GLOBALLY via `<MotionConfig
 *     reducedMotion="user">` (see components/motion/MotionProvider). When
 *     the user prefers reduced motion, Framer keeps opacity transitions
 *     but drops transforms automatically — no per-variant branching
 *     needed here.
 *
 * Durations/easings are intentionally short and soft — motion serves the
 * experience, it doesn't perform.
 */

import type { Variants, Transition } from 'framer-motion';

/** Soft, quick ease used across entrances. */
export const EASE_OUT: Transition['ease'] = [0.22, 1, 0.36, 1];

/** Fade + small rise. The default entrance for cards, sections, rows. */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
};

/** Plain fade — for page-level wrappers where any movement would feel heavy. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/** RTL-aware horizontal entrance: starts to the right, settles in place. */
export const slideInFromEnd: Variants = {
  hidden: { opacity: 0, x: 24 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE_OUT } },
};

/**
 * Stagger container: children with the `staggerItem` variant animate in
 * one after another. `staggerChildren` is the gap between each child.
 */
export const staggerContainer = (stagger = 0.06, delayChildren = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

/** Item inside a `staggerContainer`. */
export const staggerItem: Variants = fadeInUp;

/** Card hover/tap micro-interaction values (used imperatively, not as variants). */
export const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -4, transition: { duration: 0.2, ease: EASE_OUT } },
  tap: { scale: 0.98, transition: { duration: 0.1 } },
};

/** Button/interactive tap. */
export const tapScale = { whileTap: { scale: 0.97 } };
