import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSceneState } from './sceneState.js';

const clamp = THREE.MathUtils.clamp;

export default function CrowdInstanced({ people = [] }) {
  const bodyMeshRef = useRef();
  const headMeshRef = useRef();
  const dummyRef = useRef(new THREE.Object3D());
  const personStateRef = useRef([]);

  useEffect(() => {
    personStateRef.current = people.map((person) => ({
      basePosition: new THREE.Vector3(person.position[0], person.position[1], person.position[2]),
      position: new THREE.Vector3(person.position[0], person.position[1], person.position[2]),
      velocity: new THREE.Vector3(),
      state: person.state,
      offset: person.offset
    }));
  }, [people]);

  const count = people.length;

  useFrame((stateApi, delta) => {
    const bodyMesh = bodyMeshRef.current;
    const headMesh = headMeshRef.current;
    const dummy = dummyRef.current;

    if (!bodyMesh || !headMesh || personStateRef.current.length === 0) {
      return;
    }

    const sceneState = getSceneState();
    const time = sceneState.globalTime || stateApi.clock.elapsedTime;

    personStateRef.current.forEach((person, index) => {
      const isMoving = person.state === 'walk' || person.state === 'advance' || person.state === 'retreat';
      const direction = person.state === 'retreat' ? -1 : 1;
      const speed = person.state === 'walk' ? 0.8 : person.state === 'advance' ? 1.05 : person.state === 'retreat' ? 0.9 : 0.18;
      const flashMultiplier = sceneState.flashActive ? 0.75 : 1;
      const frontLineZ = sceneState.frontLineZ;

      const targetVelocity = new THREE.Vector3(
        isMoving ? Math.sin((time + person.offset) * 0.6) * 0.04 * speed : 0,
        0,
        isMoving ? 0.9 * speed * direction * flashMultiplier : 0
      );

      person.velocity.lerp(targetVelocity, 0.1);

      person.position.x += person.velocity.x * delta;
      person.position.z += person.velocity.z * delta;

      const targetX = person.basePosition.x;
      const targetY = person.basePosition.y + 0.03 + Math.sin((time + person.offset) * 2.2) * (isMoving ? 0.05 : 0.015);
      person.position.x += (targetX - person.position.x) * clamp(delta * 4, 0, 1);
      person.position.y += (targetY - person.position.y) * clamp(delta * 8, 0, 1);

      const targetYaw = person.state === 'retreat' || person.position.z > frontLineZ ? Math.PI : 0;
      person.rotationY = THREE.MathUtils.lerp(person.rotationY || 0, targetYaw, 0.1);

      const walkAmount = isMoving ? 1 : 0.2;
      const walk = Math.sin((time + person.offset) * (person.state === 'walk' ? 8 : 6.5)) * walkAmount;
      const bodyBob = Math.sin((time + person.offset) * 2.2) * (isMoving ? 0.05 : 0.015);

      dummy.position.set(person.position.x, person.position.y + 1.1 + bodyBob, person.position.z);
      dummy.rotation.set(0, person.rotationY, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bodyMesh.setMatrixAt(index, dummy.matrix);

      dummy.position.set(person.position.x, person.position.y + 1.72 + bodyBob * 0.5, person.position.z);
      dummy.rotation.set(0, person.rotationY, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      headMesh.setMatrixAt(index, dummy.matrix);
    });

    bodyMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
  });

  const bodyGeometry = useMemo(() => new THREE.CapsuleGeometry(0.33, 0.8, 4, 8), []);
  const headGeometry = useMemo(() => new THREE.SphereGeometry(0.22, 20, 16), []);

  return (
    <group>
      <instancedMesh ref={bodyMeshRef} args={[bodyGeometry, null, count]} frustumCulled={false} castShadow receiveShadow>
        <meshStandardMaterial color="#6c4f3d" roughness={0.95} metalness={0.02} />
      </instancedMesh>
      <instancedMesh ref={headMeshRef} args={[headGeometry, null, count]} frustumCulled={false} castShadow receiveShadow>
        <meshStandardMaterial color="#d7b59a" roughness={0.85} />
      </instancedMesh>
    </group>
  );
}