'use client';

/**
 * 3D tilt-on-hover card driven by `useMotionValue` + springs (Framer
 * Motion only — no three.js). The element rotates slightly toward the
 * cursor with a soft spring, then settles back on leave.
 *
 * Performance / UX guards:
 *   - Transform only (`rotateX/rotateY`) — composited, no layout shift.
 *   - Disabled when the OS prefers reduced motion (renders a plain div).
 *   - Disabled on touch / coarse pointers (no hover) — pointer math is
 *     meaningless there and would feel janky.
 *
 * Usage:
 *   <TiltCard className="glass p-6"> … </TiltCard>
 *   <TiltCard max={8} className="glass p-6"> … </TiltCard>
 */

import { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  /** Max tilt in degrees. Default 8. */
  max?: number;
}

export function TiltCard({ children, className, max = 8 }: TiltCardProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // Normalised pointer position within the card: -0.5 … 0.5 on each axis.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 200, damping: 18 });
  const sy = useSpring(py, { stiffness: 200, damping: 18 });
  // Vertical pointer → rotateX; horizontal pointer → rotateY (inverted so
  // the card tips *toward* the cursor).
  const rotateX = useTransform(sy, [-0.5, 0.5], [max, -max]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-max, max]);

  // Static fallback for reduced-motion / touch (decided at render; hover
  // can't fire on coarse pointers anyway, but this avoids attaching the
  // handlers at all when the user opted out of motion).
  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return; // skip touch/pen
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const reset = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 800,
        transformStyle: 'preserve-3d',
        willChange: 'transform',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
