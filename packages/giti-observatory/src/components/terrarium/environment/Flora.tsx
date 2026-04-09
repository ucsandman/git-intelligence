'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { FloraItem } from '@/types/scene';

const floraColors: Record<string, { base: string; emissive: string }> = {
  shrub: { base: '#3a7a30', emissive: '#2a5a20' },
  flower: { base: '#8a4a9a', emissive: '#6a2a7a' },
  vine: { base: '#4a9a6a', emissive: '#2a6a4a' },
};

interface FloraGroupProps {
  items: FloraItem[];
  type: string;
}

function FloraGroup({ items, type }: FloraGroupProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = floraColors[type] ?? floraColors['shrub']!;

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;

    items.forEach((item, i) => {
      dummy.position.set(...item.position);
      const ageScale = Math.min(1, item.age * 0.2 + 0.3);
      const typeScale = type === 'flower' ? 0.7 : type === 'vine' ? 0.5 : 0.6;
      // Gentle sway — more for vines, less for shrubs
      const swayAmount = type === 'vine' ? 0.06 : type === 'flower' ? 0.04 : 0.02;
      const sway = Math.sin(t * 0.5 + i * 0.7) * swayAmount;
      dummy.rotation.set(sway, i * 1.3, sway * 0.5);
      dummy.scale.setScalar(ageScale * typeScale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (items.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, items.length]}
      castShadow
    >
      {/* Different geometry per flora type */}
      {type === 'shrub' && <sphereGeometry args={[0.2, 8, 8]} />}
      {type === 'flower' && <capsuleGeometry args={[0.06, 0.4, 4, 8]} />}
      {type === 'vine' && <torusGeometry args={[0.15, 0.04, 8, 12]} />}
      <meshStandardMaterial
        color={colors.base}
        emissive={colors.emissive}
        emissiveIntensity={0.5}
        roughness={0.6}
        transparent
        opacity={0.9}
      />
    </instancedMesh>
  );
}

// Flower tops: glowing sphere caps on flower stems
function FlowerTops({ items }: { items: FloraItem[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;

    items.forEach((item, i) => {
      const ageScale = Math.min(1, item.age * 0.2 + 0.3);
      // Position at top of flower stem
      dummy.position.set(
        item.position[0],
        item.position[1] + 0.28 * ageScale * 0.7,
        item.position[2],
      );
      // Gentle bobbing
      const bob = Math.sin(t * 0.8 + i * 1.2) * 0.02;
      dummy.position.y += bob;
      dummy.scale.setScalar(ageScale * 0.45);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (items.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, items.length]}
    >
      <sphereGeometry args={[0.12, 8, 8]} />
      <meshStandardMaterial
        color="#d46aaa"
        emissive="#aa4a8a"
        emissiveIntensity={0.8}
        roughness={0.4}
        transparent
        opacity={0.9}
      />
    </instancedMesh>
  );
}

interface Props {
  flora: FloraItem[];
}

export function Flora({ flora }: Props) {
  const activeFlora = useMemo(
    () => flora.filter((f) => !f.fossilized),
    [flora],
  );

  const grouped = useMemo(() => {
    const shrubs = activeFlora.filter((f) => f.type === 'shrub');
    const flowers = activeFlora.filter((f) => f.type === 'flower');
    const vines = activeFlora.filter((f) => f.type === 'vine');
    return { shrubs, flowers, vines };
  }, [activeFlora]);

  if (activeFlora.length === 0) return null;

  return (
    <group>
      <FloraGroup items={grouped.shrubs} type="shrub" />
      <FloraGroup items={grouped.flowers} type="flower" />
      <FlowerTops items={grouped.flowers} />
      <FloraGroup items={grouped.vines} type="vine" />
    </group>
  );
}
