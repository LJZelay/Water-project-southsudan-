import { normalizeScrollProgress } from "./utils.js";

export function setupScrollTracking({ onUpdate }) {
  const stops = Array.from(document.querySelectorAll(".scroll-stop"));
  let rafId = null;

  const findActiveStop = () => {
    const midpoint = window.innerHeight * 0.52;
    let active = 0;
    let best = Number.POSITIVE_INFINITY;

    stops.forEach((stop, idx) => {
      const rect = stop.getBoundingClientRect();
      const centerDistance = Math.abs(rect.top + rect.height / 2 - midpoint);
      if (centerDistance < best) {
        best = centerDistance;
        active = idx;
      }
    });

    return active;
  };

  const tick = () => {
    const progress = normalizeScrollProgress();
    const activeIndex = findActiveStop();

    onUpdate(progress, activeIndex);
    rafId = null;
  };

  const requestTick = () => {
    if (rafId !== null) {
      return;
    }
    rafId = window.requestAnimationFrame(tick);
  };

  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick);
  requestTick();

  return () => {
    window.removeEventListener("scroll", requestTick);
    window.removeEventListener("resize", requestTick);
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
    }
  };
}
