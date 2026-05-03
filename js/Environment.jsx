import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

function createTerrainGeometry(width, depth, widthSegments, depthSegments) {
  const geometry = new THREE.PlaneGeometry(width, depth, widthSegments, depthSegments);
  const positions = geometry.attributes.position;

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const ridge = Math.sin(x * 0.18) * 0.55 + Math.cos(y * 0.2) * 0.42;
    const pockets = Math.sin((x + y) * 0.11) * 0.22 + Math.cos((x - y) * 0.08) * 0.18;
    positions.setZ(index, ridge + pockets);
  }

  geometry.computeVertexNormals();
  return geometry;
}

function makePatchSeed(index, radius, spread, centerZ = 0) {
  const angle = (index * 0.78) % Math.PI * 2;
  const distance = radius + Math.sin(index * 1.3) * spread * 0.25;

  return {
    position: [Math.cos(angle) * distance, 0.02, centerZ + Math.sin(angle * 1.2) * spread],
    rotation: [-Math.PI / 2, 0, angle * 0.12],
    scale: 1 + (index % 3) * 0.22
  };
}

export default function Environment({
  fogColor = 0x17384a,
  fogNear = 28,
  fogFar = 110,
  terrainColor = 0x4b8b57,
  waterColor = 0x2e91c7,
  grassColor = 0x6b9f43,
  treeTrunkColor = 0x6a4c31,
  treeLeafColor = 0x315f35
}) {
  const { scene } = useThree();

  useEffect(() => {
    scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);

    return () => {
      scene.fog = null;
    };
  }, []);

  const terrainGeometry = useMemo(() => createTerrainGeometry(64, 48, 48, 36), []);

  const waterPatches = useMemo(() => [
    makePatchSeed(0, 8.5, 8, -8),
    makePatchSeed(1, 9.2, 10, -4),
    makePatchSeed(2, 7.8, 7.5, 5),
    makePatchSeed(3, 6.9, 6, 12)
  ], []);

  const treeSeeds = useMemo(() => [
    [-21, -11],
    [-16, 13],
    [-10, -16],
    [-4, 18],
    [6, -15],
    [12, 14],
    [18, -9],
    [22, 11]
  ], []);

  const grassTufts = useMemo(() => Array.from({ length: 24 }, (_, index) => {
    const x = -26 + (index % 8) * 6.5;
    const z = -18 + Math.floor(index / 8) * 10.5 + (index % 2 ? 0.9 : -0.9);
    return [x, z];
  }), []);

  const fallenSigns = useMemo(() => [
    { position: [-8.5, -2.22, -11.4], rotation: [-Math.PI / 2.1, 0.18, -0.22], size: [1.15, 0.72] },
    { position: [6.8, -2.21, -10.6], rotation: [-Math.PI / 2.4, -0.26, 0.16], size: [1.05, 0.68] },
    { position: [-14.2, -2.2, -1.2], rotation: [-Math.PI / 2.7, 0.36, -0.08], size: [0.96, 0.62] },
    { position: [14.6, -2.2, 1.5], rotation: [-Math.PI / 2.6, -0.3, 0.12], size: [0.98, 0.6] }
  ], []);

  const brokenWoodPieces = useMemo(() => [
    [-9.3, -2.28, -10.7, 0.44, 0.08, 0.08, -0.4],
    [-8.1, -2.29, -11.9, 0.36, 0.07, 0.07, 0.22],
    [7.4, -2.27, -9.9, 0.4, 0.08, 0.09, -0.35],
    [6.1, -2.28, -11.2, 0.33, 0.07, 0.08, 0.46],
    [-13.5, -2.28, -0.3, 0.42, 0.08, 0.08, 0.28],
    [13.9, -2.27, 2.1, 0.39, 0.08, 0.08, -0.3]
  ], []);

  const dirtPatches = useMemo(() => [
    { position: [-5.2, -2.34, -11.7], scale: [1.6, 1, 1.1], rotation: -0.4 },
    { position: [4.4, -2.34, -10.9], scale: [1.75, 1, 1.2], rotation: 0.24 },
    { position: [0.4, -2.34, -12.6], scale: [1.95, 1, 1.35], rotation: -0.12 },
    { position: [-14.1, -2.34, -1.8], scale: [1.25, 1, 0.92], rotation: 0.38 },
    { position: [14.7, -2.34, 1.9], scale: [1.2, 1, 0.9], rotation: -0.34 }
  ], []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.4, 0]} receiveShadow geometry={terrainGeometry}>
        <meshStandardMaterial color={terrainColor} roughness={0.95} metalness={0.02} />
      </mesh>

      {waterPatches.map((patch, index) => (
        <mesh
          key={`water-${index}`}
          rotation={patch.rotation}
          position={patch.position}
          scale={patch.scale}
          receiveShadow
        >
          <circleGeometry args={[1, 34]} />
          <meshStandardMaterial color={waterColor} transparent opacity={0.82} roughness={0.3} metalness={0.2} />
        </mesh>
      ))}

      {dirtPatches.map((patch, index) => (
        <mesh
          key={`dirt-${index}`}
          position={patch.position}
          rotation={[-Math.PI / 2, patch.rotation, 0]}
          scale={patch.scale}
          receiveShadow
        >
          <circleGeometry args={[1, 28]} />
          <meshStandardMaterial color="#3f352d" transparent opacity={0.35} roughness={1} metalness={0} />
        </mesh>
      ))}

      {fallenSigns.map((sign, index) => (
        <group key={`fallen-sign-${index}`} position={sign.position} rotation={sign.rotation}>
          <mesh castShadow receiveShadow>
            <planeGeometry args={sign.size} />
            <meshStandardMaterial color="#cbc09b" roughness={0.96} metalness={0.02} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, -0.03, -0.42]}>
            <boxGeometry args={[0.06, 0.06, 0.86]} />
            <meshStandardMaterial color="#6b4d34" roughness={0.98} />
          </mesh>
        </group>
      ))}

      {brokenWoodPieces.map(([x, y, z, sx, sy, sz, ry], index) => (
        <mesh
          key={`wood-${index}`}
          castShadow
          receiveShadow
          position={[x, y, z]}
          rotation={[0.14, ry, -0.06]}
          scale={[sx, sy, sz]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#5a402d" roughness={0.98} />
        </mesh>
      ))}

      {treeSeeds.map(([x, z], index) => (
        <group key={`tree-${index}`} position={[x, -2.3, z]} rotation={[0, index * 0.37, 0]} scale={0.92 + (index % 3) * 0.12}>
          <mesh castShadow receiveShadow position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.12, 0.18, 2.2, 8]} />
            <meshStandardMaterial color={treeTrunkColor} roughness={0.98} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 2.55, 0]}>
            <coneGeometry args={[0.95, 2.1, 8]} />
            <meshStandardMaterial color={treeLeafColor} roughness={0.9} />
          </mesh>
        </group>
      ))}

      {grassTufts.map(([x, z], index) => (
        <group key={`grass-${index}`} position={[x, -2.35, z]} rotation={[0, index * 0.2, 0]}>
          <mesh castShadow receiveShadow position={[0, 0.14, 0]} scale={[0.14, 0.5 + (index % 3) * 0.08, 0.14]}>
            <coneGeometry args={[0.16, 1, 4]} />
            <meshStandardMaterial color={grassColor} roughness={1} />
          </mesh>
          <mesh castShadow receiveShadow position={[0.12, 0.08, 0.02]} scale={[0.1, 0.4, 0.1]}>
            <coneGeometry args={[0.14, 0.85, 4]} />
            <meshStandardMaterial color="#88b75b" roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}