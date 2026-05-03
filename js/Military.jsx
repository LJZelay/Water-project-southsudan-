import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { getSceneState } from './sceneState.js';

export default function Military({ position = [0, 0, 0], offset = 0 }) {
  const groupRef = useRef();

  useFrame((stateApi) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    const sceneState = getSceneState();
    const time = sceneState.globalTime || stateApi.clock.elapsedTime;
    const flashBoost = sceneState.flashActive ? 0.18 : 0.06;
    group.rotation.y += (Math.PI - group.rotation.y) * THREE.MathUtils.clamp(0.08, 0, 1);
    group.position.y = position[1] + Math.sin(time * 2 + offset) * flashBoost;
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh castShadow receiveShadow position={[0, 1.05, 0]}>
        <capsuleGeometry args={[0.34, 0.82, 4, 8]} />
        <meshStandardMaterial color="#2f3a33" roughness={0.92} metalness={0.04} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.22, 20, 16]} />
        <meshStandardMaterial color="#5d5852" roughness={0.92} metalness={0.03} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.4, 0]}>
        <capsuleGeometry args={[0.12, 0.9, 4, 8]} />
        <meshStandardMaterial color="#32373b" roughness={0.9} metalness={0.04} />
      </mesh>
    </group>
  );
}