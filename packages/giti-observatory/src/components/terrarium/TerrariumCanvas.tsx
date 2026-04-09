'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useObservatory } from '@/data/provider-context';
import { DayNightLighting } from './lighting/DayNightLighting';
import { Ground } from './environment/Ground';
import { Flora } from './environment/Flora';
import { Spores } from './environment/Spores';
import { Weather } from './environment/Weather';
import { EnergyPool } from './environment/EnergyPool';
import { Fossils } from './environment/Fossils';
import { Creature } from './creature/Creature';

export function TerrariumCanvas() {
  const { scene } = useObservatory();

  if (!scene) return null;

  return (
    <Canvas
      camera={{ position: [0, 3, 6], fov: 50 }}
      dpr={[0.5, 2]}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0a0908' }}
    >
      <Suspense fallback={null}>
        {/* Starfield background for depth and atmosphere */}
        <Stars
          radius={50}
          depth={40}
          count={1500}
          factor={2}
          saturation={0.2}
          fade
          speed={0.3}
        />

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
          minDistance={3}
          maxDistance={15}
          maxPolarAngle={Math.PI / 2.2}
          autoRotate
          autoRotateSpeed={0.15}
        />

        <EffectComposer>
          <Bloom
            luminanceThreshold={0.8}
            luminanceSmoothing={0.4}
            intensity={0.4}
          />
          <Vignette
            eskil={false}
            offset={0.25}
            darkness={0.6}
          />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
