/**
 * utils.js
 * Utility functions for WebGL detection, helpers, and device capability checks
 */

/**
 * Detects if WebGL is supported by the browser
 * @returns {boolean} True if WebGL is supported
 */
export function isWebGLSupported() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
}

/**
 * Smoothly interpolates between two values
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Progress (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Easing function: ease-in-out cubic
 * @param {number} t - Progress (0-1)
 * @returns {number} Eased value
 */
export function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Clamps a value between min and max
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Debounces a function call
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}


export function featureTier() {
  const webgl = supportsWebGL();
  const mobile = window.matchMedia("(max-width: 980px)").matches;
  if (!webgl) {
    return "tier-c";
  }
  if (mobile) {
    return "tier-b";
  }
  return "tier-a";
}
