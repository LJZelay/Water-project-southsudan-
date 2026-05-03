import { useFrame } from '@react-three/fiber';
import { useRef, useEffect } from 'react';
import { selectPersonWithDialogue, setHoveredPerson, setSceneState } from './sceneState.js';

export default function Jeep({
  position = [0, -0.18, -18],
  moving = false,
  speed = 0.08,
  stopZ = -14.8,
  switchInterval = 0.3,
  dialogueId = 'scene2-jeep',
  dialogue = [
    'Police vehicles patrolled the protest zone.',
    'Authority enforced the project through visible force and occupation.'
  ]
}) {
  const groupRef = useRef();
  const wheelRefs = useRef([]);
  const redLightRef = useRef();
  const blueLightRef = useRef();
  const timerRef = useRef(0);
  const redActiveRef = useRef(true);

  // Initialize userData on first render
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.userData.dialogue = dialogue;
      groupRef.current.userData.dialogueId = dialogueId;
      groupRef.current.userData.interactive = true;
    }
  }, [dialogueId, dialogue]);

  const handlePointerDown = (e) => {
    e.stopPropagation();
    selectPersonWithDialogue(dialogueId, dialogue.join('\n'));
    setHoveredPerson(dialogueId);
  };

  const handlePointerEnter = (e) => {
    e.stopPropagation();
    setHoveredPerson(dialogueId);
    if (document.body) {
      document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerLeave = () => {
    setHoveredPerson(null);
    if (document.body) {
      document.body.style.cursor = 'default';
    }
  };

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    timerRef.current += delta;
    if (timerRef.current >= switchInterval) {
      timerRef.current = 0;
      redActiveRef.current = !redActiveRef.current;
    }

    if (redLightRef.current) {
      redLightRef.current.intensity = redActiveRef.current ? 4.2 : 0;
    }
    if (blueLightRef.current) {
      blueLightRef.current.intensity = redActiveRef.current ? 0 : 4.2;
    }

    if (moving && group.position.z < stopZ) {
      group.position.z = Math.min(stopZ, group.position.z + speed * delta);
      wheelRefs.current.forEach((wheel) => {
        if (wheel) {
          wheel.rotation.z -= speed * delta * 7;
        }
      });

      // Publish vehicle position so the three.js crowd can react
      try {
        setSceneState({ lastVehicleZ: group.position.z, lastVehicleId: dialogueId, lastVehicleType: 'jeep' });
      } catch (err) {
        // ignore if sceneState not available
      }
    }
  });

  return (
    <group 
      ref={groupRef} 
      position={position}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <mesh castShadow receiveShadow position={[0, 0.9, 0]}>
        <boxGeometry args={[2.1, 0.55, 1.1]} />
        <meshStandardMaterial color="#3f483f" roughness={0.9} metalness={0.08} />
      </mesh>

      <mesh castShadow receiveShadow position={[-0.45, 1.25, 0]}>
        <boxGeometry args={[0.95, 0.42, 1.02]} />
        <meshStandardMaterial color="#59635d" roughness={0.88} metalness={0.1} />
      </mesh>

      <mesh castShadow receiveShadow position={[0.45, 1.25, 0]}>
        <boxGeometry args={[0.75, 0.36, 1]} />
        <meshStandardMaterial color="#4a524c" roughness={0.9} metalness={0.08} />
      </mesh>

      <mesh castShadow receiveShadow position={[-0.2, 1.52, 0]}>
        <boxGeometry args={[0.6, 0.12, 0.22]} />
        <meshStandardMaterial color="#2e3338" roughness={0.75} metalness={0.2} />
      </mesh>

      <pointLight ref={redLightRef} color="#ff2d2d" position={[-0.38, 1.55, 0]} intensity={4.2} distance={9} decay={2} />
      <pointLight ref={blueLightRef} color="#2b6dff" position={[0, 1.55, 0]} intensity={0} distance={9} decay={2} />

      {[
        [-0.7, 0.45, 0.62],
        [0.75, 0.45, 0.62],
        [-0.7, 0.45, -0.62],
        [0.75, 0.45, -0.62]
      ].map(([x, y, z], index) => (
        <mesh
          key={`jeep-wheel-${index}`}
          ref={(el) => {
            wheelRefs.current[index] = el;
          }}
          castShadow
          receiveShadow
          position={[x, y, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.24, 0.24, 0.18, 10]} />
          <meshStandardMaterial color="#2b2f33" roughness={0.96} metalness={0.06} />
        </mesh>
      ))}
    </group>
  );
}