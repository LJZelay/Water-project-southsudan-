import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { setSceneState } from './sceneState.js';

const clamp = THREE.MathUtils.clamp;

const FlashEffect = forwardRef(function FlashEffect(
  {
    duration = 0.22,
    peakIntensity = 8,
    color = 0xfff2cc,
    position = [0, 7, 10]
  },
  ref
) {
  const lightRef = useRef();
  const flashTimerRef = useRef(0);
  const intensityRef = useRef(0);

  useImperativeHandle(ref, () => ({
    triggerFlash() {
      flashTimerRef.current = duration;
      setSceneState({ flashActive: true });
    }
  }), [duration]);

  useFrame((stateApi, delta) => {
    const light = lightRef.current;
    if (!light) {
      return;
    }

    const sceneTime = stateApi.clock.elapsedTime;
    const active = flashTimerRef.current > 0;

    if (active) {
      flashTimerRef.current = Math.max(0, flashTimerRef.current - delta);
    }

    const progress = active ? flashTimerRef.current / duration : 0;
    const targetIntensity = active ? peakIntensity * Math.pow(progress, 0.35) : 0;

    intensityRef.current += (targetIntensity - intensityRef.current) * clamp(delta * 18, 0, 1);
    light.intensity = intensityRef.current;
    light.position.x = position[0] + Math.sin(sceneTime * 18) * 0.02;
    light.position.y = position[1] + Math.cos(sceneTime * 16) * 0.02;
    light.position.z = position[2];

    if (!active && intensityRef.current < 0.01) {
      setSceneState({ flashActive: false });
    }
  });

  return <pointLight ref={lightRef} color={color} position={position} intensity={0} distance={38} decay={2} />;
});

export default FlashEffect;