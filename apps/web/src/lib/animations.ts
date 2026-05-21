/**
 * Landing-page animation variants.
 *
 * Builds on the shared motion variants (`lib/motion/variants`) so there's
 * one source of truth for the common ones, and adds the landing-specific
 * `fadeInRight` (RTL hero entrance) and `scaleIn`. Reduced motion is
 * handled globally by <MotionProvider reducedMotion="user"> at the page
 * root — these variants don't need to branch on it.
 */

import type { Variants } from 'framer-motion';
import { EASE_OUT, fade, fadeInUp, staggerContainer, staggerItem } from './motion/variants';

export { EASE_OUT, fade, fadeInUp, staggerContainer, staggerItem };

/**
 * RTL hero entrance: starts to the RIGHT (positive x) and slides into
 * place — the correct "from the start edge" direction in Arabic.
 */
export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

/** Gentle scale-up + fade. For hero media / 3D wrappers / stat tiles. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: EASE_OUT } },
};
