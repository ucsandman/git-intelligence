'use client';

import { useRef, useMemo } from 'react';
import * as THREE from 'three';

interface Props {
  lushness: number; // 0-1
}

export function Ground({ lushness }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);

  const color = useMemo(() => {
    const dry = new THREE.Color('#2a1f14');
    const lush = new THREE.Color('#1a3a14');
    return dry.clone().lerp(lush, lushness);
  }, [lushness]);

  const emissiveColor = useMemo(() => {
    return new THREE.Color('#0a1a0a').multiplyScalar(lushness * 0.3);
  }, [lushness]);

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.5, 0]}
      receiveShadow
    >
      <circleGeometry args={[8, 64]} />
      <meshStandardMaterial
        color={color}
        emissive={emissiveColor}
        roughness={0.9 - lushness * 0.3}
        metalness={0}
      />
    </mesh>
  );
}
