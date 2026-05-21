'use client';

/**
 * Card with a soft hover lift + scale and a tap press, plus an optional
 * staggered entrance. Transform/opacity only — no layout shift.
 *
 * Usage:
 *   <AnimatedCard className="glass p-5">…</AnimatedCard>
 *
 *   // Staggered entrance inside a <StaggerContainer>:
 *   <StaggerContainer>
 *     <AnimatedCard asStaggerItem className="glass p-5">…</AnimatedCard>
 *     <AnimatedCard asStaggerItem className="glass p-5">…</AnimatedCard>
 *   </StaggerContainer>
 */

import { motion, type HTMLMotionProps } from 'framer-motion';
import { EASE_OUT, staggerItem } from '@/lib/motion/variants';

interface AnimatedCardProps extends HTMLMotionProps<'div'> {
  /** Enable the hover-lift + tap-press interaction. Default true. */
  interactive?: boolean;
  /** Animate in as a child of a <StaggerContainer>. Default false. */
  asStaggerItem?: boolean;
}

export function AnimatedCard({
  interactive = true,
  asStaggerItem = false,
  children,
  ...props
}: AnimatedCardProps) {
  return (
    <motion.div
      // Entrance is driven by the parent StaggerContainer (hidden→show);
      // hover/tap are inline objects so they coexist with those variants.
      variants={asStaggerItem ? staggerItem : undefined}
      whileHover={interactive ? { scale: 1.02, y: -4 } : undefined}
      whileTap={interactive ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      style={{ willChange: 'transform' }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
