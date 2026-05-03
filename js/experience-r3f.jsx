import React from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { setExternalThreeContext } from './three-init.js';
import Environment from './Environment.jsx';
import FlashEffect from './FlashEffect.jsx';
import Jeep from './Jeep.jsx';
import MilitaryTruck from './MilitaryTruck.jsx';
import SceneStateBridge from './SceneStateBridge.jsx';
import { closeDialogueOverlay, useSceneState } from './sceneState.js';

extend({ OrbitControls: ThreeOrbitControls });

function SceneControls() {
  const controlsRef = React.useRef();
  const { camera, gl } = useThree();

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.update();
    }
  });

  return (
    <orbitControls
      ref={controlsRef}
      args={[camera, gl.domElement]}
      enableDamping
      dampingFactor={0.08}
      enablePan
      enableZoom
      enableRotate
      minDistance={3}
      maxDistance={28}
      target={[0, 1.4, -12]}
    />
  );
}

function ExperienceCanvas() {
  const sceneState = useSceneState();
  const currentSceneIndex = sceneState.currentSceneIndex;
  const [dialogueLineIndex, setDialogueLineIndex] = React.useState(0);

  const hasSelection = sceneState.selectedPersonId !== null;
  const hasHover = sceneState.hoveredPersonId !== null;
  const dialogueVisible = hasSelection || hasHover;

  const selectedDialogueLines = React.useMemo(() => {
    if (!hasSelection || !sceneState.selectedDialogueText) {
      return [];
    }

    return sceneState.selectedDialogueText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }, [hasSelection, sceneState.selectedDialogueText]);

  React.useEffect(() => {
    setDialogueLineIndex(0);
  }, [sceneState.selectedPersonId, sceneState.selectedDialogueText]);

  const hasPagedDialogue = hasSelection && selectedDialogueLines.length > 1;
  const safeDialogueIndex = selectedDialogueLines.length > 0
    ? Math.min(dialogueLineIndex, selectedDialogueLines.length - 1)
    : 0;
  const dialogueText = hasSelection
    ? (selectedDialogueLines[safeDialogueIndex] || '...')
    : 'hear my voice! Click on me.';

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.classList.toggle('dialogue-active', dialogueVisible);

    return () => {
      document.body.classList.remove('dialogue-active');
    };
  }, [dialogueVisible]);

  function goToNextDialogueLine() {
    if (selectedDialogueLines.length < 2) {
      return;
    }

    setDialogueLineIndex((prev) => (prev + 1) % selectedDialogueLines.length);
  }

  function goToPreviousDialogueLine() {
    if (selectedDialogueLines.length < 2) {
      return;
    }

    setDialogueLineIndex((prev) => (prev - 1 + selectedDialogueLines.length) % selectedDialogueLines.length);
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        style={{
          position: 'fixed',
          top: '8vh',
          left: '50%',
          transform: dialogueVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-8px)',
          width: 'min(78vw, 980px)',
          minHeight: '92px',
          padding: '18px 26px',
          borderRadius: '22px',
          background: 'rgba(12, 16, 20, 0.72)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
          color: '#f4efe6',
          fontSize: 'clamp(22px, 2.4vw, 34px)',
          fontWeight: 700,
          letterSpacing: '0.03em',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: dialogueVisible ? 1 : 0,
          pointerEvents: 'none',
          zIndex: 20,
          transition: 'opacity 180ms ease, transform 180ms ease'
        }}
      >
        <button
          type="button"
          onClick={closeDialogueOverlay}
          aria-label="Close dialogue"
          style={{
            position: 'absolute',
            top: '10px',
            right: '12px',
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.1)',
            color: '#f4efe6',
            borderRadius: '10px',
            width: '34px',
            height: '34px',
            fontSize: '20px',
            lineHeight: 1,
            cursor: 'pointer',
            pointerEvents: 'auto',
            display: dialogueVisible ? 'inline-flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          X
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', gap: '10px', paddingRight: '44px' }}>
          <span style={{ whiteSpace: 'pre-line', width: '100%' }}>{dialogueText}</span>

          {hasPagedDialogue && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%' }}>
              <button
                type="button"
                onClick={goToPreviousDialogueLine}
                aria-label="Previous dialogue"
                style={{
                  border: '1px solid rgba(255,255,255,0.22)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#f4efe6',
                  borderRadius: '10px',
                  width: '34px',
                  height: '34px',
                  fontSize: '18px',
                  lineHeight: 1,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  flexShrink: 0
                }}
              >
                {'<'}
              </button>

              <button
                type="button"
                onClick={goToNextDialogueLine}
                aria-label="Next dialogue"
                style={{
                  border: '1px solid rgba(255,255,255,0.22)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#f4efe6',
                  borderRadius: '10px',
                  width: '34px',
                  height: '34px',
                  fontSize: '18px',
                  lineHeight: 1,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  flexShrink: 0
                }}
              >
                {'>'}
              </button>
            </div>
          )}
        </div>
      </div>

    <Canvas
      id="three-canvas"
      camera={{ position: [0, 2, 5], fov: 60 }}
      dpr={[1, 1.25]}
      onCreated={({ scene, camera, gl }) => {
        setExternalThreeContext({
          scene,
          camera,
          renderer: gl,
          canvas: gl.domElement
        });

        if (window.__resolveR3FBridgeReady) {
          window.__resolveR3FBridgeReady();
          window.__resolveR3FBridgeReady = null;
        }
      }}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
    >
      <SceneControls />
      <Environment />
      <FlashEffect />
      {currentSceneIndex === 2 && (
        <>
          <MilitaryTruck 
            position={[-8.5, -0.16, -21.6]} 
            moving 
            speed={0.1} 
            maxAdvance={2.2}
            dialogueId="scene2-truck-1"
            dialogue={[
              'Military trucks advanced on the protest site.',
              'Heavy vehicles symbolized state power overwhelming civilian resistance.'
            ]}
          />
          <MilitaryTruck 
            position={[0, -0.16, -20.8]}
            dialogueId="scene2-truck-2"
            dialogue={[
              'The military occupied the strategic protesting area.',
              'Development projects were protected by overwhelming military presence.'
            ]}
          />
          <MilitaryTruck 
            position={[8.5, -0.16, -21.3]}
            dialogueId="scene2-truck-3"
            dialogue={[
              'Armed forces blockaded civilian access to the canal.',
              'State machinery was deployed to suppress dissent.'
            ]}
          />

          <Jeep 
            position={[-13.5, -0.18, -13.6]}
            dialogueId="scene2-jeep-1"
            dialogue={[
              'Police vehicles patrolled to intimidate protesters.',
              'Authorities enforced the project through visible occupation.'
            ]}
          />
          <Jeep 
            position={[13.2, -0.18, -13.1]}
            dialogueId="scene2-jeep-2"
            dialogue={[
              'Security forces blocked escape routes.',
              'The police maintained control over the protest space.'
            ]}
          />
          <Jeep 
            position={[9.5, -0.18, -21.8]} 
            moving 
            speed={0.32} 
            stopZ={-14.2}
            dialogueId="scene2-jeep-3"
            dialogue={[
              'Mobile police units moved to contain the demonstration.',
              'Armed police enforced order through presence and readiness.'
            ]}
          />
        </>
      )}

      <SceneStateBridge frontLineZ={-14} />
    </Canvas>
    </div>
  );
}

const rootEl = document.getElementById('r3f-canvas-root');
if (rootEl) {
  if (!window.__r3fBridgeReady) {
    window.__r3fBridgeReady = new Promise((resolve) => {
      window.__resolveR3FBridgeReady = resolve;
    });
  }

  const root = createRoot(rootEl);
  root.render(<ExperienceCanvas />);
}
