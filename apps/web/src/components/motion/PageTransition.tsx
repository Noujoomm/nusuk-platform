'use client';

/**
 * Smooth fade between routes. Keyed on the pathname so each navigation
 * re-mounts the wrapper and runs the enter/exit. Uses a plain fade (no
 * horizontal slide) so it's RTL-neutral and never causes layout shift.
 *
 * Wrap the dashboard's {children} once:
 *   <PageTransition>{children}</PageTransition>
 */

import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { fade } from '@/lib/motion/variants';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={fade}
        initial="hidden"
        animate="show"
        exit="exit"
        style={{ willChange: 'opacity' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
