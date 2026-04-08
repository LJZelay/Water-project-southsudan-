const JONGLEI_COORDS = {
  lat: 7.9297,
  lon: 31.3196,
  label: "Jonglei Canal"
};

const WEATHER_REFRESH_MS = 5 * 60 * 1000;
const CSE_WEATHER_URL = "https://cse2004.com/api/weather";
const CSE_GEOCODE_URL = "https://cse2004.com/api/geocode";
const API_TIMEOUT_MS = 9000;

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function toNumber(value, fallback = NaN) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/(^|\s|_)[a-z]/g, (match) => match.toUpperCase())
    .replaceAll("_", " ")
    .trim();
}

function stripPlusCodePrefix(address) {
  const raw = String(address || "").trim();
  if (!raw) {
    return "";
  }

  // Removes leading map plus codes like "W8H9+VR Nyaugith, South Sudan".
  return raw
    .replace(/^[A-Z0-9]{4,}\+[A-Z0-9]{2,}\s*/i, "")
    .replace(/^,\s*/, "")
    .trim();
}

function locationFromGeocode(geoData, lat, lon) {
  const first = geoData?.results?.[0];
  if (!first) {
    return {
      latitude: lat,
      longitude: lon,
      locality: "Jonglei Canal",
      countryName: "South Sudan",
      countryCode: "SS",
      formattedAddress: "Jonglei Canal, South Sudan"
    };
  }

  const components = first.address_components || [];
  const byType = (type) => components.find((item) => item.types?.includes(type));

  const locality = byType("locality")?.long_name
    || byType("administrative_area_level_2")?.long_name
    || byType("administrative_area_level_1")?.long_name
    || "Jonglei Canal";

  const countryComponent = byType("country");

  return {
    latitude: lat,
    longitude: lon,
    locality: JONGLEI_COORDS.label,
    nearestLocality: locality,
    countryName: countryComponent?.long_name || "South Sudan",
    countryCode: countryComponent?.short_name || "SS",
    formattedAddress: stripPlusCodePrefix(first.formatted_address || `${locality}, South Sudan`)
  };
}

async function reverseGeocode(lat, lon) {
  const url = `${CSE_GEOCODE_URL}?latlng=${encodeURIComponent(`${lat},${lon}`)}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error("CSE reverse geocoding request failed.");
  }

  const data = await response.json();
  if (data?.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`CSE geocoding error: ${data.status}`);
  }

  return locationFromGeocode(data, lat, lon);
}

async function getNeighbors(countryCode) {
  if (!countryCode) {
    return [];
  }

  try {
    const baseResp = await fetchWithTimeout(`https://restcountries.com/v3.1/alpha/${encodeURIComponent(countryCode)}?fields=name,borders`);
    if (!baseResp.ok) {
      return [];
    }

    const baseData = await baseResp.json();
    const details = Array.isArray(baseData) ? baseData[0] : baseData;
    const borders = details?.borders || [];
    if (!borders.length) {
      return [];
    }

    const listResp = await fetchWithTimeout(`https://restcountries.com/v3.1/alpha?codes=${encodeURIComponent(borders.join(","))}&fields=name`);
    if (!listResp.ok) {
      return borders;
    }

    const listData = await listResp.json();
    return listData
      .map((item) => item?.name?.common)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  } catch (_err) {
    return [];
  }
}

async function getCseWeather(lat, lon) {
  const response = await fetchWithTimeout(`${CSE_WEATHER_URL}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`);
  if (!response.ok) {
    throw new Error("CSE weather request failed.");
  }

  const data = await response.json();
  const temperatureF = toNumber(data?.temperature?.degrees, NaN);
  const temperatureC = Number.isFinite(temperatureF) ? ((temperatureF - 32) * 5) / 9 : NaN;
  const condition = titleCase(data?.weatherCondition?.description?.text || data?.weatherCondition?.type || "Unknown");

  return {
    source: "cse2004-weather",
    updatedAtIso: new Date().toISOString(),
    timezone: data?.timeZone?.id || data?.timezone || "Africa/Juba",
    condition,
    conditionCode: String(data?.weatherCondition?.type || "UNKNOWN").toUpperCase(),
    temperatureC,
    feelsLikeC: Number.isFinite(temperatureF) ? temperatureC : NaN,
    humidity: toNumber(data?.relativeHumidity, NaN),
    precipitationChance: toNumber(data?.precipitationProbability?.percent, NaN),
    windKph: toNumber(data?.wind?.speed?.milesPerHour, NaN) * 1.60934,
    uvIndex: toNumber(data?.uvIndex, NaN),
    temperatureF
  };
}

async function getFallbackWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,precipitation,weather_code&timezone=auto`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error("Fallback weather request failed.");
  }

  const data = await response.json();
  const current = data?.current || {};
  const weatherCode = Number(current.weather_code);

  let condition = "Unknown";
  if ([0].includes(weatherCode)) condition = "Clear";
  if ([1, 2, 3].includes(weatherCode)) condition = "Cloudy";
  if ([45, 48].includes(weatherCode)) condition = "Foggy";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode)) condition = "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) condition = "Snow";
  if ([95, 96, 99].includes(weatherCode)) condition = "Storm";

  return {
    source: "open-meteo-fallback",
    updatedAtIso: new Date().toISOString(),
    timezone: data?.timezone || "Africa/Juba",
    condition,
    conditionCode: `WMO_${weatherCode}`,
    temperatureC: toNumber(current.temperature_2m, NaN),
    feelsLikeC: toNumber(current.apparent_temperature, NaN),
    humidity: toNumber(current.relative_humidity_2m, NaN),
    precipitationChance: toNumber(current.precipitation, NaN),
    windKph: toNumber(current.wind_speed_10m, NaN),
    uvIndex: NaN
  };
}

function getWeatherTheme(conditionCode, conditionLabel) {
  const code = String(conditionCode || "").toUpperCase();
  const label = String(conditionLabel || "").toLowerCase();
  const joined = `${code} ${label}`;

  if (joined.includes("RAIN") || joined.includes("DRIZZLE") || joined.includes("SHOWER")) {
    return "rain";
  }
  if (joined.includes("STORM") || joined.includes("THUNDER")) {
    return "storm";
  }
  if (joined.includes("CLOUD") || joined.includes("OVERCAST")) {
    return "cloudy";
  }
  if (joined.includes("FOG") || joined.includes("MIST")) {
    return "mist";
  }
  if (joined.includes("SNOW")) {
    return "cloudy";
  }
  return "sunny";
}

function latLonToTile(lat, lon, zoom) {
  const scale = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * scale);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2) * scale);
  return { x, y };
}

function esriSatelliteTileUrl(lat, lon, zoom = 7) {
  const tile = latLonToTile(lat, lon, zoom);
  return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tile.y}/${tile.x}`;
}

export async function getBrowserLocation() {
  return {
    ok: true,
    reason: "Using fixed Jonglei Canal target coordinates.",
    coords: { ...JONGLEI_COORDS }
  };
}

export async function getLocationWeatherPayload(coords) {
  const lat = toNumber(coords?.lat, JONGLEI_COORDS.lat);
  const lon = toNumber(coords?.lon, JONGLEI_COORDS.lon);

  const locationPromise = reverseGeocode(lat, lon).catch(() => ({
    latitude: lat,
    longitude: lon,
    locality: JONGLEI_COORDS.label,
    countryName: "South Sudan",
    countryCode: "SS",
    formattedAddress: "Jonglei Canal, South Sudan"
  }));

  const weatherPromise = getCseWeather(lat, lon).catch(() => getFallbackWeather(lat, lon));

  const [locationResult, weatherResult] = await Promise.allSettled([locationPromise, weatherPromise]);
  const location = locationResult.status === 'fulfilled'
    ? locationResult.value
    : {
      latitude: lat,
      longitude: lon,
      locality: JONGLEI_COORDS.label,
      countryName: "South Sudan",
      countryCode: "SS",
      formattedAddress: "Jonglei Canal, South Sudan"
    };

  const weather = weatherResult.status === 'fulfilled'
    ? weatherResult.value
    : {
      source: "unavailable",
      updatedAtIso: new Date().toISOString(),
      timezone: "Africa/Juba",
      condition: "Unavailable",
      conditionCode: "UNAVAILABLE",
      temperatureC: NaN,
      feelsLikeC: NaN,
      humidity: NaN,
      precipitationChance: NaN,
      windKph: NaN,
      uvIndex: NaN
    };

  const neighbors = await getNeighbors(location.countryCode);

  return {
    location: {
      ...location,
      neighbors
    },
    weather: {
      ...weather,
      theme: getWeatherTheme(weather.conditionCode, weather.condition)
    },
    satellite: {
      source: "esri-world-imagery",
      url: esriSatelliteTileUrl(lat, lon)
    },
    statusNote: weather.source === "cse2004-weather"
      ? "Live weather + geocoding from class API endpoints."
      : weather.source === "open-meteo-fallback"
        ? "Class weather API unavailable. Showing fallback weather source."
        : "Live APIs temporarily unavailable. Showing scene defaults.",
    usingGoogleSatellite: false
  };
}

export function startWeatherAutoRefresh(coords, onUpdate) {
  let stopped = false;

  const run = async () => {
    if (stopped) {
      return;
    }

    try {
      const payload = await getLocationWeatherPayload(coords);
      onUpdate(payload);
    } catch (err) {
      console.warn("Weather refresh failed:", err);
    }
  };

  run();
  const timerId = setInterval(run, WEATHER_REFRESH_MS);

  return () => {
    stopped = true;
    clearInterval(timerId);
  };
}

export function formatMetric(value, unit = "", digits = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "N/A";
  }
  return `${parsed.toFixed(digits)}${unit}`;
}

export function formatCoordinate(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "N/A";
  }
  return parsed.toFixed(4);
}

export function getDefaultJongleiCoords() {
  return { ...JONGLEI_COORDS };
}
