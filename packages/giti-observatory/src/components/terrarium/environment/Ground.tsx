'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const groundVertShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const groundFragShader = `
uniform vec3 uCenterColor;
uniform vec3 uEdgeColor;
uniform vec3 uGlowColor;
uniform float uGlowIntensity;
uniform float uTime;
varying vec2 vUv;

void main() {
  // Distance from center (uv 0.5,0.5)
  float dist = length(vUv - 0.5) * 2.0;

  // Radial gradient: lighter center, darker edges
  vec3 color = mix(uCenterColor, uEdgeColor, smoothstep(0.0, 1.0, dist));

  // Center emissive glow (where creature sits) with subtle pulse
  float pulse = sin(uTime * 0.4) * 0.15 + 0.85;
  float glowMask = 1.0 - smoothstep(0.0, 0.35, dist);
  color += uGlowColor * glowMask * uGlowIntensity * pulse;

  // Soft edge fade
  float edgeFade = 1.0 - smoothstep(0.85, 1.0, dist);

  gl_FragColor = vec4(color, edgeFade);
}
`;

interface Props {
  lushness: number; // 0-1
}

export function Ground({ lushness }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => {
    const dry = new THREE.Color('#2a1f14');
    const lush = new THREE.Color('#1a3a14');
    const center = dry.clone().lerp(lush, lushness).multiplyScalar(1.4);
    const edge = dry.clone().lerp(lush, lushness).multiplyScalar(0.5);
    return {
      uCenterColor: { value: center },
      uEdgeColor: { value: edge },
      uGlowColor: { value: new THREE.Color('#1a6a5a') },
      uGlowIntensity: { value: 0.15 + lushness * 0.25 },
      uTime: { value: 0 },
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    // Update lushness-dependent values
    const dry = new THREE.Color('#2a1f14');
    const lush = new THREE.Color('#1a3a14');
    uniforms.uCenterColor.value.copy(dry).lerp(lush, lushness).multiplyScalar(1.4);
    uniforms.uEdgeColor.value.copy(dry).lerp(lush, lushness).multiplyScalar(0.5);
    uniforms.uGlowIntensity.value = 0.15 + lushness * 0.25;
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.5, 0]}
      receiveShadow
    >
      <circleGeometry args={[12, 64]} />
      <shaderMaterial
        vertexShader={groundVertShader}
        fragmentShader={groundFragShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}
