'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { CreatureBody } from './CreatureBody';
import { CreatureOrgans } from './CreatureOrgans';
import { CursorTracker } from '../interaction/CursorTracker';
import type { SceneState } from '@/types/scene';

interface Props {
  creature: SceneState['creature'];
}

export function Creature({ creature }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  // Gentle drift movement
  const driftRef = useRef({ x: 0, z: 0 });
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    // Slow figure-eight drift
    driftRef.current.x = Math.sin(t * 0.1) * 0.5;
    driftRef.current.z = Math.cos(t * 0.15) * 0.3;
    groupRef.current.position.x = driftRef.current.x;
    groupRef.current.position.z = driftRef.current.z;
  });

  return (
    <Float speed={0.8} rotationIntensity={0.1} floatIntensity={0.4}>
      <group
        ref={groupRef}
        position={[0, 0.8, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => {
          setHovered(false);
          setClicked(false);
        }}
        onClick={() => setClicked(!clicked)}
      >
        <CursorTracker groupRef={groupRef} />
        {/* Bioluminescent point light — creature illuminates nearby ground */}
        <pointLight
          color="#4ad4d4"
          intensity={1.5 * creature.bioluminescence}
          distance={6}
          decay={2}
          position={[0, -0.3, 0]}
        />
        <CreatureBody
          mood={creature.mood}
          size={creature.size}
          bioluminescence={creature.bioluminescence}
        />
        <CreatureOrgans
          activeOrgans={creature.activeOrgans}
          maturity={creature.maturity}
        />

        {/* Hover tooltip */}
        {hovered && !clicked && (
          <Html center distanceFactor={8}>
            <div className="bg-terrarium-soil/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-terrarium-text border border-terrarium-soil-light/30 whitespace-nowrap pointer-events-none">
              <span className="capitalize">{creature.mood}</span>
              {' — '}
              Health {Math.round(creature.bioluminescence * 100)}%
            </div>
          </Html>
        )}

        {/* Click detail panel */}
        {clicked && (
          <Html center distanceFactor={8}>
            <div className="bg-terrarium-soil/95 backdrop-blur-sm rounded-organic p-4 text-xs text-terrarium-text border border-terrarium-soil-light/30 w-64 pointer-events-auto">
              <h3 className="font-display text-sm mb-2">Organism Status</h3>
              <div className="space-y-1 text-terrarium-text/70">
                <p>Mood: <span className="text-terrarium-cyan capitalize">{creature.mood}</span></p>
                <p>Maturity: {Math.round(creature.maturity * 100)}%</p>
                <p>Bioluminescence: {Math.round(creature.bioluminescence * 100)}%</p>
                <p>Active systems: {creature.activeOrgans.length > 0 ? creature.activeOrgans.join(', ') : 'resting'}</p>
              </div>
            </div>
          </Html>
        )}
      </group>
    </Float>
  );
}
