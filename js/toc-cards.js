// toc-cards.js
// Enable click-to-expand behavior for roadmap cards on the TOC page.

function initTocCards() {
  const cards = document.querySelectorAll('.toc-card');
  if (!cards || !cards.length) return;

  // Close other cards when one opens
  function closeOthers(openCard) {
    cards.forEach((c) => {
      if (c !== openCard) c.classList.remove('expanded');
    });
  }

  cards.forEach((card) => {
    // Ensure the desc exists
    const desc = card.querySelector('.roadmap-desc');
    if (!desc) return;
    // Helper to set aria state
    function setExpandedState(el, expanded) {
      if (expanded) {
        el.classList.add('expanded');
        el.setAttribute('aria-expanded', 'true');
      } else {
        el.classList.remove('expanded');
        el.setAttribute('aria-expanded', 'false');
      }
    }

    // Toggle expansion on click: single click expands; when expanding, prevent navigation
    card.addEventListener('click', (evt) => {
      // Allow modifier clicks to follow link normally
      if (evt.metaKey || evt.ctrlKey || evt.button === 1) return;

      const isExpanded = card.classList.contains('expanded');
      if (!isExpanded) {
        evt.preventDefault();
        setExpandedState(card, true);
        closeOthers(card);
        setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      } else {
        // If already expanded, clicking again should follow the link (do nothing)
      }
    }, { passive: false });

    // Keyboard accessibility: Enter and Space toggle expansion (Space should prevent page scroll)
    card.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        const isExpanded = card.classList.contains('expanded');
        if (!isExpanded) {
          evt.preventDefault();
          setExpandedState(card, true);
          closeOthers(card);
          setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        }
      }
    });
  });

  // Collapse when clicking outside the grid
  document.addEventListener('click', (e) => {
    const grid = document.querySelector('.toc-grid');
    if (!grid) return;
    if (!grid.contains(e.target)) {
      cards.forEach((c) => c.classList.remove('expanded'));
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTocCards);
} else {
  initTocCards();
}
