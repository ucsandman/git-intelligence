'use client';

import { useState } from 'react';
import { Html } from '@react-three/drei';
import type { FossilItem } from '@/types/scene.js';

const milestoneLabels: Record<string, string> = {
  'first-cycle': 'First Breath',
  'first-merge': 'First Growth',
  'first-growth-proposal': 'First Idea',
  'first-growth-shipped': 'First Evolution',
  'changes-10': '10 Changes',
  'changes-25': '25 Changes',
  'changes-50': '50 Changes',
  'changes-100': 'Century',
  'first-self-fix': 'Self-Healer',
  'first-self-rejection': 'Self-Aware',
  'ship-of-theseus': 'Ship of Theseus',
};

interface FossilMeshProps {
  fossil: FossilItem;
}

function FossilMesh({ fossil }: FossilMeshProps) {
  const [hovered, setHovered] = useState(false);
  const label = milestoneLabels[fossil.milestone] ?? fossil.milestone;

  return (
    <group position={fossil.position as [number, number, number]}>
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
      >
        <dodecahedronGeometry args={[0.2, 0]} />
        <meshPhysicalMaterial
          color="#d4a04a"
          emissive="#8a6a2a"
          emissiveIntensity={hovered ? 1.0 : 0.4}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>
      {hovered && (
        <Html center distanceFactor={8}>
          <div className="bg-terrarium-soil/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-terrarium-amber border border-terrarium-amber/20 whitespace-nowrap pointer-events-none">
            {label} — Cycle {fossil.cycle}
          </div>
        </Html>
      )}
    </group>
  );
}

interface Props {
  fossils: FossilItem[];
}

export function Fossils({ fossils }: Props) {
  return (
    <group>
      {fossils.map((fossil) => (
        <FossilMesh key={fossil.id} fossil={fossil} />
      ))}
    </group>
  );
}
