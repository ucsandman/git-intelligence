'use client';

import { useRef } from 'react';
import { useSpring, animated } from '@react-spring/three';
import type { TimeOfDay } from '@/types/scene';
import * as THREE from 'three';

// @react-spring/three animated wrappers are typed as possibly undefined;
// cast them so TSX accepts them as valid components.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnimatedAmbientLight = animated.ambientLight as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnimatedDirectionalLight = animated.directionalLight as any;

const lightingPresets: Record<
  TimeOfDay,
  { ambient: string; ambientIntensity: number; directional: string; directionalIntensity: number }
> = {
  day: {
    ambient: '#fdf6e3',
    ambientIntensity: 0.4,
    directional: '#fff5db',
    directionalIntensity: 0.8,
  },
  dusk: {
    ambient: '#d4a04a',
    ambientIntensity: 0.25,
    directional: '#e8a040',
    directionalIntensity: 0.5,
  },
  night: {
    ambient: '#1a2a3a',
    ambientIntensity: 0.15,
    directional: '#2a4a6a',
    directionalIntensity: 0.2,
  },
  dawn: {
    ambient: '#c8a070',
    ambientIntensity: 0.3,
    directional: '#e8c090',
    directionalIntensity: 0.6,
  },
};

interface Props {
  timeOfDay: TimeOfDay;
}

export function DayNightLighting({ timeOfDay }: Props) {
  const directionalRef = useRef<THREE.DirectionalLight>(null);
  const preset = lightingPresets[timeOfDay];

  const springs = useSpring({
    ambientIntensity: preset.ambientIntensity,
    directionalIntensity: preset.directionalIntensity,
    config: { duration: 3000 },
  });

  return (
    <>
      <AnimatedAmbientLight
        color={preset.ambient}
        intensity={springs.ambientIntensity}
      />
      <AnimatedDirectionalLight
        ref={directionalRef}
        color={preset.directional}
        intensity={springs.directionalIntensity}
        position={[5, 8, 3]}
        castShadow
      />
      <fog attach="fog" args={['#0f0d0a', 10, 30]} />
    </>
  );
}
