'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  level: number; // 0-1
}

export function EnergyPool({ level }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);

  const color = useMemo(
    () => new THREE.Color('#2aa4a4').multiplyScalar(0.3 + level * 0.7),
    [level],
  );

  const emissive = useMemo(
    () => new THREE.Color('#1a6a6a').multiplyScalar(level),
    [level],
  );

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    // Gentle surface ripple
    meshRef.current.position.y = -0.45 + Math.sin(t * 0.5) * 0.02;
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[4, -0.9, -3]}
    >
      <circleGeometry args={[0.4 + level * 0.2, 32]} />
      <meshPhysicalMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={0.2}
        transmission={0.4}
        thickness={0.5}
        roughness={0.1}
        transparent
        opacity={0.3 + level * 0.2}
      />
    </mesh>
  );
}
