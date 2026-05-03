/**
 * ui.js
 * UI interactions: text panel and metrics widget
 */

let isPanelOpen = false;
let dragGesture = null;

/**
 * Initialize UI components
 */
export function initUI() {
  console.log('UI initialized');
  
  // Ensure elements exist before adding listeners
  const sceneLabel = document.getElementById('scene-label');
  if (sceneLabel) {
    sceneLabel.addEventListener('click', openTextPanel);
  }
}

/**
 * Update text panel for current scene
 */
export function updatePanelForScene(sceneData) {
  const textContent = document.getElementById('text-content');
  const textCitations = document.getElementById('text-citations');

  if (textContent) {
    textContent.innerHTML = sceneData.textContent || '<p>No content available</p>';
  }
  if (textCitations) {
    textCitations.textContent = '';
  }

  // Reset panel to closed state
  closeTextPanel();
}

/**
 * Setup panel listeners.
 * Panel opens only on explicit label click/tap.
 */
export function setupDragUpListener() {
  const closeBtn = document.getElementById('close-panel');
  const sceneLabel = document.getElementById('scene-label');
  const textPanel = document.getElementById('text-panel');

  const clearDragGesture = () => {
    dragGesture = null;
  };

  const handleDragMove = (event) => {
    if (!dragGesture || event.pointerId !== dragGesture.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragGesture.startX;
    const deltaY = event.clientY - dragGesture.startY;

    if (!dragGesture.opened && deltaY <= -36 && Math.abs(deltaY) > Math.abs(deltaX)) {
      dragGesture.opened = true;
      dragGesture.suppressNextClick = true;
      openTextPanel();
    }
  };

  const handleDragEnd = (event) => {
    if (!dragGesture || event.pointerId !== dragGesture.pointerId) {
      return;
    }

    if (dragGesture.opened) {
      dragGesture.suppressNextClick = true;
    }

    clearDragGesture();
  };

  // Close button
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTextPanel();
    });
    closeBtn.addEventListener('touchend', (e) => {
      e.stopPropagation();
      closeTextPanel();
    });
  }

  // Scene label click opens panel
  if (sceneLabel) {
    sceneLabel.addEventListener('click', (e) => {
      if (dragGesture?.suppressNextClick) {
        dragGesture.suppressNextClick = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      openTextPanel();
    });
    sceneLabel.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) {
        return;
      }

      dragGesture = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        opened: false,
        suppressNextClick: false
      };
    });
    sceneLabel.addEventListener('touchend', (e) => {
      e.stopPropagation();
      openTextPanel();
    });
  }

  const closeIfOutsidePanel = (event) => {
    if (!isPanelOpen || !textPanel) {
      return;
    }

    const target = event.target;
    if (textPanel.contains(target)) {
      return;
    }
    if (sceneLabel && sceneLabel.contains(target)) {
      return;
    }

    closeTextPanel();
  };

  document.addEventListener('click', closeIfOutsidePanel);
  document.addEventListener('touchend', closeIfOutsidePanel);
  document.addEventListener('pointermove', handleDragMove);
  document.addEventListener('pointerup', handleDragEnd);
  document.addEventListener('pointercancel', handleDragEnd);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isPanelOpen) {
      closeTextPanel();
    }
  });

  console.log('Panel click listeners initialized');
}

/**
 * Open text panel
 */
export function openTextPanel() {
  const textPanel = document.getElementById('text-panel');
  const sceneLabel = document.getElementById('scene-label');
  const metricsWidget = document.getElementById('metrics-widget');

  dragGesture = null;

  if (textPanel) {
    textPanel.classList.add('open');
  }
  if (sceneLabel) {
    sceneLabel.classList.add('hidden');
  }
  if (metricsWidget) {
    metricsWidget.style.display = 'none';
  }
  document.body.classList.add('text-panel-open');
  isPanelOpen = true;
  console.log('Text panel opened');
}

/**
 * Close text panel
 */
export function closeTextPanel() {
  const textPanel = document.getElementById('text-panel');
  const sceneLabel = document.getElementById('scene-label');
  const metricsWidget = document.getElementById('metrics-widget');

  if (textPanel) {
    textPanel.classList.remove('open');
  }
  if (sceneLabel) {
    sceneLabel.classList.remove('hidden');
  }
  if (metricsWidget) {
    metricsWidget.style.display = '';
  }
  document.body.classList.remove('text-panel-open');
  isPanelOpen = false;
  console.log('Text panel closed');
}

/**
 * Setup metrics widget toggle
 */
export function setupMetricsToggle() {
  const metricsWidget = document.getElementById('metrics-widget');
  const metricsClose = document.getElementById('metrics-close');
  const metricsCompact = document.getElementById('metrics-compact');
  const metricsExpanded = document.getElementById('metrics-expanded');

  if (!metricsWidget) {
    console.warn('Metrics widget not found');
    return;
  }

  // Helper function to handle toggle on click and touch
  function handleToggle(e) {
    e.stopPropagation();
    if (e.target === metricsClose || metricsClose.contains(e.target)) {
      return; // Close button is handled separately
    }
    toggleMetrics();
  }

  // Toggle expand/collapse on widget click
  metricsWidget.addEventListener('click', handleToggle);
  metricsWidget.addEventListener('touchend', handleToggle);

  // Close button - click and touch
  if (metricsClose) {
    metricsClose.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMetrics();
    });
    metricsClose.addEventListener('touchend', (e) => {
      e.stopPropagation();
      closeMetrics();
    });
  }

  // Close metrics when clicking outside
  document.addEventListener('click', (event) => {
    if (metricsWidget.classList.contains('open')) {
      if (!metricsWidget.contains(event.target)) {
        closeMetrics();
      }
    }
  });

  // Close on touch outside
  document.addEventListener('touchend', (event) => {
    if (metricsWidget.classList.contains('open')) {
      if (!metricsWidget.contains(event.target)) {
        closeMetrics();
      }
    }
  });

  console.log('Metrics toggle initialized with touch support');
}

/**
 * Toggle metrics expanded/collapsed state
 */
function toggleMetrics() {
  const metricsWidget = document.getElementById('metrics-widget');
  
  if (metricsWidget.classList.contains('open')) {
    closeMetrics();
  } else {
    openMetrics();
  }
}

/**
 * Open metrics in expanded view
 */
function openMetrics() {
  const metricsWidget = document.getElementById('metrics-widget');
  const metricsCompact = document.getElementById('metrics-compact');
  const metricsExpanded = document.getElementById('metrics-expanded');

  metricsWidget.classList.add('open');
  if (metricsCompact) metricsCompact.style.display = 'none';
  if (metricsExpanded) metricsExpanded.style.display = 'flex';
  
  console.log('Metrics expanded');
}

/**
 * Close metrics widget
 */
function closeMetrics() {
  const metricsWidget = document.getElementById('metrics-widget');
  const metricsCompact = document.getElementById('metrics-compact');
  const metricsExpanded = document.getElementById('metrics-expanded');

  metricsWidget.classList.remove('open');
  if (metricsCompact) metricsCompact.style.display = 'flex';
  if (metricsExpanded) metricsExpanded.style.display = 'none';
  
  console.log('Metrics collapsed');
}

/**
 * Get current panel state
 */
export function isPanelCurrentlyOpen() {
  return isPanelOpen;
}
