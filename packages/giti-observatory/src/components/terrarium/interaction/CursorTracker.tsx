'use client';

import { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  groupRef: React.RefObject<THREE.Group | null>;
  trackingStrength?: number;
}

export function CursorTracker({ groupRef, trackingStrength = 0.15 }: Props) {
  const { camera, pointer } = useThree();
  const targetRotation = useRef(new THREE.Euler(0, 0, 0));
  const raycaster = useRef(new THREE.Raycaster());
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const intersectPoint = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!groupRef.current) return;

    // Project pointer onto ground plane to find cursor world position
    raycaster.current.setFromCamera(pointer, camera);
    raycaster.current.ray.intersectPlane(plane.current, intersectPoint.current);

    // Calculate direction from creature to cursor
    const creaturePos = groupRef.current.position;
    const dx = intersectPoint.current.x - creaturePos.x;
    const dz = intersectPoint.current.z - creaturePos.z;
    const angle = Math.atan2(dx, dz);

    // Smoothly rotate toward cursor
    targetRotation.current.y = angle * trackingStrength;
    targetRotation.current.x =
      -Math.min(0.1, Math.sqrt(dx * dx + dz * dz) * 0.01) * trackingStrength;

    groupRef.current.rotation.y +=
      (targetRotation.current.y - groupRef.current.rotation.y) * 0.05;
    groupRef.current.rotation.x +=
      (targetRotation.current.x - groupRef.current.rotation.x) * 0.05;
  });

  return null;
}
