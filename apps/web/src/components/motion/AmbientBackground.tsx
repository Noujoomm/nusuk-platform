'use client';

/**
 * Ambient particle field — the lightweight, no-three.js alternative to a
 * WebGL `Scene3DBackground`. A slow "constellation" of drifting dots in
 * Roya-blue + gold, connected by faint lines, drawn on a 2D canvas.
 *
 * Why Canvas 2D instead of three.js: this is decorative ambience on an
 * internal PMO tool. A 2D canvas field gives the same calm, premium feel
 * at ~0 bundle cost, where three.js + R3F + drei would add ~600kB.
 *
 * Performance / UX guards (all the prompt's constraints):
 *   - Renders NOTHING when the user prefers reduced motion, on coarse
 *     pointers (touch / mobile), or on low-core devices (< 4 logical
 *     cores) — the canvas never mounts, zero cost on weak/mobile.
 *   - Particle count + connection distance scale with viewport area.
 *   - The rAF loop pauses while the tab is hidden.
 *   - Pure canvas paint — no DOM/layout work, no React re-renders per
 *     frame. `pointer-events: none` so it never intercepts input.
 *   - Lazy-load it with `next/dynamic(..., { ssr: false })` at the call
 *     site so it stays out of the SSR/initial path.
 */

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  gold: boolean;
}

interface AmbientBackgroundProps {
  /** Cap on particle count (auto-scaled down for small viewports). Default 70. */
  maxParticles?: number;
  className?: string;
}

const BLUE = 'rgba(106, 152, 228,'; // primary-400
const GOLD = 'rgba(225, 178, 95,'; // accent-300
const LINK_DISTANCE = 130;

function isCapable(): boolean {
  if (typeof window === 'undefined') return false;
  // Respect reduced motion.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  // Skip touch / coarse pointers (mobile, tablets) — ambience isn't worth
  // the battery there and the effect reads best with a real viewport.
  if (window.matchMedia?.('(pointer: coarse)').matches) return false;
  // Skip low-core devices as a rough "weak hardware" proxy.
  const cores = navigator.hardwareConcurrency ?? 4;
  if (cores < 4) return false;
  return true;
}

export function AmbientBackground({ maxParticles = 70, className }: AmbientBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isCapable()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles: Particle[] = [];
    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Particle count scales with area, capped.
      const count = Math.min(maxParticles, Math.round((w * h) / 16000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 0.6,
        gold: Math.random() < 0.18, // ~18% warm accent
      }));
    };

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);

      // Faint links between nearby particles (the "constellation").
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DISTANCE) {
            const alpha = (1 - dist / LINK_DISTANCE) * 0.12;
            ctx.strokeStyle = `${BLUE} ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Dots.
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.gold ? GOLD : BLUE} ${p.gold ? 0.5 : 0.4})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      running = !document.hidden;
      if (running) raf = requestAnimationFrame(draw);
      else cancelAnimationFrame(raf);
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [maxParticles]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

export default AmbientBackground;
