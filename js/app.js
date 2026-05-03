/**
 * app.js
 * Main application orchestrator for scene-based exhibition
 */

import { scenes, getScene } from './scenes.js';
import { initThreeJS, loadScene, updateFallbackImage, isSceneTransitioning, cleanupThreeJS, applyLiveWeatherToScene } from './three-init.js';
import { initNavigation, getCurrentSceneIndex, cleanupNavigation } from './navigation.js';
import { setSceneState } from './sceneState.js';
import { initUI, updatePanelForScene, setupDragUpListener, setupMetricsToggle, closeTextPanel } from './ui.js';
import { isWebGLSupported } from './utils.js';
import {
  formatCoordinate,
  formatMetric,
  getBrowserLocation,
  getDefaultJongleiCoords,
  getLocationWeatherPayload,
  requestBrowserLocation,
  startWeatherAutoRefresh
} from './api.js';

let webglAvailable = false;
let livePayload = null;
let stopWeatherRefresh = null;
let clockTimerId = null;
let currentTimezone = 'Africa/Juba';
let locationStatusNote = 'Using Jonglei default coordinates.';
let activeCoords = getDefaultJongleiCoords();
let locationMode = 'fixed';

function isReloadNavigation() {
  const navEntry = performance.getEntriesByType('navigation')[0];
  if (navEntry && navEntry.type === 'reload') {
    return true;
  }

  if (performance.navigation && performance.navigation.type === 1) {
    return true;
  }

  return false;
}

if (isReloadNavigation()) {
  window.location.replace('/');
}

function getInitialSceneIndex() {
  const params = new URLSearchParams(window.location.search);
  const sceneParam = params.get('scene');
  const parsed = Number.parseInt(sceneParam || '0', 10);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  if (parsed > 5) {
    window.location.replace('/coming-soon.html');
    return 0;
  }

  return Math.max(0, Math.min(parsed, scenes.length - 1));
}

function formatTempHumidity(weather) {
  if (!weather) {
    return 'N/A';
  }

  const tempText = formatMetric(weather.temperatureC, 'C', 1);
  const humidityText = formatMetric(weather.humidity, '% RH', 0);
  if (tempText === 'N/A' && humidityText === 'N/A') {
    return 'N/A';
  }
  if (humidityText === 'N/A') {
    return tempText;
  }
  if (tempText === 'N/A') {
    return humidityText;
  }
  return `${tempText} • ${humidityText}`;
}

function formatLocalTime(timezone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: timezone || 'Africa/Juba'
    }).format(new Date());
  } catch (_err) {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(new Date());
  }
}

function renderLocalTime() {
  const compactTimeEl = document.getElementById('metric-local-time');
  const expandedTimeEl = document.getElementById('metric-local-time-full');
  const liveTimeValueEl = document.getElementById('live-time-value');
  const timeText = formatLocalTime(currentTimezone);

  if (compactTimeEl) {
    compactTimeEl.textContent = timeText;
  }
  if (expandedTimeEl) {
    expandedTimeEl.textContent = `${timeText} (${currentTimezone || 'Africa/Juba'})`;
  }
  if (liveTimeValueEl) {
    liveTimeValueEl.textContent = `${timeText} (${currentTimezone || 'Africa/Juba'})`;
  }
}

function startLocalClock() {
  if (clockTimerId) {
    clearInterval(clockTimerId);
  }

  renderLocalTime();
  clockTimerId = setInterval(renderLocalTime, 1000);
}

function setClockTimezone(timezone) {
  if (timezone && typeof timezone === 'string') {
    currentTimezone = timezone;
  }
  renderLocalTime();
}

/**
 * Initialize the entire application
 */
async function initApp() {
  console.log('Initializing Jonglei Canal Exhibition...');

  // Check WebGL support
  webglAvailable = isWebGLSupported();
  console.log('WebGL available:', webglAvailable);

  // Initialize Three.js
  if (webglAvailable) {
    const success = initThreeJS();
    if (!success) {
      webglAvailable = false;
    } else if (document.getElementById('r3f-canvas-root')) {
      import('./experience-r3f.jsx').catch((err) => {
        console.warn('Failed to load R3F experience overlay:', err);
      });
    }
  }

  // Initialize UI
  initUI();

  // Initialize navigation
  initNavigation(onSceneChange);

  // Setup drag-up listener for text panel
  setupDragUpListener();

  // Setup metrics toggle
  setupMetricsToggle();

  // Setup explicit geolocation opt-in prompt
  setupUseMyLocationButton();

  // Setup intro start button
  setupIntroStartButton();

  // Start clock immediately; timezone is refined when live API data arrives.
  startLocalClock();

  // Load initial scene (scene 0 by default; supports ?scene=1, etc.)
  onSceneChange(getInitialSceneIndex());

  // Hydrate live APIs in background so scene renders immediately.
  initLiveApiData().catch((err) => {
    console.warn('Live API integration failed:', err);
  });

  // Global boot flag used by index.html compatibility check
  window.__jongleiAppBooted = true;

  console.log('Exhibition ready');
}

/**
 * Callback when scene changes
 */
function onSceneChange(sceneIndex) {
  if (isSceneTransitioning()) {
    console.log('Scene transition in progress; skipping navigation');
    return;
  }

  const sceneData = getScene(sceneIndex);

  // Update header
  updateProgressBar(sceneIndex);
  updateSceneTitle(sceneData);

  // Load Three.js scene or update fallback
  if (webglAvailable) {
    loadScene(sceneData);
    // Mirror current scene index into shared scene state so React components can react
    try {
      setSceneState({ currentSceneIndex: sceneIndex });
    } catch (err) {
      // ignore
    }
  } else {
    updateFallbackImage(sceneIndex);
  }

  // Update text panel
  updatePanelForScene(sceneData);

  // Update metrics
  updateMetrics(sceneData, livePayload);

  // Close text panel when navigating to new scene
  closeTextPanel();

  // Update scene label
  updateSceneLabel(sceneData);

  console.log(`Scene ${sceneIndex}: ${sceneData.title}`);
}

/**
 * Update progress bar display
 */
function updateProgressBar(sceneIndex) {
  const progressText = document.getElementById('progress-text');
  const progressFill = document.querySelector('.progress-fill');

  progressText.textContent = `${sceneIndex + 1} of ${scenes.length}`;
  const percentage = ((sceneIndex + 1) / scenes.length) * 100;
  progressFill.style.width = `${percentage}%`;
}

/**
 * Update scene title in header
 */
function updateSceneTitle(sceneData) {
  const titleEl = document.getElementById('scene-title');
  titleEl.textContent = sceneData.title;
}

/**
 * Update metrics display (both compact and expanded views)
 */
function updateMetrics(sceneData, liveData) {
  setClockTimezone(liveData?.weather?.timezone || 'Africa/Juba');
  const resolvedLocationText = liveData?.location?.formattedAddress || 'Jonglei Canal, South Sudan';

  // Update compact view from live APIs
  const tempEl = document.getElementById('metric-temperature');
  const conditionEl = document.getElementById('metric-condition');
  const locationShortEl = document.getElementById('metric-location-short');

  if (tempEl) {
    tempEl.textContent = liveData?.weather
      ? formatTempHumidity(liveData.weather)
      : sceneData.metrics.temperature;
  }

  if (conditionEl) {
    conditionEl.textContent = liveData?.weather?.condition || 'Loading';
  }

  if (locationShortEl) {
    locationShortEl.textContent = resolvedLocationText;
  }

  // Expanded weather details
  const tempFullEl = document.getElementById('metric-temperature-full');
  const feelsLikeFullEl = document.getElementById('metric-feels-like-full');
  const humidityFullEl = document.getElementById('metric-humidity-full');
  const precipFullEl = document.getElementById('metric-precipitation-full');
  const windFullEl = document.getElementById('metric-wind-full');

  if (tempFullEl) tempFullEl.textContent = liveData?.weather ? formatMetric(liveData.weather.temperatureC, 'C', 1) : 'N/A';
  if (feelsLikeFullEl) feelsLikeFullEl.textContent = liveData?.weather ? formatMetric(liveData.weather.feelsLikeC, 'C', 1) : 'N/A';
  if (humidityFullEl) humidityFullEl.textContent = liveData?.weather ? formatMetric(liveData.weather.humidity, '%', 0) : 'N/A';
  if (precipFullEl) precipFullEl.textContent = liveData?.weather ? formatMetric(liveData.weather.precipitationChance, '%', 0) : 'N/A';
  if (windFullEl) windFullEl.textContent = liveData?.weather ? formatMetric(liveData.weather.windKph, ' km/h', 1) : 'N/A';

  // Expanded location details
  const locationFullEl = document.getElementById('metric-location-full');
  const latitudeFullEl = document.getElementById('metric-latitude-full');
  const longitudeFullEl = document.getElementById('metric-longitude-full');
  const countryFullEl = document.getElementById('metric-country-full');
  const neighborsFullEl = document.getElementById('metric-neighbors-full');

  if (locationFullEl) locationFullEl.textContent = resolvedLocationText;
  if (latitudeFullEl) latitudeFullEl.textContent = formatCoordinate(liveData?.location?.latitude);
  if (longitudeFullEl) longitudeFullEl.textContent = formatCoordinate(liveData?.location?.longitude);
  if (countryFullEl) countryFullEl.textContent = liveData?.location?.countryName || 'South Sudan';
  if (neighborsFullEl) {
    const neighbors = liveData?.location?.neighbors || [];
    neighborsFullEl.textContent = neighbors.length ? neighbors.join(', ') : 'No border data';
  }

  // Scene context remains visible in expanded panel
  const sceneTempEl = document.getElementById('metric-scene-temperature');
  const sceneHumidityEl = document.getElementById('metric-scene-humidity');
  const evapEl = document.getElementById('metric-evaporation-full');
  const diseaseEl = document.getElementById('metric-disease');

  if (sceneTempEl) sceneTempEl.textContent = sceneData.metrics.temperature;
  if (sceneHumidityEl) sceneHumidityEl.textContent = sceneData.metrics.humidity;
  if (evapEl) evapEl.textContent = sceneData.metrics.evaporation;
  if (diseaseEl) diseaseEl.textContent = sceneData.metrics.disease;

  const apiStatusEl = document.getElementById('metric-api-status');
  if (apiStatusEl) {
    const sourceNote = liveData?.statusNote || 'Loading live APIs...';
    apiStatusEl.textContent = `${sourceNote} ${locationStatusNote}`.trim();
  }
}

/**
 * Update scene label (collapsed state)
 */
function updateSceneLabel(sceneData) {
  const labelTitle = document.getElementById('label-title');
  const labelHint = document.querySelector('#scene-label .label-hint');
  const sceneIndex = getCurrentSceneIndex();

  labelTitle.textContent = sceneData.shortLabel;
  if (labelHint) {
    const nextSceneName = sceneIndex === 0
      ? scenes[1].title
      : 'Coming Soon';
    labelHint.textContent = `Click to read analysis • Next scene: ${nextSceneName}`;
  }
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
  if (stopWeatherRefresh) {
    stopWeatherRefresh();
  }
  if (clockTimerId) {
    clearInterval(clockTimerId);
  }
  if (webglAvailable) {
    cleanupThreeJS();
  }
  cleanupNavigation();
});

async function initLiveApiData() {
  const locationResult = await getBrowserLocation().catch(() => null);
  locationStatusNote = locationResult?.reason || 'Unable to read browser location. Using Jonglei default coordinates.';
  activeCoords = locationResult?.coords || getDefaultJongleiCoords();
  locationMode = activeCoords?.label === 'Your location' ? 'browser' : 'fixed';

  await refreshLivePayloadForCoords(activeCoords);
  updateLocationButtonLabel();
}

function setupUseMyLocationButton() {
  const locationButton = document.getElementById('use-my-location');
  if (!locationButton) {
    return;
  }

  locationButton.addEventListener('click', async () => {
    locationButton.disabled = true;
    const previousText = locationButton.textContent;
    locationButton.textContent = 'Requesting...';

    try {
      if (locationMode === 'browser') {
        locationMode = 'fixed';
        activeCoords = getDefaultJongleiCoords();
        locationStatusNote = 'Location tracking turned off. Using fixed Jonglei Canal coordinates.';
      } else {
        const result = await requestBrowserLocation();
        locationStatusNote = result.reason;
        activeCoords = result.coords || getDefaultJongleiCoords();
        locationMode = activeCoords?.label === 'Your location' ? 'browser' : 'fixed';
      }

      await refreshLivePayloadForCoords(activeCoords);
      updateLocationButtonLabel();
    } catch (err) {
      console.warn('Location opt-in flow failed:', err);
      locationStatusNote = 'Unable to apply location update. Continuing with fixed Jonglei Canal coordinates.';
      locationMode = 'fixed';
      activeCoords = getDefaultJongleiCoords();
      await refreshLivePayloadForCoords(activeCoords);
      updateLocationButtonLabel();
      updateMetrics(getScene(getCurrentSceneIndex()), livePayload);
    } finally {
      locationButton.disabled = false;
      if (locationButton.textContent === 'Requesting...') {
        locationButton.textContent = previousText;
      }
    }
  });

  updateLocationButtonLabel();
}

async function refreshLivePayloadForCoords(coords) {
  try {
    livePayload = await getLocationWeatherPayload(coords);
  } catch (err) {
    console.warn('Failed to load live API payload:', err);
    livePayload = null;
  }

  applyLivePayloadToExperience(livePayload);
  updateMetrics(getScene(getCurrentSceneIndex()), livePayload);

  if (stopWeatherRefresh) {
    stopWeatherRefresh();
  }

  stopWeatherRefresh = startWeatherAutoRefresh(coords, (payload) => {
    livePayload = payload;
    applyLivePayloadToExperience(livePayload);
    updateMetrics(getScene(getCurrentSceneIndex()), livePayload);
  });
}

function updateLocationButtonLabel() {
  const locationButton = document.getElementById('use-my-location');
  if (!locationButton) {
    return;
  }

  locationButton.textContent = locationMode === 'browser'
    ? 'Use Fixed Jonglei Location'
    : 'Use My Location';
}

function applyLivePayloadToExperience(payload) {
  if (!payload) {
    return;
  }

  document.body.dataset.weatherTheme = payload.weather?.theme || 'sunny';
  applyLiveWeatherToScene(payload.weather || {});

  const introSatellite = document.getElementById('intro-satellite');
  if (introSatellite && payload.satellite?.url) {
    introSatellite.src = payload.satellite.url;
  }

  const introSummary = document.getElementById('intro-summary');
  if (introSummary) {
    const locationText = payload.location?.formattedAddress || 'Jonglei Canal, South Sudan';
    const weatherText = payload.weather?.condition || 'Unknown';
    const tempHumidityText = formatTempHumidity(payload.weather);
    introSummary.textContent = `Live snapshot: ${locationText} • ${weatherText} • ${tempHumidityText}`;
  }

  const liveTimeLocationEl = document.getElementById('live-time-location');
  if (liveTimeLocationEl) {
    liveTimeLocationEl.textContent = payload.location?.formattedAddress || 'Jonglei Canal, South Sudan';
  }
}

function setupIntroStartButton() {
  const startBtn = document.getElementById('start-experience');
  const introOverlay = document.getElementById('intro-overlay');
  if (!startBtn || !introOverlay) {
    return;
  }

  document.body.classList.remove('experience-started');

  const closeIntro = () => {
    introOverlay.classList.add('exiting');
    document.body.classList.add('experience-started');
    window.dispatchEvent(new CustomEvent('jonglei:intro-start'));

    window.setTimeout(() => {
      introOverlay.classList.add('hidden');
    }, 360);
  };

  startBtn.addEventListener('click', closeIntro);
  startBtn.addEventListener('touchend', (event) => {
    event.preventDefault();
    closeIntro();
  }, { passive: false });
}

/**
 * Start the app when DOM is ready
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
