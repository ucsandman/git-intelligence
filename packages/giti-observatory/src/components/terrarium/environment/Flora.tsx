'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { FloraItem } from '@/types/scene.js';

const floraColors: Record<string, { base: string; emissive: string }> = {
  shrub: { base: '#2a5a20', emissive: '#1a3a10' },
  flower: { base: '#5a3a6a', emissive: '#3a1a4a' },
  vine: { base: '#3a6a4a', emissive: '#1a4a2a' },
};

interface Props {
  flora: FloraItem[];
}

export function Flora({ flora }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const activeFlora = useMemo(
    () => flora.filter((f) => !f.fossilized),
    [flora],
  );

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;

    activeFlora.forEach((item, i) => {
      dummy.position.set(...item.position);
      // Scale based on age (younger = smaller, grows in)
      const ageScale = Math.min(1, item.age * 0.2 + 0.3);
      const typeScale =
        item.type === 'flower' ? 0.6 : item.type === 'vine' ? 0.4 : 0.5;
      // Gentle sway
      const sway = Math.sin(t * 0.5 + i * 0.7) * 0.03;
      dummy.rotation.set(sway, i * 1.3, sway * 0.5);
      dummy.scale.setScalar(ageScale * typeScale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (activeFlora.length === 0) return null;

  // Use the most common flora type for the material
  const dominantType = activeFlora[0]?.type ?? 'shrub';
  const colors = floraColors[dominantType] ?? floraColors['shrub']!;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, activeFlora.length]}
      castShadow
    >
      <coneGeometry args={[0.15, 0.6, 6]} />
      <meshStandardMaterial
        color={colors.base}
        emissive={colors.emissive}
        emissiveIntensity={0.2}
        roughness={0.8}
      />
    </instancedMesh>
  );
}
