'use client';

/**
 * Hero 3D scene — R3F <Canvas> with warm lighting, the floating geodesic
 * centrepiece, and a background particle field.
 *
 * Capability gating (the prompt's "smart disable"): on reduced-motion,
 * coarse pointers (touch/mobile), low-core devices, or tiny viewports we
 * DON'T mount the Canvas at all — a static warm gradient stands in. This
 * keeps weak/mobile devices fast and respects accessibility.
 *
 * The whole component is still meant to be lazy-loaded with
 * `next/dynamic(..., { ssr: false })` at the page level so three.js stays
 * out of SSR and the initial bundle.
 */

import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ParticleField } from './ParticleField';
import { FloatingGeometry } from './FloatingGeometry';

function detectCapability(): { canRender: boolean; particleCount: number } {
  if (typeof window === 'undefined') return { canRender: false, particleCount: 0 };
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const small = window.innerWidth < 768;
  const canRender = !reduce && !coarse && cores >= 4 && !small;
  // Scale particle density to the viewport even when we do render.
  const particleCount = window.innerWidth < 1280 ? 800 : 1400;
  return { canRender, particleCount };
}

/** Static warm fallback — also what SSR/first paint shows before mount. */
function GradientFallback() {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(60% 60% at 70% 35%, rgba(30,91,198,0.30), transparent 70%),' +
          'radial-gradient(50% 50% at 30% 70%, rgba(225,178,95,0.14), transparent 70%),' +
          'var(--color-bg-primary)',
      }}
    />
  );
}

export function Hero3DScene() {
  const [state, setState] = useState<{ canRender: boolean; particleCount: number } | null>(null);

  useEffect(() => {
    setState(detectCapability());
  }, []);

  // Pre-mount (and on weak/mobile/reduced-motion): the gradient.
  if (!state || !state.canRender) return <GradientFallback />;

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        {/* Warm key + cool fill so the blue solid + gold wire both read. */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 5, 5]} intensity={1.1} color="#FFE6B8" />
        <directionalLight position={[-5, -3, 2]} intensity={0.5} color="#3E77D6" />
        <ParticleField count={state.particleCount} />
        <FloatingGeometry />
        {/*
          OrbitControls intentionally omitted: drag-to-rotate on a
          full-bleed hero competes with page scroll/touch. The pointer
          parallax in FloatingGeometry provides the interactivity instead.
        */}
      </Canvas>
    </div>
  );
}

export default Hero3DScene;
