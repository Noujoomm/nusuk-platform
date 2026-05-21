'use client';

/**
 * Shimmer skeleton placeholder — a softer load state than a spinner.
 *
 * The shimmer is a `transform: translateX` sweep (GPU-composited, no
 * layout/paint), and it's disabled under `prefers-reduced-motion` (a
 * static muted block remains). RTL-aware: the sweep travels right→left.
 *
 * Usage:
 *   <Skeleton className="h-5 w-32" />
 *   <Skeleton className="h-24 w-full rounded-2xl" />
 */

import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-white/[0.06]',
        // The sweep is defined in globals.css as `.shimmer` so it can be
        // killed by the prefers-reduced-motion media query there.
        'shimmer',
        className,
      )}
      aria-hidden
    />
  );
}
