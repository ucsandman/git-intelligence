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
  { ambient: string; ambientIntensity: number; directional: string; directionalIntensity: number; hemiSky: string; hemiGround: string; hemiIntensity: number }
> = {
  day: {
    ambient: '#fdf6e3',
    ambientIntensity: 0.5,
    directional: '#fff5db',
    directionalIntensity: 0.9,
    hemiSky: '#c8daf0',
    hemiGround: '#2a3a14',
    hemiIntensity: 0.3,
  },
  dusk: {
    ambient: '#d4a04a',
    ambientIntensity: 0.35,
    directional: '#e8a040',
    directionalIntensity: 0.6,
    hemiSky: '#e08040',
    hemiGround: '#1a2010',
    hemiIntensity: 0.25,
  },
  night: {
    ambient: '#2a3a4a',
    ambientIntensity: 0.3,
    directional: '#3a5a7a',
    directionalIntensity: 0.3,
    hemiSky: '#1a2a4a',
    hemiGround: '#0a1a0a',
    hemiIntensity: 0.2,
  },
  dawn: {
    ambient: '#c8a070',
    ambientIntensity: 0.4,
    directional: '#e8c090',
    directionalIntensity: 0.7,
    hemiSky: '#d0a080',
    hemiGround: '#1a2a14',
    hemiIntensity: 0.25,
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
      {/* Hemisphere light for natural sky/ground fill */}
      <hemisphereLight
        args={[preset.hemiSky, preset.hemiGround, preset.hemiIntensity]}
      />
      {/* Fog tuned for depth without washing out the scene */}
      <fog attach="fog" args={['#0a0908', 12, 40]} />
    </>
  );
}
