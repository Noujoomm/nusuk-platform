'use client';

/**
 * Animated number count-up for dashboard stats. Counts from 0 → `value`
 * once the element scrolls into view.
 *
 * - Respects reduced motion: jumps straight to the final value.
 * - Drives a state number via Framer's `animate()` (rAF under the hood),
 *   so no layout work — just text content changes.
 * - `format` lets the caller render Arabic-Indic digits, %, separators,
 *   etc. without this component knowing the locale.
 *
 * Usage:
 *   <CountUp value={1280} />
 *   <CountUp value={87.4} decimals={1} format={(n) => `${toArabicIndic(n)}%`} />
 */

import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';

interface CountUpProps {
  value: number;
  /** Decimal places to show while counting. Default 0. */
  decimals?: number;
  /** Seconds. Default 1.2. */
  duration?: number;
  /** Render the current numeric value into a string. Default: localized integer. */
  format?: (n: number) => string;
  className?: string;
}

export function CountUp({
  value,
  decimals = 0,
  duration = 1.2,
  format,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, duration, reduce]);

  const text = format
    ? format(display)
    : display.toLocaleString('ar-SA', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
