'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useObservatory } from '@/data/provider-context.js';
import { DayNightLighting } from './lighting/DayNightLighting.js';
import { Ground } from './environment/Ground.js';

export function TerrariumCanvas() {
  const { scene } = useObservatory();

  if (!scene) return null;

  return (
    <Canvas
      camera={{ position: [0, 4, 8], fov: 50 }}
      dpr={[0.5, 2]}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0f0d0a' }}
    >
      <Suspense fallback={null}>
        <DayNightLighting timeOfDay={scene.environment.timeOfDay} />
        <Ground lushness={scene.environment.groundLushness} />

        {/* Creature placeholder — Phase 4 */}
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.5 * scene.creature.size, 32, 32]} />
          <meshPhysicalMaterial
            color="#2a6a4a"
            transmission={0.6}
            thickness={1.5}
            roughness={0.2}
            emissive="#1a4a3a"
            emissiveIntensity={scene.creature.bioluminescence * 0.5}
          />
        </mesh>

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={4}
          maxDistance={15}
          maxPolarAngle={Math.PI / 2.2}
          autoRotate
          autoRotateSpeed={0.3}
        />

        <EffectComposer>
          <Bloom
            luminanceThreshold={0.6}
            luminanceSmoothing={0.9}
            intensity={0.8}
          />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
