import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getSceneState, selectPerson } from './sceneState.js';

const clamp = THREE.MathUtils.clamp;
const baseTorsoColor = new THREE.Color('#6c4f3d');
const selectedTorsoColor = new THREE.Color('#85604b');
const baseSkinColor = new THREE.Color('#d7b59a');
const selectedSkinColor = new THREE.Color('#ead1bb');
const baseArmColor = new THREE.Color('#7a5c49');
const selectedArmColor = new THREE.Color('#94705a');
const baseLegColor = new THREE.Color('#34495e');
const selectedLegColor = new THREE.Color('#4a6272');

export default function Person({
  id = 0,
  position = [0, 0, 0],
  state = 'idle',
  offset = 0,
  onPersonClick
}) {
  const meshRef = useRef();
  const velocityRef = useRef(new THREE.Vector3());
  const basePositionRef = useRef(new THREE.Vector3(position[0], position[1], position[2]));
  const leftArmRef = useRef();
  const rightArmRef = useRef();
  const leftLegRef = useRef();
  const rightLegRef = useRef();
  const headRef = useRef();
  const torsoRef = useRef();
  const torsoMaterialRef = useRef();
  const skinMaterialRef = useRef();
  const armMaterialRef = useRef();
  const legMaterialRef = useRef();
  const hoverRef = useRef(false);
  const selectedRingRef = useRef();

  useEffect(() => {
    basePositionRef.current.set(position[0], position[1], position[2]);
  }, [position]);

  function handlePersonClick(clickedId) {
    selectPerson(clickedId);
    if (typeof onPersonClick === 'function') {
      onPersonClick(clickedId);
    }
  }

  function updateCursor(isHovering) {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.style.cursor = isHovering ? 'pointer' : 'default';
  }

  useFrame((stateApi, delta) => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    const sceneState = getSceneState();
    const time = (sceneState.globalTime || stateApi.clock.elapsedTime) + offset;
    const basePosition = basePositionRef.current;
    const velocity = velocityRef.current;
    const isMoving = state === 'walk' || state === 'advance' || state === 'retreat';
    const direction = state === 'retreat' ? -1 : 1;
    const speed = state === 'walk' ? 0.8 : state === 'advance' ? 1.05 : state === 'retreat' ? 0.9 : 0.18;
    const flashMultiplier = sceneState.flashActive ? 0.75 : 1;
    const frontLineZ = sceneState.frontLineZ;
    const isSelected = sceneState.selectedPersonId === id;

    if (selectedRingRef.current) {
      selectedRingRef.current.visible = isSelected;
      selectedRingRef.current.scale.setScalar(isSelected ? 1.15 : 1);
    }

    if (mesh.scale) {
      const targetScale = isSelected ? 1.07 : 1;
      mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
    }

    if (torsoMaterialRef.current) {
      torsoMaterialRef.current.color.lerp(isSelected ? selectedTorsoColor : baseTorsoColor, 0.14);
    }

    if (skinMaterialRef.current) {
      skinMaterialRef.current.color.lerp(isSelected ? selectedSkinColor : baseSkinColor, 0.14);
    }

    if (armMaterialRef.current) {
      armMaterialRef.current.color.lerp(isSelected ? selectedArmColor : baseArmColor, 0.14);
    }

    if (legMaterialRef.current) {
      legMaterialRef.current.color.lerp(isSelected ? selectedLegColor : baseLegColor, 0.14);
    }

    const targetVelocity = new THREE.Vector3(
      isMoving ? Math.sin(time * 0.6) * 0.04 * speed : 0,
      0,
      isMoving ? 0.9 * speed * direction * flashMultiplier : 0
    );

    velocity.lerp(targetVelocity, 0.1);

    mesh.position.x += velocity.x * delta;
    mesh.position.z += velocity.z * delta;

    const targetX = basePosition.x;
    const targetY = basePosition.y + 0.03 + Math.sin(time * 2.2) * (isMoving ? 0.05 : 0.015);
    mesh.position.x += (targetX - mesh.position.x) * clamp(delta * 4, 0, 1);
    mesh.position.y += (targetY - mesh.position.y) * clamp(delta * 8, 0, 1);

    const targetYaw = state === 'retreat' || mesh.position.z > frontLineZ ? Math.PI : 0;
    mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, targetYaw, 0.1);

    const walkAmount = isMoving ? 1 : 0.2;
    const walk = Math.sin(time * (state === 'walk' ? 8 : 6.5)) * walkAmount;
    const armSwing = walk * 0.55;
    const legSwing = walk * 0.75;

    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = -0.15 + armSwing;
      leftArmRef.current.rotation.z = 0.05 * Math.sin(time * 2.5);
    }

    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = -0.15 - armSwing;
      rightArmRef.current.rotation.z = -0.05 * Math.sin(time * 2.5);
    }

    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = 0.05 - legSwing;
    }

    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = 0.05 + legSwing;
    }

    if (headRef.current) {
      headRef.current.rotation.x = Math.sin(time * 1.5) * 0.03;
      headRef.current.rotation.y = Math.sin(time * 0.9) * 0.08;
    }

    if (torsoRef.current) {
      torsoRef.current.rotation.x = Math.sin(time * 1.8) * 0.03;
    }
  });

  return (
    <group
      ref={meshRef}
      position={position}
      onPointerOver={(event) => {
        event.stopPropagation();
        hoverRef.current = true;
        updateCursor(true);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        hoverRef.current = false;
        updateCursor(false);
      }}
      onClick={(event) => {
        event.stopPropagation();
        handlePersonClick(id);
      }}
    >
      <mesh ref={selectedRingRef} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.48, 0.76, 28]} />
        <meshBasicMaterial color="#fff6d7" transparent opacity={0.5} />
      </mesh>

      <mesh position={[0, 1.38, 0]} visible={true}>
        <sphereGeometry args={[0.95, 16, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <group ref={torsoRef} position={[0, 1.1, 0]}>
        <mesh castShadow receiveShadow>
          <capsuleGeometry args={[0.33, 0.8, 4, 8]} />
          <meshStandardMaterial ref={torsoMaterialRef} color="#6c4f3d" roughness={0.95} metalness={0.02} />
        </mesh>
      </group>

      <group ref={headRef} position={[0, 1.72, 0]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.22, 20, 16]} />
          <meshStandardMaterial ref={skinMaterialRef} color="#d7b59a" roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.03, 0.16]}>
          <boxGeometry args={[0.08, 0.04, 0.02]} />
          <meshStandardMaterial color="#1d1d1d" />
        </mesh>
      </group>

      <group ref={leftArmRef} position={[-0.44, 1.42, 0]}>
        <mesh castShadow receiveShadow position={[0, -0.18, 0]}>
          <capsuleGeometry args={[0.09, 0.34, 4, 8]} />
          <meshStandardMaterial ref={armMaterialRef} color="#7a5c49" roughness={0.98} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, -0.56, 0]}>
          <capsuleGeometry args={[0.07, 0.3, 4, 8]} />
          <meshStandardMaterial ref={skinMaterialRef} color="#d7b59a" roughness={0.9} />
        </mesh>
      </group>

      <group ref={rightArmRef} position={[0.44, 1.42, 0]}>
        <mesh castShadow receiveShadow position={[0, -0.18, 0]}>
          <capsuleGeometry args={[0.09, 0.34, 4, 8]} />
          <meshStandardMaterial ref={armMaterialRef} color="#7a5c49" roughness={0.98} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, -0.56, 0]}>
          <capsuleGeometry args={[0.07, 0.3, 4, 8]} />
          <meshStandardMaterial ref={skinMaterialRef} color="#d7b59a" roughness={0.9} />
        </mesh>
      </group>

      <group ref={leftLegRef} position={[-0.16, 0.66, 0]}>
        <mesh castShadow receiveShadow position={[0, -0.2, 0]}>
          <capsuleGeometry args={[0.1, 0.4, 4, 8]} />
          <meshStandardMaterial ref={legMaterialRef} color="#34495e" roughness={0.95} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, -0.62, 0]}>
          <capsuleGeometry args={[0.09, 0.35, 4, 8]} />
          <meshStandardMaterial ref={legMaterialRef} color="#263238" roughness={0.98} />
        </mesh>
      </group>

      <group ref={rightLegRef} position={[0.16, 0.66, 0]}>
        <mesh castShadow receiveShadow position={[0, -0.2, 0]}>
          <capsuleGeometry args={[0.1, 0.4, 4, 8]} />
          <meshStandardMaterial ref={legMaterialRef} color="#34495e" roughness={0.95} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, -0.62, 0]}>
          <capsuleGeometry args={[0.09, 0.35, 4, 8]} />
          <meshStandardMaterial ref={legMaterialRef} color="#263238" roughness={0.98} />
        </mesh>
      </group>

    </group>
  );
}