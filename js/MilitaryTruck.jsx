import { useFrame } from '@react-three/fiber';
import { useRef, useEffect } from 'react';
import { selectPersonWithDialogue, setHoveredPerson, setSceneState } from './sceneState.js';

export default function MilitaryTruck({
  position = [0, -2.08, -21],
  moving = false,
  speed = 0.12,
  maxAdvance = 2.8,
  dialogueId = 'scene2-military-truck',
  dialogue = [
    'Military trucks blockaded the protest site.',
    'Heavy machinery brought by the state symbolized the power imbalance.'
  ]
}) {
  const groupRef = useRef();
  const startZRef = useRef(position[2]);
  const wheelRefs = useRef([]);

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

    if (moving) {
      const targetZ = startZRef.current + maxAdvance;
      group.position.z = Math.min(targetZ, group.position.z + speed * delta);

      // Publish vehicle position so the three.js crowd can react
      try {
        setSceneState({ lastVehicleZ: group.position.z, lastVehicleId: dialogueId, lastVehicleType: 'truck' });
      } catch (err) {
        // ignore if sceneState not available
      }

      wheelRefs.current.forEach((wheel) => {
        if (wheel) {
          wheel.rotation.z -= speed * delta * 5.5;
        }
      });
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
      <mesh castShadow receiveShadow position={[0, 1.05, 0]}>
        <boxGeometry args={[3.4, 0.95, 1.45]} />
        <meshStandardMaterial color="#3a4638" roughness={0.9} metalness={0.08} />
      </mesh>

      <mesh castShadow receiveShadow position={[-0.95, 1.55, 0]}>
        <boxGeometry args={[1.05, 0.85, 1.3]} />
        <meshStandardMaterial color="#4d5a4f" roughness={0.86} metalness={0.1} />
      </mesh>

      <mesh castShadow receiveShadow position={[-0.92, 1.62, 0.67]}>
        <boxGeometry args={[0.72, 0.42, 0.07]} />
        <meshStandardMaterial color="#6b747b" roughness={0.5} metalness={0.25} />
      </mesh>
      <mesh castShadow receiveShadow position={[-0.92, 1.62, -0.67]}>
        <boxGeometry args={[0.72, 0.42, 0.07]} />
        <meshStandardMaterial color="#6b747b" roughness={0.5} metalness={0.25} />
      </mesh>

      <mesh castShadow receiveShadow position={[0.92, 1.47, 0]}>
        <boxGeometry args={[0.8, 0.3, 1.12]} />
        <meshStandardMaterial color="#38433a" roughness={0.92} metalness={0.06} />
      </mesh>

      {[
        [-1.2, 0.5, 0.78],
        [1.15, 0.5, 0.78],
        [-1.2, 0.5, -0.78],
        [1.15, 0.5, -0.78]
      ].map(([x, y, z], index) => (
        <mesh
          key={`wheel-${index}`}
          ref={(el) => {
            wheelRefs.current[index] = el;
          }}
          castShadow
          receiveShadow
          position={[x, y, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.34, 0.34, 0.2, 10]} />
          <meshStandardMaterial color="#2d3135" roughness={0.95} metalness={0.06} />
        </mesh>
      ))}
    </group>
  );
}