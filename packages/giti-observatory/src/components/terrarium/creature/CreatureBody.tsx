'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import bodyVert from './shaders/body.vert';
import bodyFrag from './shaders/body.frag';
import type { CreatureMood } from '@/types/scene';

const moodConfigs: Record<
  CreatureMood,
  { breathSpeed: number; noiseScale: number; displacement: number; baseColor: [number, number, number]; glowColor: [number, number, number] }
> = {
  content: { breathSpeed: 0.4, noiseScale: 1.2, displacement: 0.08, baseColor: [0.15, 0.4, 0.25], glowColor: [0.2, 0.8, 0.7] },
  alert: { breathSpeed: 0.7, noiseScale: 1.5, displacement: 0.12, baseColor: [0.2, 0.45, 0.3], glowColor: [0.3, 0.9, 0.8] },
  excited: { breathSpeed: 1.0, noiseScale: 1.8, displacement: 0.15, baseColor: [0.25, 0.5, 0.35], glowColor: [0.4, 1.0, 0.9] },
  recoiling: { breathSpeed: 0.3, noiseScale: 2.0, displacement: 0.2, baseColor: [0.3, 0.15, 0.1], glowColor: [0.8, 0.2, 0.1] },
  resting: { breathSpeed: 0.2, noiseScale: 0.8, displacement: 0.05, baseColor: [0.1, 0.25, 0.18], glowColor: [0.15, 0.5, 0.4] },
  dormant: { breathSpeed: 0.05, noiseScale: 0.5, displacement: 0.02, baseColor: [0.1, 0.1, 0.1], glowColor: [0.05, 0.1, 0.08] },
};

interface Props {
  mood: CreatureMood;
  size: number;
  bioluminescence: number;
}

export function CreatureBody({ mood, size, bioluminescence }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const config = moodConfigs[mood];

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBreathPhase: { value: 0 },
      uNoiseScale: { value: config.noiseScale },
      uDisplacement: { value: config.displacement },
      uBioluminescence: { value: bioluminescence },
      uBaseColor: { value: new THREE.Vector3(...config.baseColor) },
      uGlowColor: { value: new THREE.Vector3(...config.glowColor) },
    }),
    [], // uniforms object created once, values updated in useFrame
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;
    // Asymmetric breathing: slow inhale (0-60%), fast exhale (60-100%)
    uniforms.uBreathPhase.value = t * config.breathSpeed * Math.PI * 2;
    uniforms.uNoiseScale.value = config.noiseScale;
    uniforms.uDisplacement.value = config.displacement;
    uniforms.uBioluminescence.value = bioluminescence;
    uniforms.uBaseColor.value.set(...config.baseColor);
    uniforms.uGlowColor.value.set(...config.glowColor);
  });

  return (
    <mesh ref={meshRef} scale={size}>
      <icosahedronGeometry args={[1, 5]} />
      <shaderMaterial
        vertexShader={bodyVert}
        fragmentShader={bodyFrag}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
