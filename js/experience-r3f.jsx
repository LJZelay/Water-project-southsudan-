/**
 * js/experience-r3f.jsx
 * * High-Quality Unified UI Layer.
 * The 3D Canvas has been removed to resolve the "Ghost Layer" camera conflict.
 * Interactive vehicles are now rendered directly in three-init.js for perfect depth and lighting.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { closeDialogueOverlay, useSceneState } from './sceneState.js';

function ExperienceUI() {
  const sceneState = useSceneState();
  const [dialogueLineIndex, setDialogueLineIndex] = React.useState(0);

  // Check if we're in static mode (Scene 5)
  const isStaticMode = sceneState.currentSceneIndex === 5;

  // Interaction State
  const hasSelection = sceneState.selectedPersonId !== null;
  const hasHover = sceneState.hoveredPersonId !== null;
  const dialogueVisible = hasSelection || hasHover;

  // Dialogue Content Logic (Unchanged to preserve your original "Feel")
  const selectedDialogueLines = React.useMemo(() => {
    if (!hasSelection || !sceneState.selectedDialogueText) {
      return [];
    }

    return sceneState.selectedDialogueText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }, [hasSelection, sceneState.selectedDialogueText]);

  // Reset paging when selection changes
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

  // Sync body classes for CSS transitions and mode detection
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('dialogue-active', dialogueVisible && !isStaticMode);
    document.body.classList.toggle('static-mode', isStaticMode);
    return () => {
      document.body.classList.remove('dialogue-active');
      document.body.classList.remove('static-mode');
    };
  }, [dialogueVisible, isStaticMode]);

  // Setup dragging for widgets (Scene 5 static mode only)
  React.useEffect(() => {
    if (!isStaticMode || typeof document === 'undefined') return;

    const metricsWidget = document.getElementById('metrics-widget');
    const liveTimeWidget = document.getElementById('live-time-widget');
    
    const widgets = [metricsWidget, liveTimeWidget].filter(Boolean);
    
    if (widgets.length === 0) return;

    // Store drag state
    let dragState = null;

    const setupDrag = (widget) => {
      const handleMouseDown = (e) => {
        if (e.button !== 0) return; // Only left mouse button
        dragState = {
          widget,
          startX: e.clientX,
          startY: e.clientY,
          elementX: widget.offsetLeft,
          elementY: widget.offsetTop
        };
        widget.classList.add('dragging');
      };

      const handleTouchStart = (e) => {
        const touch = e.touches[0];
        dragState = {
          widget,
          startX: touch.clientX,
          startY: touch.clientY,
          elementX: widget.offsetLeft,
          elementY: widget.offsetTop
        };
        widget.classList.add('dragging');
      };

      const handleMouseMove = (e) => {
        if (!dragState || dragState.widget !== widget) return;
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;
        widget.style.left = (dragState.elementX + deltaX) + 'px';
        widget.style.top = (dragState.elementY + deltaY) + 'px';
        widget.style.right = 'auto';
      };

      const handleTouchMove = (e) => {
        if (!dragState || dragState.widget !== widget) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - dragState.startX;
        const deltaY = touch.clientY - dragState.startY;
        widget.style.left = (dragState.elementX + deltaX) + 'px';
        widget.style.top = (dragState.elementY + deltaY) + 'px';
        widget.style.right = 'auto';
      };

      const handleEnd = () => {
        if (dragState?.widget === widget) {
          dragState = null;
          widget.classList.remove('dragging');
        }
      };

      widget.addEventListener('mousedown', handleMouseDown);
      widget.addEventListener('touchstart', handleTouchStart);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchend', handleEnd);

      return () => {
        widget.removeEventListener('mousedown', handleMouseDown);
        widget.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchend', handleEnd);
      };
    };

    const cleanups = widgets.map(setupDrag);
    return () => cleanups.forEach(cleanup => cleanup?.());
  }, [isStaticMode]);

  function goToNextDialogueLine() {
    if (selectedDialogueLines.length < 2) return;
    setDialogueLineIndex((prev) => (prev + 1) % selectedDialogueLines.length);
  }

  function goToPreviousDialogueLine() {
    if (selectedDialogueLines.length < 2) return;
    setDialogueLineIndex((prev) => (prev - 1 + selectedDialogueLines.length) % selectedDialogueLines.length);
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', pointerEvents: 'none' }}>
      {/* STANDARD DIALOGUE (Hidden in static mode) */}
      {!isStaticMode && (
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
            background: 'rgba(12, 16, 20, 0.85)',
            backdropFilter: 'blur(10px)',
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
            pointerEvents: dialogueVisible ? 'auto' : 'none', 
            zIndex: 9999,
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
                  style={navButtonStyle}
                >
                  {'<'}
                </button>

                <button
                  type="button"
                  onClick={goToNextDialogueLine}
                  aria-label="Next dialogue"
                  style={navButtonStyle}
                >
                  {'>'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FORENSIC GRID (Scene 5 Static Mode) */}
      {isStaticMode && (
        <div className="forensic-grid">
          <div className="forensic-card" style={{ animationDelay: '0.2s' }}>
            <h3>Ecological Rupture</h3>
            <p>The 240km canal has permanently severed the "Sponge" effect, causing a 15% drop in regional humidity.</p>
          </div>
          
          <div className="forensic-card" style={{ animationDelay: '0.4s' }}>
            <h3>Forced Stagnation</h3>
            <p>Trapped water bodies now cluster disease vectors, with schistosomiasis rates exceeding 60% in local cattle herds.</p>
          </div>

          <div className="forensic-card" style={{ animationDelay: '0.6s' }}>
            <h3>Audit Conclusion</h3>
            <p>This infrastructure is not a failure of engineering, but a successful geometry of extraction and displacement.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable style for navigation arrows
const navButtonStyle = {
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
};

// Mount the UI
const rootEl = document.getElementById('r3f-canvas-root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<ExperienceUI />);
}
