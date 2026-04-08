'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useObservatory } from '@/data/provider-context.js';
import { DayNightLighting } from './lighting/DayNightLighting.js';
import { Ground } from './environment/Ground.js';
import { Flora } from './environment/Flora.js';
import { Spores } from './environment/Spores.js';
import { Weather } from './environment/Weather.js';
import { EnergyPool } from './environment/EnergyPool.js';
import { Fossils } from './environment/Fossils.js';
import { Creature } from './creature/Creature.js';

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
        <Flora flora={scene.environment.flora} />
        <Spores spores={scene.environment.spores} />
        <Weather weather={scene.environment.weather} />
        <EnergyPool level={scene.environment.energyPoolLevel} />
        <Fossils fossils={scene.environment.fossils} />

        <Creature creature={scene.creature} />

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
