'use client';

/**
 * Scroll-reveal wrapper: its children animate in once they enter the
 * viewport. Pass a `variants` (default fadeInUp) and optionally make it a
 * stagger container for its children.
 *
 * Usage:
 *   <AnimatedSection className="…">…</AnimatedSection>
 *   <AnimatedSection stagger>{cards.map(...)}</AnimatedSection>  // children use `staggerItem`
 */

import { motion, type Variants, type HTMLMotionProps } from 'framer-motion';
import { fadeInUp, staggerContainer } from '@/lib/animations';

interface AnimatedSectionProps extends Omit<HTMLMotionProps<'section'>, 'variants'> {
  variants?: Variants;
  /** Treat as a stagger container (children animate one after another). */
  stagger?: boolean;
  /** Seconds between staggered children. Default 0.08. */
  staggerGap?: number;
  /** Re-run every time it enters view. Default false (animate once). */
  repeat?: boolean;
}

export function AnimatedSection({
  variants,
  stagger = false,
  staggerGap = 0.08,
  repeat = false,
  children,
  ...props
}: AnimatedSectionProps) {
  return (
    <motion.section
      variants={stagger ? staggerContainer(staggerGap) : (variants ?? fadeInUp)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: !repeat, amount: 0.2 }}
      {...props}
    >
      {children}
    </motion.section>
  );
}
