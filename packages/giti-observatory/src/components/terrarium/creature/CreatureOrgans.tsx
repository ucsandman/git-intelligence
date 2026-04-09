'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';

// @react-spring/three animated wrappers need casts for R3F intrinsic elements
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnimatedMesh = animated.mesh as any;

interface OrganProps {
  name: string;
  position: [number, number, number];
  color: string;
  emissiveColor: string;
  scale: number;
  active: boolean;
  maturity: number;
}

function Organ({ name, position, color: _color, emissiveColor, scale, active, maturity }: OrganProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const springs = useSpring({
    emissiveIntensity: active ? 1.0 : 0.3,
    scale: active ? scale * 1.3 : scale,
    config: { tension: 120, friction: 14 },
  });

  useFrame((state) => {
    if (!meshRef.current) return;
    // Subtle independent breathing offset per organ
    const t = state.clock.elapsedTime;
    const offset = name.length * 0.7; // deterministic offset from name
    meshRef.current.scale.setScalar(
      (springs.scale.get()) * (1 + Math.sin(t * 0.6 + offset) * 0.03),
    );
  });

  // Only visible once maturity reaches a threshold
  if (maturity < 0.1) return null;

  return (
    <AnimatedMesh ref={meshRef} position={position} renderOrder={2}>
      <sphereGeometry args={[0.10, 12, 12]} />
      <meshBasicMaterial
        color={emissiveColor}
        transparent
        opacity={Math.min(0.7, maturity * 1.5) * (active ? 1.0 : 0.4)}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </AnimatedMesh>
  );
}

interface Props {
  activeOrgans: string[];
  maturity: number;
}

const organConfigs: Array<{
  name: string;
  position: [number, number, number];
  color: string;
  emissiveColor: string;
  scale: number;
  minMaturity: number;
}> = [
  { name: 'sensory-cortex', position: [0, 0.6, 0.4], color: '#4ad4d4', emissiveColor: '#2aa4a4', scale: 0.8, minMaturity: 0 },
  { name: 'prefrontal-cortex', position: [0, 0.2, 0], color: '#d4d44a', emissiveColor: '#a4a42a', scale: 1.0, minMaturity: 0.1 },
  { name: 'memory', position: [0, -0.1, -0.2], color: '#a44ad4', emissiveColor: '#742aa4', scale: 0.9, minMaturity: 0.15 },
  { name: 'motor-cortex', position: [0.4, 0, 0.2], color: '#4ad474', emissiveColor: '#2aa454', scale: 0.7, minMaturity: 0.2 },
  { name: 'immune-system', position: [-0.4, 0.1, 0.1], color: '#d44a4a', emissiveColor: '#a42a2a', scale: 0.75, minMaturity: 0.25 },
  { name: 'growth-hormone', position: [0.2, 0.5, -0.3], color: '#4ad4a4', emissiveColor: '#2aa474', scale: 0.6, minMaturity: 0.3 },
];

export function CreatureOrgans({ activeOrgans, maturity }: Props) {
  return (
    <group>
      {organConfigs
        .filter((o) => maturity >= o.minMaturity)
        .map((organ) => (
          <Organ
            key={organ.name}
            name={organ.name}
            position={organ.position}
            color={organ.color}
            emissiveColor={organ.emissiveColor}
            scale={organ.scale}
            active={activeOrgans.includes(organ.name)}
            maturity={maturity}
          />
        ))}
    </group>
  );
}
