'use client';

/**
 * Stagger primitives — a container whose children animate in one after
 * another as it scrolls into view.
 *
 * Usage:
 *   <StaggerContainer className="grid gap-3">
 *     <StaggerItem>…</StaggerItem>
 *     <StaggerItem>…</StaggerItem>
 *   </StaggerContainer>
 *
 * `<AnimatedCard asStaggerItem>` also works as a stagger child (it carries
 * the same `staggerItem` variant), so cards get entrance + hover in one.
 */

import { motion, type HTMLMotionProps } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/lib/motion/variants';

interface ContainerProps extends HTMLMotionProps<'div'> {
  /** Seconds between each child. Default 0.06. */
  stagger?: number;
  /** Delay before the first child. Default 0. */
  delayChildren?: number;
  /** Re-run the animation every time it scrolls into view. Default false (once). */
  repeat?: boolean;
}

export function StaggerContainer({
  stagger = 0.06,
  delayChildren = 0,
  repeat = false,
  children,
  ...props
}: ContainerProps) {
  return (
    <motion.div
      variants={staggerContainer(stagger, delayChildren)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: !repeat, amount: 0.15 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={staggerItem} style={{ willChange: 'transform' }} {...props}>
      {children}
    </motion.div>
  );
}
