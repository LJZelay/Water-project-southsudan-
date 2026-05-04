/**
 * ui.js
 * UI interactions: text panel and metrics widget
 */

let isPanelOpen = false;
let dragGesture = null;
let widgetDragState = null;

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

  setupStaticWidgetDragging();
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

  if (sceneLabel && !sceneLabel.querySelector('.scene-label-hit-area')) {
    sceneLabel.style.position = 'fixed';
    sceneLabel.style.overflow = 'hidden';

    const hitArea = document.createElement('button');
    hitArea.type = 'button';
    hitArea.className = 'scene-label-hit-area';
    hitArea.setAttribute('aria-label', 'Open text panel');
    hitArea.style.position = 'absolute';
    hitArea.style.inset = '0';
    hitArea.style.width = '100%';
    hitArea.style.height = '100%';
    hitArea.style.border = '0';
    hitArea.style.margin = '0';
    hitArea.style.padding = '0';
    hitArea.style.background = 'transparent';
    hitArea.style.cursor = 'pointer';
    hitArea.style.zIndex = '1';
    hitArea.style.pointerEvents = 'auto';

    hitArea.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTextPanel();
    });
    hitArea.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTextPanel();
    });
    hitArea.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTextPanel();
    });

    sceneLabel.insertBefore(hitArea, sceneLabel.firstChild);
  }

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

  const openPanelFromLabelBounds = (event) => {
    if (isPanelOpen || !sceneLabel) {
      return;
    }

    const rect = sceneLabel.getBoundingClientRect();
    const point = event.touches && event.touches.length > 0 ? event.touches[0] : event;

    if (
      point.clientX >= rect.left &&
      point.clientX <= rect.right &&
      point.clientY >= rect.top &&
      point.clientY <= rect.bottom
    ) {
      openTextPanel();
    }
  };

  document.addEventListener('pointerup', openPanelFromLabelBounds, true);
  document.addEventListener('click', openPanelFromLabelBounds, true);

  // Clicking the panel itself should also open it
  if (textPanel) {
    textPanel.addEventListener('click', () => {
      openTextPanel();
    });
    textPanel.addEventListener('touchend', () => {
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
  const metricsHint = document.getElementById('metrics-hint');

  if (!metricsWidget) {
    console.warn('Metrics widget not found');
    return;
  }

  // Show/hide hint based on static mode
  const updateHintVisibility = () => {
    const isStatic = document.body.classList.contains('static-mode');
    if (metricsHint) {
      metricsHint.style.display = isStatic ? 'block' : 'none';
    }
  };

  // Show hint immediately if already in static mode
  updateHintVisibility();

  // Helper function to handle toggle on click and touch
  function handleToggle(e) {
    e.stopPropagation();
    if (e.target === metricsClose || metricsClose.contains(e.target)) {
      return; // Close button is handled separately
    }
    toggleMetrics();
  }

  // Toggle expand/collapse on widget click - ensure it works even in static mode
  metricsWidget.addEventListener('click', (e) => {
    // In static mode, check if we're dragging; if so, don't toggle
    if (document.body.classList.contains('static-mode') && widgetDragState?.dragging) {
      return;
    }
    handleToggle(e);
  });
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

  // Update hint visibility when static mode changes
  const observer = new MutationObserver(() => {
    updateHintVisibility();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  console.log('Metrics toggle initialized with touch support and static mode awareness');
}

/**
 * Allow widgets to be dragged only while the static scene is active.
 */
function setupStaticWidgetDragging() {
  const widgets = [
    document.getElementById('metrics-widget'),
    document.getElementById('live-time-widget')
  ].filter(Boolean);

  if (!widgets.length) {
    return;
  }

  const isStaticMode = () => {
    if (document.body.classList.contains('static-mode')) {
      return true;
    }

    const scene5Static = document.getElementById('scene5-static');
    if (!scene5Static) {
      return false;
    }

    return getComputedStyle(scene5Static).display !== 'none';
  };

  const getPointFromEvent = (event) => {
    if (event.touches && event.touches.length > 0) {
      return event.touches[0];
    }
    if (event.changedTouches && event.changedTouches.length > 0) {
      return event.changedTouches[0];
    }
    return event;
  };

  const endDrag = () => {
    if (!widgetDragState) {
      return;
    }

    const draggedWidget = widgetDragState.widget;
    if (draggedWidget) {
      draggedWidget.classList.remove('dragging');
    }

    widgetDragState = null;
  };

  const onPointerMove = (event) => {
    if (!widgetDragState || event.pointerId !== widgetDragState.pointerId) {
      return;
    }

    const deltaX = event.clientX - widgetDragState.startX;
    const deltaY = event.clientY - widgetDragState.startY;

    if (!widgetDragState.dragging) {
      if (Math.abs(deltaX) < 4 && Math.abs(deltaY) < 4) {
        return;
      }

      widgetDragState.dragging = true;
      widgetDragState.widget.classList.add('dragging');
      widgetDragState.widget.style.left = `${widgetDragState.startLeft}px`;
      widgetDragState.widget.style.top = `${widgetDragState.startTop}px`;
      widgetDragState.widget.style.right = 'auto';
      widgetDragState.widget.style.bottom = 'auto';
    }

    widgetDragState.widget.style.left = `${widgetDragState.startLeft + deltaX}px`;
    widgetDragState.widget.style.top = `${widgetDragState.startTop + deltaY}px`;
  };

  const onMouseMove = (event) => {
    if (!widgetDragState || widgetDragState.inputType !== 'mouse') {
      return;
    }

    const deltaX = event.clientX - widgetDragState.startX;
    const deltaY = event.clientY - widgetDragState.startY;

    if (!widgetDragState.dragging) {
      if (Math.abs(deltaX) < 4 && Math.abs(deltaY) < 4) {
        return;
      }

      widgetDragState.dragging = true;
      widgetDragState.widget.classList.add('dragging');
      widgetDragState.widget.style.left = `${widgetDragState.startLeft}px`;
      widgetDragState.widget.style.top = `${widgetDragState.startTop}px`;
      widgetDragState.widget.style.right = 'auto';
      widgetDragState.widget.style.bottom = 'auto';
    }

    widgetDragState.widget.style.left = `${widgetDragState.startLeft + deltaX}px`;
    widgetDragState.widget.style.top = `${widgetDragState.startTop + deltaY}px`;
  };

  const onTouchMove = (event) => {
    if (!widgetDragState || widgetDragState.inputType !== 'touch') {
      return;
    }

    const point = getPointFromEvent(event);
    if (!point) {
      return;
    }

    const deltaX = point.clientX - widgetDragState.startX;
    const deltaY = point.clientY - widgetDragState.startY;

    if (!widgetDragState.dragging) {
      if (Math.abs(deltaX) < 4 && Math.abs(deltaY) < 4) {
        return;
      }

      widgetDragState.dragging = true;
      widgetDragState.widget.classList.add('dragging');
      widgetDragState.widget.style.left = `${widgetDragState.startLeft}px`;
      widgetDragState.widget.style.top = `${widgetDragState.startTop}px`;
      widgetDragState.widget.style.right = 'auto';
      widgetDragState.widget.style.bottom = 'auto';
    }

    widgetDragState.widget.style.left = `${widgetDragState.startLeft + deltaX}px`;
    widgetDragState.widget.style.top = `${widgetDragState.startTop + deltaY}px`;
    event.preventDefault();
  };

  const onPointerUp = (event) => {
    if (!widgetDragState || event.pointerId !== widgetDragState.pointerId) {
      return;
    }

    if (widgetDragState.dragging) {
      widgetDragState.widget.dataset.suppressNextClick = 'true';
    }

    widgetDragState.widget.releasePointerCapture?.(event.pointerId);

    endDrag();
  };

  const onMouseUp = () => {
    if (!widgetDragState || widgetDragState.inputType !== 'mouse') {
      return;
    }

    if (widgetDragState.dragging) {
      widgetDragState.widget.dataset.suppressNextClick = 'true';
    }

    endDrag();
  };

  const onTouchEnd = () => {
    if (!widgetDragState || widgetDragState.inputType !== 'touch') {
      return;
    }

    if (widgetDragState.dragging) {
      widgetDragState.widget.dataset.suppressNextClick = 'true';
    }

    endDrag();
  };

  widgets.forEach((widget) => {
    widget.addEventListener('pointerdown', (event) => {
      if (!isStaticMode()) {
        return;
      }

      if (widget === document.getElementById('metrics-widget') && event.target.closest('#metrics-close')) {
        return;
      }

      // Get current CSS left/top values, accounting for scaled widgets
      const computedStyle = getComputedStyle(widget);
      let startLeft = parseFloat(computedStyle.left) || 0;
      let startTop = parseFloat(computedStyle.top) || 0;

      // If widget uses right/bottom instead, calculate left/top from viewport
      if (widget.style.right && !widget.style.left) {
        const rect = widget.getBoundingClientRect();
        startLeft = rect.left / parseFloat(computedStyle.scale || 1);
      }
      if (widget.style.bottom && !widget.style.top) {
        const rect = widget.getBoundingClientRect();
        startTop = rect.top / parseFloat(computedStyle.scale || 1);
      }

      widgetDragState = {
        widget,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: startLeft,
        startTop: startTop,
        dragging: false,
        inputType: 'pointer',
      };

      widget.dataset.suppressNextClick = 'false';

      widget.setPointerCapture?.(event.pointerId);
    });

    widget.addEventListener('mousedown', (event) => {
      if (!isStaticMode() || event.button !== 0) {
        return;
      }

      if (widget === document.getElementById('metrics-widget') && event.target.closest('#metrics-close')) {
        return;
      }

      const computedStyle = getComputedStyle(widget);
      const startLeft = parseFloat(computedStyle.left) || widget.getBoundingClientRect().left;
      const startTop = parseFloat(computedStyle.top) || widget.getBoundingClientRect().top;

      widgetDragState = {
        widget,
        startX: event.clientX,
        startY: event.clientY,
        startLeft,
        startTop,
        dragging: false,
        inputType: 'mouse',
      };

      widget.dataset.suppressNextClick = 'false';
      event.preventDefault();
    });

    widget.addEventListener('touchstart', (event) => {
      if (!isStaticMode()) {
        return;
      }

      if (widget === document.getElementById('metrics-widget') && event.target.closest('#metrics-close')) {
        return;
      }

      const point = getPointFromEvent(event);
      if (!point) {
        return;
      }

      const computedStyle = getComputedStyle(widget);
      const startLeft = parseFloat(computedStyle.left) || widget.getBoundingClientRect().left;
      const startTop = parseFloat(computedStyle.top) || widget.getBoundingClientRect().top;

      widgetDragState = {
        widget,
        startX: point.clientX,
        startY: point.clientY,
        startLeft,
        startTop,
        dragging: false,
        inputType: 'touch',
      };

      widget.dataset.suppressNextClick = 'false';
    }, { passive: false });

    widget.addEventListener('click', (event) => {
      if (!isStaticMode()) {
        return;
      }

      if (widget.dataset.suppressNextClick === 'true') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        widget.dataset.suppressNextClick = 'false';
      }
    });
  });

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
  document.addEventListener('touchcancel', onTouchEnd);

  console.log('Static widget dragging initialized');
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
