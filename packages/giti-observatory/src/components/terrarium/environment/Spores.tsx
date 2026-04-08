'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SporeItem } from '@/types/scene.js';

interface Props {
  spores: SporeItem[];
}

export function Spores({ spores }: Props) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, colors, count } = useMemo(() => {
    const pos = new Float32Array(spores.length * 3);
    const col = new Float32Array(spores.length * 3);
    spores.forEach((s, i) => {
      pos[i * 3] = s.position[0];
      pos[i * 3 + 1] = s.position[1];
      pos[i * 3 + 2] = s.position[2];
      // Color by status: drifting=cyan, rooted=green, fading=gray
      if (s.status === 'drifting') {
        col[i * 3] = 0.3;
        col[i * 3 + 1] = 0.9;
        col[i * 3 + 2] = 0.7;
      } else if (s.status === 'rooted') {
        col[i * 3] = 0.4;
        col[i * 3 + 1] = 1.0;
        col[i * 3 + 2] = 0.5;
      } else {
        col[i * 3] = 0.3;
        col[i * 3 + 1] = 0.3;
        col[i * 3 + 2] = 0.3;
      }
    });
    return { positions: pos, colors: col, count: spores.length };
  }, [spores]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.elapsedTime;
    const posAttr = pointsRef.current.geometry.attributes['position'];
    if (!posAttr) return;
    const arr = posAttr.array as Float32Array;
    spores.forEach((s, i) => {
      if (s.status === 'drifting') {
        arr[i * 3] = s.position[0] + Math.sin(t * 0.3 + i * 2) * 0.3;
        arr[i * 3 + 1] =
          s.position[1] + Math.sin(t * 0.2 + i * 1.5) * 0.2;
        arr[i * 3 + 2] =
          s.position[2] + Math.cos(t * 0.25 + i * 1.8) * 0.3;
      }
    });
    posAttr.needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        vertexColors
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
