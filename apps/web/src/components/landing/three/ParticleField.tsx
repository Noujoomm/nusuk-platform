'use client';

/**
 * Background particle field for the hero — a slow-drifting cloud of points
 * in Roya-blue + warm gold. Runs INSIDE an R3F <Canvas>.
 *
 * Cheap by design: one BufferGeometry of points, additive blending, a
 * single slow rotation in the frame loop. `count` is set by the parent
 * (lowered on small viewports).
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function ParticleField({ count = 1400 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);

  // Positions + per-point colour (blue mostly, ~15% gold), generated once.
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const blue = new THREE.Color('#3E77D6');
    const gold = new THREE.Color('#E1B25F');
    for (let i = 0; i < count; i++) {
      // Distribute in a soft sphere shell so it reads as depth, not a wall.
      const r = 5 + Math.random() * 7;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const c = Math.random() < 0.15 ? gold : blue;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, colors };
  }, [count]);

  useFrame((_, delta) => {
    if (points.current) {
      // Very slow drift — ambience, not motion sickness.
      points.current.rotation.y += delta * 0.04;
      points.current.rotation.x += delta * 0.012;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
