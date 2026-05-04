/**
 * navigation.js
 * Scene navigation via arrow buttons and keyboard
 */

import { debounce } from './utils.js';

let currentSceneIndex = 0;
let onSceneChange = null;
let isNavigating = false;

const MAX_SCENES = 8;

/**
 * Initialize navigation handler
 */
export function initNavigation(sceneChangeCallback) {
  onSceneChange = sceneChangeCallback;

  const prevBtn = document.getElementById('nav-prev');
  const nextBtn = document.getElementById('nav-next');

  if (!prevBtn || !nextBtn) {
    console.warn('Navigation buttons not found');
    return;
  }

  // Helper to attach both click and touch listeners
  function attachButtonListener(btn, callback) {
    btn.addEventListener('click', callback, { passive: false });
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      callback();
    }, { passive: false });
  }

  attachButtonListener(prevBtn, () => goToPreviousScene());
  attachButtonListener(nextBtn, () => goToNextScene());

  // Keyboard navigation
  document.addEventListener('keydown', handleKeyboard);
  // If the page was loaded with a ?scene= query param, initialize internal index
  try {
    const params = new URLSearchParams(window.location.search);
    const parsed = Number.parseInt(params.get('scene') || '0', 10);
    if (Number.isFinite(parsed)) {
      currentSceneIndex = Math.max(0, Math.min(parsed, MAX_SCENES - 1));
    }
  } catch (e) {
    // ignore
  }

  updateNavButtonStates();
  console.log('Navigation initialized with touch support');
}

/**
 * Handle keyboard input (debounced)
 */
const handleKeyboard = debounce((event) => {
  if (event.key === 'ArrowLeft') {
    goToPreviousScene();
  } else if (event.key === 'ArrowRight') {
    goToNextScene();
  }
}, 300);

/**
 * Go to next scene
 */
export function goToNextScene() {
  if (currentSceneIndex === 5) {
    window.location.href = '/closing.html';
    return;
  }

  if (currentSceneIndex >= MAX_SCENES - 1) return;
  goToScene(currentSceneIndex + 1);
}

/**
 * Go to previous scene
 */
export function goToPreviousScene() {
  if (currentSceneIndex <= 0) {
    window.location.href = '/';
    return;
  }
  if (currentSceneIndex === 5) {
    window.location.href = '/experience.html?scene=4';
    return;
  }
  goToScene(currentSceneIndex - 1);
}

/**
 * Go to specific scene
 */
export function goToScene(sceneIndex) {
  if (isNavigating) return;

  isNavigating = true;
  currentSceneIndex = Math.max(0, Math.min(sceneIndex, MAX_SCENES - 1));

  if (onSceneChange) {
    onSceneChange(currentSceneIndex);
  }

  updateNavButtonStates();

  // Allow navigation again after transition
  setTimeout(() => {
    isNavigating = false;
  }, 1000);
}

/**
 * Sync the internal scene index without triggering navigation.
 */
export function setCurrentSceneIndex(sceneIndex) {
  currentSceneIndex = Math.max(0, Math.min(sceneIndex, MAX_SCENES - 1));
  updateNavButtonStates();
}

/**
 * Update navigation button states
 */
function updateNavButtonStates() {
  const prevBtn = document.getElementById('nav-prev');
  const nextBtn = document.getElementById('nav-next');

  prevBtn.disabled = false;
  nextBtn.disabled = currentSceneIndex >= MAX_SCENES - 1;
}

/**
 * Get current scene index
 */
export function getCurrentSceneIndex() {
  return currentSceneIndex;
}

/**
 * Cleanup navigation listeners
 */
export function cleanupNavigation() {
  document.removeEventListener('keydown', handleKeyboard);
}
