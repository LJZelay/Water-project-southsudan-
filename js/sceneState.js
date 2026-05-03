import { useSyncExternalStore } from 'react';

const sceneState = {
  flashActive: false,
  frontLineZ: -14,
  globalTime: 0,
  currentSceneIndex: 0,
  selectedPersonId: null,
  selectedDialogueText: null,
  hoveredPersonId: null
};

let cachedSnapshot = { ...sceneState };

const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function setSceneState(patch) {
  let didChange = false;

  for (const key of Object.keys(patch)) {
    if (sceneState[key] !== patch[key]) {
      sceneState[key] = patch[key];
      didChange = true;
    }
  }

  if (didChange) {
    cachedSnapshot = { ...sceneState };
    emitChange();
  }
}

export function getSceneState() {
  return cachedSnapshot;
}

export function useSceneState() {
  return useSyncExternalStore(
    subscribe,
    () => cachedSnapshot,
    () => cachedSnapshot
  );
}

export function useCurrentSceneIndex() {
  return useSyncExternalStore(
    subscribe,
    () => cachedSnapshot.currentSceneIndex,
    () => cachedSnapshot.currentSceneIndex
  );
}

export function useSelectedPersonId() {
  return useSyncExternalStore(
    subscribe,
    () => cachedSnapshot.selectedPersonId,
    () => cachedSnapshot.selectedPersonId
  );
}

export function selectPerson(id) {
  setSceneState({ selectedPersonId: id, selectedDialogueText: null });
}

export function selectPersonWithDialogue(id, dialogueText) {
  setSceneState({
    selectedPersonId: id,
    selectedDialogueText: dialogueText || null
  });
}

export function setHoveredPerson(id) {
  setSceneState({ hoveredPersonId: id || null });
}

export function closeDialogueOverlay() {
  setSceneState({
    selectedPersonId: null,
    selectedDialogueText: null,
    hoveredPersonId: null
  });
}
