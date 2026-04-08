'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WeatherType } from '@/types/scene';

interface Props {
  weather: WeatherType;
}

const PARTICLE_COUNT = 200;

export function Weather({ weather }: Props) {
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = Math.random() * 10;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    return arr;
  }, []);

  useFrame(() => {
    if (!pointsRef.current || weather === 'sunny') return;
    const posAttr = pointsRef.current.geometry.attributes['position'];
    if (!posAttr) return;
    const arr = posAttr.array as Float32Array;

    const speed = weather === 'storm' ? 0.15 : 0.05;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const yIdx = i * 3 + 1;
      const y = (arr[yIdx] ?? 0) - speed;
      arr[yIdx] = y;
      if (y < -0.5) {
        arr[yIdx] = 8 + Math.random() * 2;
        arr[i * 3] = (Math.random() - 0.5) * 16;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 16;
      }
    }
    posAttr.needsUpdate = true;
  });

  if (weather === 'sunny') {
    // Stationary additive sunlight motes
    return (
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.03}
          color="#fff5db"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    );
  }

  if (weather === 'fog') return null; // Handled by fog in DayNightLighting

  // Rain (overcast) or storm
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={weather === 'storm' ? 0.04 : 0.02}
        color={weather === 'storm' ? '#8ab4d4' : '#6a94b4'}
        transparent
        opacity={weather === 'storm' ? 0.6 : 0.3}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
