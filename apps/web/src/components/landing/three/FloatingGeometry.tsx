'use client';

/**
 * The hero's centrepiece: a slowly rotating geodesic icosahedron in Roya
 * blue with a soft wireframe overlay, gently floating and leaning toward
 * the pointer (mouse parallax). Runs INSIDE an R3F <Canvas>.
 *
 * Pointer parallax reads `state.pointer` (normalised -1..1) from the
 * frame loop, so there are no React re-renders per frame. On touch there
 * is no pointer movement, so it simply floats — no special-casing needed.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Icosahedron } from '@react-three/drei';
import * as THREE from 'three';

export function FloatingGeometry() {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    // Constant slow spin…
    group.current.rotation.y += delta * 0.18;
    // …plus an eased lean toward the pointer (parallax).
    const targetX = state.pointer.y * 0.25;
    const targetY = state.pointer.x * 0.35;
    group.current.rotation.x += (targetX - group.current.rotation.x) * 0.05;
    group.current.position.x += (state.pointer.x * 0.4 - group.current.position.x) * 0.04;
    // keep the spin authoritative on Y, only nudge from pointer
    group.current.rotation.y += (targetY) * 0.0;
  });

  return (
    <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.8}>
      <group ref={group}>
        {/* Solid core */}
        <Icosahedron args={[1.4, 1]}>
          <meshStandardMaterial
            color="#1E5BC6"
            metalness={0.35}
            roughness={0.35}
            emissive="#0D47A1"
            emissiveIntensity={0.25}
            flatShading
          />
        </Icosahedron>
        {/* Wireframe shell, slightly larger, warm-tinted */}
        <Icosahedron args={[1.46, 1]}>
          <meshBasicMaterial color="#E1B25F" wireframe transparent opacity={0.18} />
        </Icosahedron>
      </group>
    </Float>
  );
}
