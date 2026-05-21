'use client';

/**
 * App-wide motion config. `reducedMotion="user"` makes EVERY Framer
 * Motion component automatically respect the OS "reduce motion" setting:
 * transform/layout animations are dropped, opacity transitions are kept.
 * Wrap the dashboard (and auth screens) once with this and no individual
 * component needs its own reduced-motion branch.
 */

import { MotionConfig } from 'framer-motion';

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
