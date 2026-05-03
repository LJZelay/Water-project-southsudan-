import { useFrame } from '@react-three/fiber';
import { setSceneState } from './sceneState.js';

export default function SceneStateBridge({ frontLineZ = -14 }) {
  useFrame((stateApi) => {
    setSceneState({
      frontLineZ,
      globalTime: stateApi.clock.elapsedTime
    });
  });

  return null;
}