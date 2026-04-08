/**
 * three-init.js
 * Three.js scene initialization, rendering, and geometry setup
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { isWebGLSupported, lerp, easeInOutCubic, clamp } from './utils.js';

let scene, camera, renderer;
let canvas;
let directionalLightRef = null;
let ambientLightRef = null;
let hemiLightRef = null;
let weatherEffects = null;
let activeSkyCase = 'sunny';
let currentSceneIndex = 0;
let isTransitioning = false;
let sceneObjects = {};
let animationFrameId;
let scene0Runtime = null;
let scene1Runtime = null;
let scene0Controls = null;
let scene0LastFrameTime = performance.now();
let scene0StartTime = scene0LastFrameTime;
const SCENE1_WHEEL_ROTATION_SPEED = 1.35;

function createWeatherEffects() {
  const root = new THREE.Group();

  const rainCount = 900;
  const rainPositions = new Float32Array(rainCount * 3);
  const rainSpeeds = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i += 1) {
    rainPositions[i * 3] = -120 + Math.random() * 240;
    rainPositions[i * 3 + 1] = 8 + Math.random() * 90;
    rainPositions[i * 3 + 2] = -120 + Math.random() * 240;
    rainSpeeds[i] = 12 + Math.random() * 18;
  }

  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMaterial = new THREE.PointsMaterial({
    color: 0xbfd9ee,
    size: 0.16,
    transparent: true,
    opacity: 0.42,
    depthWrite: false
  });
  const rain = new THREE.Points(rainGeometry, rainMaterial);
  rain.visible = false;
  root.add(rain);

  const mistLayer = new THREE.Mesh(
    new THREE.PlaneGeometry(280, 280, 1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xe3ecf2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  mistLayer.rotation.x = -Math.PI / 2;
  mistLayer.position.y = 7.2;
  root.add(mistLayer);

  const stormFlash = new THREE.PointLight(0xe8f3ff, 0, 260, 2);
  stormFlash.position.set(-8, 56, 18);
  root.add(stormFlash);

  scene.add(root);
  return {
    root,
    rain,
    rainSpeeds,
    mistLayer,
    stormFlash,
    flashTimer: 0
  };
}

function updateWeatherEffectState(weather = {}, skyCaseKey = 'sunny') {
  if (!weatherEffects) {
    return;
  }

  const humidity = Number(weather.humidity);
  const humidFactor = Number.isFinite(humidity) ? clamp(humidity / 100, 0.3, 1) : 0.55;
  const hasRain = skyCaseKey === 'rain' || skyCaseKey === 'storm';
  const hasMist = skyCaseKey === 'mist' || skyCaseKey === 'humid-heat' || skyCaseKey === 'rain';

  weatherEffects.rain.visible = hasRain;
  weatherEffects.rain.material.opacity = skyCaseKey === 'storm' ? 0.56 : (0.3 + humidFactor * 0.24);
  weatherEffects.rain.material.size = skyCaseKey === 'storm' ? 0.19 : 0.16;

  weatherEffects.mistLayer.visible = hasMist;
  weatherEffects.mistLayer.material.opacity = hasMist
    ? (skyCaseKey === 'mist' ? 0.2 + humidFactor * 0.28 : 0.1 + humidFactor * 0.15)
    : 0;
}

function updateWeatherEffects(deltaSeconds, elapsedTime) {
  if (!weatherEffects) {
    return;
  }

  if (weatherEffects.rain.visible) {
    const attr = weatherEffects.rain.geometry.attributes.position;
    const arr = attr.array;
    for (let i = 0; i < weatherEffects.rainSpeeds.length; i += 1) {
      const index = i * 3;
      arr[index + 1] -= weatherEffects.rainSpeeds[i] * deltaSeconds;
      arr[index] += Math.sin(elapsedTime * 2.4 + i) * deltaSeconds * 1.1;
      if (arr[index + 1] < -2.2) {
        arr[index + 1] = 74 + Math.random() * 22;
        arr[index] = -120 + Math.random() * 240;
        arr[index + 2] = -120 + Math.random() * 240;
      }
    }
    attr.needsUpdate = true;
  }

  if (weatherEffects.mistLayer.visible) {
    weatherEffects.mistLayer.rotation.z = Math.sin(elapsedTime * 0.08) * 0.08;
    weatherEffects.mistLayer.position.y = 7.1 + Math.sin(elapsedTime * 0.18) * 0.35;
  }

  if (activeSkyCase === 'storm') {
    if (weatherEffects.flashTimer <= 0 && Math.random() < deltaSeconds * 0.6) {
      weatherEffects.flashTimer = 0.08 + Math.random() * 0.18;
      weatherEffects.stormFlash.position.set(-40 + Math.random() * 80, 46 + Math.random() * 18, -30 + Math.random() * 60);
      weatherEffects.stormFlash.intensity = 1.8 + Math.random() * 1.6;
    }
  }

  if (weatherEffects.flashTimer > 0) {
    weatherEffects.flashTimer -= deltaSeconds;
    weatherEffects.stormFlash.intensity = Math.max(0, weatherEffects.stormFlash.intensity - deltaSeconds * 12);
  } else {
    weatherEffects.stormFlash.intensity = 0;
  }
}

function resolveSkyCase(weather = {}) {
  const conditionCode = String(weather.conditionCode || '').toUpperCase();
  const conditionLabel = String(weather.condition || '').toLowerCase();
  const theme = String(weather.theme || '').toLowerCase();
  const humidity = Number(weather.humidity);
  const temperatureC = Number(weather.temperatureC);
  const joined = `${conditionCode} ${conditionLabel} ${theme}`;

  if (joined.includes('THUNDER') || joined.includes('STORM')) {
    return {
      key: 'storm',
      background: 0x3b4454,
      fogColor: 0x8f99ab,
      fogDensity: 0.008,
      sunColor: 0xb6c7de,
      sunIntensity: 0.35,
      ambientIntensity: 0.34,
      hemiSky: 0xaebad0,
      hemiGround: 0x4d463f,
      hemiIntensity: 0.45
    };
  }

  if (joined.includes('RAIN') || joined.includes('DRIZZLE') || joined.includes('SHOWER')) {
    return {
      key: 'rain',
      background: 0x5d6f86,
      fogColor: 0xa5b4c7,
      fogDensity: 0.007,
      sunColor: 0xc8d8e8,
      sunIntensity: 0.45,
      ambientIntensity: 0.4,
      hemiSky: 0xc4d4e5,
      hemiGround: 0x595047,
      hemiIntensity: 0.5
    };
  }

  if (joined.includes('FOG') || joined.includes('MIST')) {
    return {
      key: 'mist',
      background: 0xc4cfda,
      fogColor: 0xd7dfe8,
      fogDensity: 0.01,
      sunColor: 0xe7eef3,
      sunIntensity: 0.33,
      ambientIntensity: 0.46,
      hemiSky: 0xe5ecf3,
      hemiGround: 0x666056,
      hemiIntensity: 0.5
    };
  }

  if (joined.includes('CLOUD') || joined.includes('OVERCAST')) {
    return {
      key: 'cloudy',
      background: 0x7d92ab,
      fogColor: 0xbdcbe0,
      fogDensity: 0.006,
      sunColor: 0xd2dfee,
      sunIntensity: 0.56,
      ambientIntensity: 0.43,
      hemiSky: 0xd7e5f2,
      hemiGround: 0x5b5248,
      hemiIntensity: 0.54
    };
  }

  if (Number.isFinite(humidity) && Number.isFinite(temperatureC) && humidity >= 75 && temperatureC >= 31) {
    return {
      key: 'humid-heat',
      background: 0x87a8c4,
      fogColor: 0xcbe1ef,
      fogDensity: 0.0075,
      sunColor: 0xffe6bd,
      sunIntensity: 0.78,
      ambientIntensity: 0.44,
      hemiSky: 0xe5f3ff,
      hemiGround: 0x645547,
      hemiIntensity: 0.57
    };
  }

  return {
    key: 'sunny',
    background: 0x5b8ec5,
    fogColor: 0xc7def1,
    fogDensity: 0.0045,
    sunColor: 0xffefca,
    sunIntensity: 0.86,
    ambientIntensity: 0.42,
    hemiSky: 0xeaf6ff,
    hemiGround: 0x5a4d3d,
    hemiIntensity: 0.55
  };
}

export function applyLiveWeatherToScene(weather = {}) {
  if (!scene) {
    return;
  }

  const skyCase = resolveSkyCase(weather);
  activeSkyCase = skyCase.key;
  scene.background = new THREE.Color(skyCase.background);

  if (scene.fog) {
    scene.fog.color.setHex(skyCase.fogColor);
    scene.fog.density = skyCase.fogDensity;
  }

  if (directionalLightRef) {
    directionalLightRef.color.setHex(skyCase.sunColor);
    directionalLightRef.intensity = skyCase.sunIntensity;
  }

  if (ambientLightRef) {
    ambientLightRef.intensity = skyCase.ambientIntensity;
  }

  if (hemiLightRef) {
    hemiLightRef.color.setHex(skyCase.hemiSky);
    hemiLightRef.groundColor.setHex(skyCase.hemiGround);
    hemiLightRef.intensity = skyCase.hemiIntensity;
  }

  updateWeatherEffectState(weather, skyCase.key);

  document.body.dataset.skyCase = skyCase.key;
}

function disposeMaterial(material) {
  if (!material) {
    return;
  }

  if (Array.isArray(material)) {
    material.forEach((item) => {
      if (item && item.dispose) {
        item.dispose();
      }
    });
    return;
  }

  if (material.dispose) {
    material.dispose();
  }
}

function disposeObject3D(object) {
  if (!object) {
    return;
  }

  object.traverse((child) => {
    if (child.geometry && child.geometry.dispose) {
      child.geometry.dispose();
    }
    if (child.material) {
      disposeMaterial(child.material);
    }
  });
}

function clearSceneObjects() {
  Object.values(sceneObjects).forEach((obj) => {
    scene.remove(obj);
    disposeObject3D(obj);
  });
  sceneObjects = {};
}

function createGroundTexture(baseHex, strokeHex, gridStep = 64) {
  const size = 512;
  const canvasEl = document.createElement('canvas');
  canvasEl.width = size;
  canvasEl.height = size;
  const ctx = canvasEl.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.fillStyle = `#${baseHex.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = `#${strokeHex.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = 2;
  for (let x = 0; x <= size; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  for (let i = 0; i < 240; i += 1) {
    ctx.globalAlpha = 0.14 + Math.random() * 0.1;
    ctx.fillStyle = `#${(strokeHex + (Math.random() > 0.5 ? 0x101010 : -0x101010)).toString(16).replace('-', '').padStart(6, '0').slice(0, 6)}`;
    const px = Math.random() * size;
    const py = Math.random() * size;
    const r = 2 + Math.random() * 7;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvasEl);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  texture.anisotropy = 4;
  return texture;
}

function createRefinedEngineer(config = {}) {
  const group = new THREE.Group();
  const suitMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0x222222, emissiveIntensity: 0.2 });
  const hatMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.35, metalness: 0.1 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8, 10), suitMat);
  body.position.y = 0.9;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), new THREE.MeshStandardMaterial({ color: 0xe8d7c4, roughness: 0.7 }));
  head.position.y = 1.76;
  group.add(head);

  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
  hat.position.y = 1.96;
  group.add(hat);

  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.86, 6), new THREE.MeshStandardMaterial({ color: 0x2e2e2e, roughness: 0.75 }));
  leftLeg.position.set(-0.08, 0.42, 0.03);
  group.add(leftLeg);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.08;
  group.add(rightLeg);

  if (config.hasPapers) {
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    paper.rotation.x = -Math.PI / 4;
    paper.position.set(0.36, 1.2, 0.28);
    group.add(paper);
  }

  group.userData = { kind: 'refined-engineer', hasTheodolite: !!config.hasTheodolite };
  return group;
}

function createTheodolite() {
  const tripod = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.55, metalness: 0.25 });
  const scopeMat = new THREE.MeshStandardMaterial({ color: 0xc9a21a, roughness: 0.35, metalness: 0.2 });

  for (let i = 0; i < 3; i += 1) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), legMat);
    leg.position.set(Math.cos(i * 2.1) * 0.18, 0.6, Math.sin(i * 2.1) * 0.18);
    leg.rotation.z = i === 0 ? 0.26 : -0.18;
    leg.rotation.x = i === 2 ? 0.2 : 0;
    tripod.add(leg);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), scopeMat);
  head.position.y = 1.18;
  tripod.add(head);

  const scope = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.24), scopeMat);
  scope.position.set(0.06, 1.28, 0);
  tripod.add(scope);

  const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 8), legMat);
  eyepiece.rotation.z = Math.PI / 2;
  eyepiece.position.set(0.28, 1.28, 0);
  tripod.add(eyepiece);

  tripod.userData = { kind: 'theodolite' };
  return tripod;
}

function createImmersiveBWE() {
  const machine = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.35 });
  const hazardMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.28, metalness: 0.35 });
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x2d2d2d,
    metalness: 0.55,
    roughness: 0.55,
    transparent: true,
    opacity: 0.42,
    depthWrite: false
  });

  const chassisDeck = new THREE.Mesh(new THREE.BoxGeometry(25, 1.1, 15), steelMat);
  chassisDeck.position.y = 5.5;
  chassisDeck.castShadow = true;
  chassisDeck.receiveShadow = true;
  machine.add(chassisDeck);

  const railLeft = new THREE.Mesh(new THREE.BoxGeometry(25, 2.5, 1.1), steelMat);
  railLeft.position.set(0, 3.3, -6.95);
  railLeft.castShadow = true;
  machine.add(railLeft);

  const railRight = new THREE.Mesh(new THREE.BoxGeometry(25, 2.5, 1.1), steelMat);
  railRight.position.set(0, 3.3, 6.95);
  railRight.castShadow = true;
  machine.add(railRight);

  const frontBeam = new THREE.Mesh(new THREE.BoxGeometry(25, 1.3, 1.0), steelMat);
  frontBeam.position.set(0, 2.0, -7.0);
  frontBeam.castShadow = true;
  machine.add(frontBeam);

  const backBeam = new THREE.Mesh(new THREE.BoxGeometry(25, 1.3, 1.0), steelMat);
  backBeam.position.set(0, 2.0, 7.0);
  backBeam.castShadow = true;
  machine.add(backBeam);

  const centerPanel = new THREE.Mesh(new THREE.BoxGeometry(12, 2.3, 0.25), panelMat);
  centerPanel.position.set(0, 3.25, -6.25);
  machine.add(centerPanel);

  const supportOffsets = [
    [-10, 2.6, -5.8],
    [-10, 2.6, 5.8],
    [-2, 2.6, -5.8],
    [-2, 2.6, 5.8],
    [6, 2.6, -5.8],
    [6, 2.6, 5.8],
    [12, 2.6, -5.8],
    [12, 2.6, 5.8]
  ];
  supportOffsets.forEach(([x, y, z]) => {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.6, 0.9), steelMat);
    support.position.set(x, y, z);
    support.castShadow = true;
    machine.add(support);
  });

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(4, 4, 4),
    new THREE.MeshStandardMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.8, roughness: 0.25, metalness: 0.2 })
  );
  cabin.position.set(-6, 8, 0);
  machine.add(cabin);

  const boom = new THREE.Mesh(new THREE.BoxGeometry(40, 2, 3), hazardMat);
  boom.position.set(15, 12, 0);
  boom.castShadow = true;
  machine.add(boom);

  const wheelGroup = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(8, 0.6, 16, 50), steelMat);
  wheelGroup.add(rim);

  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const bucket = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 3), hazardMat);
    bucket.position.set(Math.cos(angle) * 8, Math.sin(angle) * 8, 0);
    bucket.rotation.x = angle;
    wheelGroup.add(bucket);
  }
  wheelGroup.position.set(35, 12, 0);
  wheelGroup.rotation.y = Math.PI / 2;
  machine.add(wheelGroup);

  const dustCount = 160;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustVelocities = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i += 1) {
    const index = i * 3;
    dustPositions[index] = 25 + Math.random() * 22;
    dustPositions[index + 1] = 5.5 + Math.random() * 8;
    dustPositions[index + 2] = -7 + Math.random() * 14;
    dustVelocities[index] = 0.1 + Math.random() * 0.18;
    dustVelocities[index + 1] = 0.45 + Math.random() * 0.7;
    dustVelocities[index + 2] = (Math.random() - 0.5) * 0.28;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = new THREE.PointsMaterial({
    color: 0xc2a16c,
    size: 0.28,
    transparent: true,
    opacity: 0.34,
    depthWrite: false
  });
  const dustPoints = new THREE.Points(dustGeometry, dustMaterial);
  machine.add(dustPoints);

  machine.userData = { kind: 'immersive-bwe', wheelGroup, cabin, dustPoints, dustVelocities };
  return machine;
}

function setScene1VillagerPose(villager, mode, gait = 0) {
  if (!villager?.userData) {
    return;
  }

  const data = villager.userData;
  if (mode === 'sitting') {
    if (data.torso) {
      data.torso.rotation.x = 0.55;
    }
    if (data.hips) {
      data.hips.position.y = 0.22;
    }
    if (data.leftLeg) {
      data.leftLeg.rotation.x = -1.05;
    }
    if (data.rightLeg) {
      data.rightLeg.rotation.x = -1.0;
    }
    if (data.leftArm) {
      data.leftArm.rotation.x = -0.35;
    }
    if (data.rightArm) {
      data.rightArm.rotation.x = -0.4;
    }
    return;
  }

  if (mode === 'crawl') {
    if (data.torso) {
      data.torso.rotation.x = 1.08 + Math.sin(gait * 1.2) * 0.06;
    }
    if (data.hips) {
      data.hips.position.y = 0.28;
    }
    if (data.leftLeg) {
      data.leftLeg.rotation.x = -0.45 + Math.sin(gait) * 0.22;
    }
    if (data.rightLeg) {
      data.rightLeg.rotation.x = -0.45 - Math.sin(gait) * 0.22;
    }
    if (data.leftArm) {
      data.leftArm.rotation.x = 0.95 + Math.sin(gait) * 0.28;
    }
    if (data.rightArm) {
      data.rightArm.rotation.x = 0.95 - Math.sin(gait) * 0.28;
    }
    return;
  }

  if (data.hips) {
    data.hips.position.y = 0.42;
  }
  if (data.torso) {
    data.torso.rotation.x = 0.26 + Math.sin(gait) * 0.05;
  }
  if (data.leftLeg) {
    data.leftLeg.rotation.x = Math.sin(gait) * 0.68;
  }
  if (data.rightLeg) {
    data.rightLeg.rotation.x = -Math.sin(gait) * 0.68;
  }
  if (data.leftArm) {
    data.leftArm.rotation.x = -Math.sin(gait) * 0.52;
  }
  if (data.rightArm) {
    data.rightArm.rotation.x = Math.sin(gait) * 0.52;
  }
}

function buildScene1System() {
  const root = new THREE.Group();
  const villagerGroundY = 0.62;

  // Background terrain layer
  const terrainGeometry = new THREE.PlaneGeometry(280, 280, 64, 64);
  const vertices = terrainGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i += 1) {
    const x = vertices.getX(i);
    const z = vertices.getY(i);
    const undulation = Math.sin(x * 0.035) * 0.8 + Math.cos(z * 0.028) * 0.6;
    const ripple = Math.sin((x + z * 0.5) * 0.08) * 0.4;
    vertices.setZ(i, undulation + ripple - 0.88);
  }
  terrainGeometry.computeVertexNormals();

  const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a8a3f,
    roughness: 0.94,
    metalness: 0.02
  });
  const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrain.rotation.x = -Math.PI / 2;
  terrain.receiveShadow = true;
  terrain.position.y = -0.4;
  root.add(terrain);

  // Water patches - organic puddle shapes around the trench scar
  const waterPatchCount = 12;
  const waterPatchSeeds = [
    [-85, -60], [-65, -72], [-40, -65], [-10, -75], [35, -68], [70, -58],
    [85, -35], [92, 10], [78, 45], [-92, 35], [-65, 50], [-20, 58]
  ];

  for (let i = 0; i < waterPatchCount; i += 1) {
    const seed = waterPatchSeeds[i];
    const patchSize = 8 + Math.random() * 6;
    const waterPatchGeom = new THREE.CircleGeometry(patchSize / 2, 32);
    const posAttr = waterPatchGeom.attributes.position;
    for (let j = 0; j < posAttr.count; j += 1) {
      const x = posAttr.getX(j);
      const y = posAttr.getY(j);
      const angle = Math.atan2(y, x);
      const radius = Math.sqrt((x * x) + (y * y));
      const noise = Math.sin(angle * (3 + (i % 5)) + i * 0.7) * 0.8;
      const radial = radius + noise;
      posAttr.setXY(j, Math.cos(angle) * radial, Math.sin(angle) * radial);
    }
    waterPatchGeom.computeVertexNormals();
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1a2b3c,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.72
    });
    const waterPatch = new THREE.Mesh(waterPatchGeom, waterMat);
    waterPatch.rotation.x = -Math.PI / 2;
    waterPatch.position.set(
      seed[0] + (Math.random() - 0.5) * 6,
      -0.32,
      seed[1] + (Math.random() - 0.5) * 6
    );
    root.add(waterPatch);
  }

  // Dense grass patches around water and trench scar edges
  const grassPatchCount = 48;
  const grassSeeds = [
    // Along trench edges and water patches
    [-90, -20], [-75, -18], [-60, -16], [-45, -20], [-30, -18], [-15, -22], [0, -20], [15, -18], [30, -20], [45, -18], [60, -16], [75, -20], [85, -18],
    [-88, -10], [-70, -8], [-50, -12], [-25, -10], [20, -8], [50, -10], [80, -12],
    [-92, 0], [-72, 2], [-48, 0], [-18, 2], [15, 0], [55, 2], [82, 0],
    [-85, 8], [-65, 10], [-40, 8], [-10, 12], [25, 10], [60, 8], [85, 12],
    [-80, 18], [-55, 20], [-28, 18], [5, 22], [40, 20], [70, 18]
  ];
  for (let i = 0; i < grassPatchCount; i += 1) {
    const seed = grassSeeds[i % grassSeeds.length];
    const grass = createTallGrassPatch({
      bladeCount: 14 + (i % 5) * 2,
      baseColor: i % 3 === 0 ? 0x7ab950 : 0x6ba844,
      tipColor: i % 2 === 0 ? 0x9fd577 : 0x8ec561,
      swayPhase: i * 0.6,
      swaySpeed: 0.58 + (i % 4) * 0.08,
      swayAmount: 0.14 + (i % 3) * 0.03
    });
    grass.position.set(
      seed[0] + (Math.random() - 0.5) * 5,
      -0.15,
      seed[1] + (Math.random() - 0.5) * 4
    );
    grass.rotation.y = Math.random() * Math.PI * 2;
    grass.scale.setScalar(1.0 + Math.random() * 0.65);
    root.add(grass);
  }

  // Vegetation: papyrus patches
  const papyrusCount = 35;
  const papyrusSeeds = [
    [-88, -55], [-72, -68], [-50, -70], [-25, -75], [15, -72], [50, -65], [80, -50],
    [-95, -20], [-80, 10], [-60, 35], [-35, 55], [-10, 62], [25, 58], [70, 48], [88, 25],
    [-90, 42], [-70, 55], [-40, 68], [0, 70], [40, 65], [75, 52]
  ];
  for (let i = 0; i < papyrusCount; i += 1) {
    const seed = papyrusSeeds[i % papyrusSeeds.length];
    const papyrus = createPapyrus({
      swayPhase: i * 0.4,
      swaySpeed: 0.52 + (i % 5) * 0.06,
      swayAmount: 0.09 + (i % 3) * 0.02,
      stalkColor: i % 3 === 0 ? 0x4a7a2b : 0x5a8a3b,
      crownColor: i % 2 === 0 ? 0x7ba54f : 0x6d9545
    });
    papyrus.position.set(
      seed[0] + (Math.random() - 0.5) * 7,
      -0.18,
      seed[1] + (Math.random() - 0.5) * 7
    );
    papyrus.rotation.y = Math.random() * Math.PI * 2;
    papyrus.scale.setScalar(0.85 + Math.random() * 0.5);
    root.add(papyrus);
  }

  // Scattered huts in the background
  const hutSeeds = [
    [-75, -45, 0.8], [-50, -62, 1.0], [45, -55, 0.9], [75, -40, 0.95],
    [-82, 25, 1.1], [-42, 50, 0.85], [30, 52, 1.05], [70, 35, 0.9],
    [-65, 65, 0.75], [15, 68, 0.8], [55, 60, 0.95]
  ];
  for (let i = 0; i < hutSeeds.length; i += 1) {
    const [seedX, seedZ, scale] = hutSeeds[i];
    const hut = createCircularHut({
      wallColor: i % 4 === 0 ? 0x9a8566 : 0x8f7f5f,
      roofColor: i % 3 === 0 ? 0x7a5a39 : 0x6d4f33,
      accentColor: i % 2 === 0 ? 0x564838 : 0x4a3c2f,
      wallRadius: 1.4 + (i % 2) * 0.15,
      wallHeight: 1.8 + (i % 2) * 0.08,
      roofHeight: 1.95 + (i % 3) * 0.1,
      fenceCount: 6 + (i % 3)
    });
    hut.position.set(
      seedX + (Math.random() - 0.5) * 3,
      0,
      seedZ + (Math.random() - 0.5) * 3
    );
    hut.rotation.y = Math.atan2(-hut.position.x, -hut.position.z);
    hut.scale.setScalar(scale * (0.8 + Math.random() * 0.25));
    root.add(hut);
  }

  const trenchGeometry = new THREE.BoxGeometry(280, 3.6, 16, 40, 1, 10);
  const trenchPos = trenchGeometry.attributes.position;
  for (let i = 0; i < trenchPos.count; i += 1) {
    const y = trenchPos.getY(i);
    if (y > 0) {
      const x = trenchPos.getX(i);
      const z = trenchPos.getZ(i);
      const digMarks = Math.sin(x * 0.5) * 0.15 + Math.cos(z * 0.8) * 0.1;
      const edgeSlump = Math.abs(z) > 6.5 ? -0.3 : 0;
      trenchPos.setY(i, y + digMarks + edgeSlump);
      trenchPos.setX(i, x + (Math.random() - 0.5) * 0.2);
      trenchPos.setZ(i, z + (Math.random() - 0.5) * 0.2);
    }
  }
  trenchGeometry.computeVertexNormals();

  const trenchScar = new THREE.Mesh(
    trenchGeometry,
    new THREE.MeshStandardMaterial({ color: 0x6e4b30, roughness: 0.95, metalness: 0.03 })
  );
  trenchScar.position.set(0, -0.95, -20);
  trenchScar.receiveShadow = true;
  root.add(trenchScar);

  // Top face of trench scar is at y = 0.85; keep wetland wound details just above it.
  const TRENCH_SURFACE_Y = 0.86;

  const stagnantWater = new THREE.Group();
  const trenchWaterSeeds = [[-80, -21], [-40, -20], [0, -22], [45, -19], [80, -20]];
  trenchWaterSeeds.forEach(([x, z], idx) => {
    const patchSize = 7 + Math.random() * 5;
    const waterPatchGeom = new THREE.CircleGeometry(patchSize / 2, 32);
    const pos = waterPatchGeom.attributes.position;
    for (let j = 0; j < pos.count; j += 1) {
      const vx = pos.getX(j);
      const vy = pos.getY(j);
      const angle = Math.atan2(vy, vx);
      const noise = Math.sin(angle * (3 + (idx % 3))) * 0.8 + Math.cos(angle * 7) * 0.3;
      pos.setXY(j, vx + Math.cos(angle) * noise, vy + Math.sin(angle) * noise);
    }
    waterPatchGeom.computeVertexNormals();

    const muddyRim = new THREE.Mesh(
      waterPatchGeom,
      new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 1, metalness: 0 })
    );
    muddyRim.rotation.x = -Math.PI / 2;
    muddyRim.scale.set(1.15, 1.15, 1);
    muddyRim.position.set(x, TRENCH_SURFACE_Y + 0.01, z);
    root.add(muddyRim);

    const waterPatch = new THREE.Mesh(
      waterPatchGeom,
      new THREE.MeshStandardMaterial({
        color: 0x1a2b3c,
        roughness: 0.14,
        metalness: 0.4,
        transparent: true,
        opacity: 0.65
      })
    );
    waterPatch.rotation.x = -Math.PI / 2;
    waterPatch.position.set(x, TRENCH_SURFACE_Y + 0.02, z);
    stagnantWater.add(waterPatch);
  });
  root.add(stagnantWater);

  const snailClusters = [];
  const snailSeeds = [
    [-84, -23], [-60, -22], [-35, -21], [-8, -21], [20, -21], [48, -22], [74, -23]
  ];
  snailSeeds.forEach((seed, idx) => {
    const cluster = new THREE.Group();
    for (let i = 0; i < 6 + (idx % 2); i += 1) {
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xeeeeee })
      );
      shell.position.set((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8);
      cluster.add(shell);
    }
    cluster.position.set(seed[0], TRENCH_SURFACE_Y + 0.05, seed[1]);
    cluster.rotation.y = idx * 0.65;
    root.add(cluster);
    snailClusters.push(cluster);
  });

  trenchWaterSeeds.forEach(([wx, wz], idx) => {
    for (let k = 0; k < 3; k += 1) {
      const mat = createFloatingMat({
        radius: 0.8 + Math.random(),
        color: 0x4a5d32
      });
      mat.position.set(
        wx + (Math.random() - 0.5) * 8,
        TRENCH_SURFACE_Y + 0.02,
        wz + (Math.random() - 0.5) * 5
      );
      root.add(mat);

      if ((idx + k) % 2 === 0) {
        const dyingPapyrus = createPapyrus({
          stalkColor: 0x5a4a37,
          crownColor: 0x6d5a45,
          height: 1.5 + Math.random()
        });
        dyingPapyrus.position.copy(mat.position);
        root.add(dyingPapyrus);
      }
    }
  });

  const ghostTrees = [];
  const ghostTreeSeeds = [
    [-72, -24], [-58, -16], [-42, -10], [42, -24], [58, -16], [74, -10], [-18, -29], [18, -29]
  ];
  ghostTreeSeeds.forEach((seed, idx) => {
    const ghostTree = createVillageTree({
      ghostTree: true,
      trunkColor: idx % 2 === 0 ? 0x64594d : 0x70645b,
      foliageColor: idx % 2 === 0 ? 0x7b756b : 0x8a8379
    });
    ghostTree.position.set(seed[0], 0, seed[1]);
    ghostTree.scale.setScalar(0.72 + (idx % 3) * 0.08);
    ghostTree.rotation.y = Math.atan2(-seed[0], -seed[1]);
    root.add(ghostTree);
    ghostTrees.push(ghostTree);
  });

  const bwe = createImmersiveBWE();
  bwe.position.set(0, 0, -20);
  root.add(bwe);

  const engineers = [];
  const engineerDeckPositions = [
    [-6, 6.5, -20],
    [-1.5, 6.4, -18.5],
    [3.2, 6.2, -21],
    [-8.2, 7.1, -19.2],
    [5.8, 6.0, -19.4],
    [1.5, 7.2, -20.8]
  ];
  engineerDeckPositions.forEach((position, idx) => {
    const engineer = createRefinedEngineer({ hasPapers: idx % 2 === 0, hasTheodolite: idx === 0 });
    engineer.position.set(...position);
    engineer.scale.setScalar(1.65);
    engineer.rotation.y = -0.2 + idx * 0.08;
    if (idx === 0) {
      const theodolite = createTheodolite();
      theodolite.position.set(-0.35, 0.1, 0.55);
      theodolite.rotation.y = 0.45;
      engineer.add(theodolite);
      engineer.userData.lookTarget = new THREE.Vector3(52, 7.2, -34);
    }
    root.add(engineer);
    engineers.push(engineer);
  });

  // Small pastoral group kept away from the excavator.
  const nearbyCattle = [];
  const nearbyFarmers = [];

  const cattlePositions = [
    [34, 0, -6],
    [40, 0, -3],
    [28, 0, -1]
  ];
  cattlePositions.forEach((position, idx) => {
    const cow = createCow({
      group: idx % 2 === 0 ? 'Dinka' : 'Nuer',
      direction: idx % 2 === 0 ? 1 : -1,
      grazeSpeed: 0.26,
      driftSpeed: 0.04
    });
    cow.position.set(...position);
    cow.scale.setScalar(1.22);
    cow.rotation.y = -1.05 + idx * 0.35;
    root.add(cow);
    nearbyCattle.push(cow);
  });

  const farmerPositions = [
    [31, villagerGroundY, -8],
    [37, villagerGroundY, 1]
  ];
  farmerPositions.forEach((position, idx) => {
    const farmer = createVillageWorker({
      role: 'farmer',
      group: idx % 2 === 0 ? 'Dinka' : 'Nuer',
      actionSpeed: 0.62,
      stepSpeed: 0.24,
      direction: -1
    });
    farmer.position.set(...position);
    farmer.scale.setScalar(1.45);
    farmer.rotation.y = -1.1 + idx * 0.25;
    root.add(farmer);
    nearbyFarmers.push(farmer);
  });

  const villagers = [];
  const villagerCount = 20;
  for (let i = 0; i < villagerCount; i += 1) {
    const villager = createNiloticHuman({
      group: i % 2 === 0 ? 'Nuer' : 'Dinka',
      role: i % 3 === 0 ? 'fisher' : 'carrier',
      actionPhase: i * 0.2,
      actionSpeed: 0.75,
      stepSpeed: 0.95,
      direction: 1
    });
    const angle = (i / villagerCount) * Math.PI * 2;
    const radius = 26 + (i % 5) * 2.3;
    const startX = Math.cos(angle) * radius;
    const startZ = -20 + Math.sin(angle) * radius;
    const isDriverConfronter = i === 3;
    const stayBack = !isDriverConfronter && (i % 5 === 0 || i % 6 === 0);
    const isClimber = !stayBack && (isDriverConfronter || i % 4 === 0);
    const frontEdgeZ = -12.15 + Math.sin(angle) * 0.35;
    const climbPath = isClimber
      ? [
        new THREE.Vector3(Math.cos(angle) * 8.8, villagerGroundY, frontEdgeZ - 1.0),
        new THREE.Vector3(Math.cos(angle) * 6.9, 1.35, frontEdgeZ),
        new THREE.Vector3(Math.cos(angle) * 5.9, 6.15, frontEdgeZ - 0.75),
        isDriverConfronter
          ? new THREE.Vector3(-6, 6.4, -20.2)
          : new THREE.Vector3(Math.cos(angle) * 5.4, 6.2, -20 + Math.sin(angle) * 2.4)
      ]
      : null;
    const runTarget = new THREE.Vector3(
      Math.cos(angle) * 9,
      isClimber ? 2.1 : villagerGroundY,
      -20 + Math.sin(angle) * 7
    );

    villager.position.set(startX, villagerGroundY, startZ);
    villager.rotation.y = Math.atan2(runTarget.x - startX, runTarget.z - startZ);
    villager.scale.setScalar(1.55);
    setScene1VillagerPose(villager, 'sitting');

    villager.userData.scene1 = {
      stayBack,
      isClimber,
      isDriverConfronter,
      runTarget: isDriverConfronter ? new THREE.Vector3(-6, 6.4, -20.2) : runTarget,
      runSpeed: isDriverConfronter ? 6.1 : 3.8,
      crawlSpeed: isDriverConfronter ? 3.9 : 2.8,
      climbSpeed: isDriverConfronter ? 4.8 : 3.3,
      startedRunning: false,
      reachedTarget: false,
      movementPhase: 'sitting',
      pathIndex: 0,
      climbPath,
      startPosition: new THREE.Vector3(startX, villagerGroundY, startZ),
      startRotation: villager.rotation.y,
      groundY: villagerGroundY
    };
    root.add(villager);
    villagers.push(villager);
  }

  const weatherDustCount = 520;
  const weatherDustGeometry = new THREE.BufferGeometry();
  const weatherDustPositions = new Float32Array(weatherDustCount * 3);
  const weatherDustVelocities = new Float32Array(weatherDustCount * 3);
  for (let i = 0; i < weatherDustCount; i += 1) {
    const idx = i * 3;
    weatherDustPositions[idx] = -130 + Math.random() * 260;
    weatherDustPositions[idx + 1] = 5 + Math.random() * 18;
    weatherDustPositions[idx + 2] = -95 + Math.random() * 150;
    weatherDustVelocities[idx] = 0.18 + Math.random() * 0.25;
    weatherDustVelocities[idx + 1] = -0.015 + Math.random() * 0.03;
    weatherDustVelocities[idx + 2] = -0.02 + Math.random() * 0.04;
  }
  weatherDustGeometry.setAttribute('position', new THREE.BufferAttribute(weatherDustPositions, 3));
  const weatherDustPoints = new THREE.Points(
    weatherDustGeometry,
    new THREE.PointsMaterial({
      color: 0x4a4e55,
      size: 0.9,
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    })
  );
  root.add(weatherDustPoints);

  scene.add(root);
  return {
    root,
    trenchScar,
    stagnantWater,
    snailClusters,
    ghostTrees,
    bwe,
    wheelGroup: bwe.userData.wheelGroup,
    dustPoints: bwe.userData.dustPoints,
    dustVelocities: bwe.userData.dustVelocities,
    engineers,
    nearbyCattle,
    nearbyFarmers,
    villagers,
    weatherDustPoints,
    weatherDustVelocities,
    surveyor: engineers[0],
    actionStartTime: null,
    loopRestartTime: null
  };
}

function updateScene1(deltaSeconds, elapsedTime) {
  if (!scene1Runtime) {
    return;
  }

  if (scene1Runtime.wheelGroup) {
    scene1Runtime.wheelGroup.rotation.x += deltaSeconds * SCENE1_WHEEL_ROTATION_SPEED;
  }

  if (scene1Runtime.actionStartTime === null) {
    scene1Runtime.actionStartTime = elapsedTime;
  }

  const sceneElapsed = elapsedTime - scene1Runtime.actionStartTime;
  const shouldRun = sceneElapsed > 2.4;
  let climberCount = 0;
  let climbersReached = 0;

  if (Array.isArray(scene1Runtime.villagers)) {
    scene1Runtime.villagers.forEach((villager, idx) => {
      const state = villager.userData?.scene1;
      if (!state) {
        return;
      }

      if (state.isClimber) {
        climberCount += 1;
      }

      const gait = elapsedTime * (state.isDriverConfronter ? 8 : 6.2) + idx * 0.25;
      if (state.stayBack) {
        setScene1VillagerPose(villager, 'sitting', gait);
        villager.position.y = Math.max(villager.position.y, state.groundY);
        const lookX = -villager.position.x;
        const lookZ = -20 - villager.position.z;
        villager.rotation.y = Math.atan2(lookX, lookZ);
        state.reachedTarget = false;
        state.movementPhase = 'watching';
        return;
      }

      if (!shouldRun) {
        setScene1VillagerPose(villager, 'sitting', gait);
        villager.position.y = Math.max(villager.position.y, state.groundY);
        state.reachedTarget = false;
        state.movementPhase = 'sitting';
        state.pathIndex = 0;
        return;
      }

      state.startedRunning = true;
      const target = state.isClimber
        ? state.climbPath[Math.min(state.pathIndex, state.climbPath.length - 1)]
        : state.runTarget;
      const toTargetX = target.x - villager.position.x;
      const toTargetY = target.y - villager.position.y;
      const toTargetZ = target.z - villager.position.z;
      const distance = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY + toTargetZ * toTargetZ);

      if (state.isClimber) {
        if (state.pathIndex <= 1) {
          state.movementPhase = 'crawl';
          setScene1VillagerPose(villager, 'crawl', gait);
        } else {
          state.movementPhase = 'climb';
          setScene1VillagerPose(villager, 'running', gait);
        }
      } else {
        state.movementPhase = 'run';
        setScene1VillagerPose(villager, 'running', gait);
      }

      if (distance > 0.25) {
        let moveSpeed = state.runSpeed;
        if (state.isClimber && state.pathIndex <= 1) {
          moveSpeed = state.crawlSpeed;
        } else if (state.isClimber) {
          moveSpeed = state.climbSpeed;
        }

        const step = Math.min(distance, moveSpeed * deltaSeconds);
        villager.position.x += (toTargetX / distance) * step;
        villager.position.y += (toTargetY / distance) * step;
        villager.position.z += (toTargetZ / distance) * step;
        villager.rotation.y = Math.atan2(toTargetX, toTargetZ);
        villager.position.y = Math.max(villager.position.y, state.groundY);
        state.reachedTarget = false;
      } else {
        if (state.isClimber && state.pathIndex < state.climbPath.length - 1) {
          state.pathIndex += 1;
          state.reachedTarget = false;
        } else {
          state.reachedTarget = true;
        }

        if (!state.isClimber) {
          villager.position.y = state.groundY;
        }
      }

      if (state.isClimber && state.reachedTarget) {
        climbersReached += 1;
      }
    });
  }

  // Restart the sit -> run -> climb choreography once climbers are in position.
  if (shouldRun && climberCount > 0 && climbersReached === climberCount) {
    if (scene1Runtime.loopRestartTime === null) {
      scene1Runtime.loopRestartTime = elapsedTime;
    }
  } else {
    scene1Runtime.loopRestartTime = null;
  }

  if (scene1Runtime.loopRestartTime !== null && elapsedTime - scene1Runtime.loopRestartTime > 0.65) {
    scene1Runtime.villagers.forEach((villager) => {
      const state = villager.userData?.scene1;
      if (!state) {
        return;
      }
      villager.position.copy(state.startPosition);
      villager.rotation.y = state.startRotation;
      state.startedRunning = false;
      state.reachedTarget = false;
      state.movementPhase = 'sitting';
      state.pathIndex = 0;
      setScene1VillagerPose(villager, 'sitting');
    });
    scene1Runtime.actionStartTime = elapsedTime;
    scene1Runtime.loopRestartTime = null;
  }

  if (Array.isArray(scene1Runtime.engineers)) {
    scene1Runtime.engineers.forEach((engineer, idx) => {
      engineer.position.y += Math.sin(elapsedTime * 1.1 + idx * 0.3) * 0.004;
      engineer.rotation.y += Math.sin(elapsedTime * 0.7 + idx) * 0.0007;
    });
  }

  if (scene1Runtime.bwe?.userData?.cabin) {
    const cabin = scene1Runtime.bwe.userData.cabin;
    cabin.material.opacity = 0.74 + Math.sin(elapsedTime * 1.6) * 0.04;
  }

  if (scene1Runtime.surveyor?.userData?.lookTarget) {
    scene1Runtime.surveyor.lookAt(scene1Runtime.surveyor.userData.lookTarget);
  }

  if (scene1Runtime.dustPoints?.geometry?.attributes?.position && scene1Runtime.dustVelocities) {
    const attr = scene1Runtime.dustPoints.geometry.attributes.position;
    const arr = attr.array;
    const velocities = scene1Runtime.dustVelocities;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += velocities[i] * deltaSeconds;
      arr[i + 1] += velocities[i + 1] * deltaSeconds;
      arr[i + 2] += velocities[i + 2] * deltaSeconds;
      arr[i] += Math.sin(elapsedTime * 2.1 + i) * deltaSeconds * 0.03;
      arr[i + 2] += Math.cos(elapsedTime * 1.8 + i) * deltaSeconds * 0.025;
      if (arr[i + 1] > 20 || arr[i] > 58) {
        arr[i] = 26 + Math.random() * 12;
        arr[i + 1] = 5.5 + Math.random() * 5;
        arr[i + 2] = -7 + Math.random() * 14;
      }
    }
    attr.needsUpdate = true;
    scene1Runtime.dustPoints.material.opacity = 0.22 + Math.sin(elapsedTime * 1.9) * 0.08;
  }

  if (scene1Runtime.weatherDustPoints?.geometry?.attributes?.position && scene1Runtime.weatherDustVelocities) {
    const attr = scene1Runtime.weatherDustPoints.geometry.attributes.position;
    const arr = attr.array;
    const velocities = scene1Runtime.weatherDustVelocities;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += velocities[i] * deltaSeconds;
      arr[i + 1] += velocities[i + 1] * deltaSeconds;
      arr[i + 2] += velocities[i + 2] * deltaSeconds;
      arr[i + 1] += Math.sin(elapsedTime * 0.8 + i) * deltaSeconds * 0.015;
      arr[i + 2] += Math.cos(elapsedTime * 0.6 + i) * deltaSeconds * 0.02;
      if (arr[i] > 135) arr[i] = -135;
      if (arr[i] < -135) arr[i] = 135;
      if (arr[i + 2] > 70) arr[i + 2] = -95;
      if (arr[i + 2] < -95) arr[i + 2] = 70;
      if (arr[i + 1] < 4) arr[i + 1] = 4 + Math.random() * 5;
      if (arr[i + 1] > 25) arr[i + 1] = 20 + Math.random() * 3;
    }
    attr.needsUpdate = true;
    scene1Runtime.weatherDustPoints.material.opacity = 0.24 + Math.sin(elapsedTime * 0.9) * 0.06;
  }

  if (scene1Runtime.trenchScar) {
    scene1Runtime.trenchScar.material.color.offsetHSL(0, 0, Math.sin(elapsedTime * 0.5) * 0.00015);
  }

  if (scene1Runtime.stagnantWater) {
    const base = 0.56 + Math.sin(elapsedTime * 1.3) * 0.04;
    if (scene1Runtime.stagnantWater.isGroup) {
      scene1Runtime.stagnantWater.children.forEach((patch, idx) => {
        if (patch.material) {
          patch.material.opacity = base + Math.sin(elapsedTime * 0.9 + idx * 0.7) * 0.03;
        }
      });
    } else if (scene1Runtime.stagnantWater.material) {
      scene1Runtime.stagnantWater.material.opacity = base;
    }
  }

  if (Array.isArray(scene1Runtime.snailClusters)) {
    scene1Runtime.snailClusters.forEach((cluster, idx) => {
      cluster.position.y = -2.1 + Math.sin(elapsedTime * 1.5 + idx) * 0.04;
      cluster.rotation.y += deltaSeconds * 0.12;
    });
  }
}

function transitionToScene(progress, fromRoot, toRoot) {
  const eased = easeInOutCubic(progress);
  if (fromRoot) {
    fromRoot.position.y = lerp(0, -30, eased);
  }
  if (toRoot) {
    toRoot.position.y = lerp(-30, 0, eased);
  }
}

function createBirdWing(color) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.05, 0.9),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.03,
      flatShading: true
    })
  );
}

function createFlyingBird(config = {}) {
  const bird = new THREE.Group();
  const bodyColor = config.bodyColor || 0xf3efe5;
  const accentColor = config.accentColor || 0x3a352f;

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 0.72, 7),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.82,
      metalness: 0.02,
      flatShading: true
    })
  );
  body.rotation.z = Math.PI / 2;
  bird.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 10),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.8,
      metalness: 0.02,
      flatShading: true
    })
  );
  head.position.set(0.42, 0.04, 0);
  bird.add(head);

  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.18, 4),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.75,
      metalness: 0.01,
      flatShading: true
    })
  );
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.57, 0.04, 0);
  bird.add(beak);

  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.24, 4),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.78,
      metalness: 0.01,
      flatShading: true
    })
  );
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.42, 0, 0);
  bird.add(tail);

  const leftWingPivot = new THREE.Group();
  leftWingPivot.position.set(0.03, 0.02, 0.24);
  const leftWing = createBirdWing(accentColor);
  leftWing.position.set(0.14, 0, 0.02);
  leftWing.rotation.y = -0.12;
  leftWingPivot.add(leftWing);
  bird.add(leftWingPivot);

  const rightWingPivot = new THREE.Group();
  rightWingPivot.position.set(0.03, 0.02, -0.24);
  const rightWing = createBirdWing(accentColor);
  rightWing.position.set(0.14, 0, -0.02);
  rightWing.rotation.y = 0.12;
  rightWingPivot.add(rightWing);
  bird.add(rightWingPivot);

  bird.userData = {
    kind: 'flying-bird',
    leftWingPivot,
    rightWingPivot,
    flapPhase: config.flapPhase || 0,
    flapSpeed: config.flapSpeed || 2.4,
    glideSpeed: config.glideSpeed || 0.34,
    orbitRadiusX: config.orbitRadiusX || 36,
    orbitRadiusZ: config.orbitRadiusZ || 22,
    orbitOffset: config.orbitOffset || 0,
    altitude: config.altitude || 10,
    bank: config.bank || 0.28,
    sway: config.sway || 0.7
  };

  return bird;
}

function createWaterBird(config = {}) {
  const bird = new THREE.Group();
  const bodyColor = config.bodyColor || 0xf0ece0;
  const accentColor = config.accentColor || 0x352d27;

  const wake = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.78, 24),
    new THREE.MeshBasicMaterial({
      color: 0x9dd7ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  wake.rotation.x = -Math.PI / 2;
  wake.position.y = -0.06;
  bird.add(wake);

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 10),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.86,
      metalness: 0.02,
      flatShading: true
    })
  );
  body.scale.set(1.4, 0.9, 1);
  body.position.y = 0.18;
  bird.add(body);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.06, 0.32, 5),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.84,
      metalness: 0.02,
      flatShading: true
    })
  );
  neck.rotation.z = -0.35;
  neck.position.set(0.18, 0.38, 0);
  bird.add(neck);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 10, 10),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.8,
      metalness: 0.02,
      flatShading: true
    })
  );
  head.position.set(0.33, 0.54, 0);
  bird.add(head);

  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.15, 4),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.75,
      metalness: 0.01,
      flatShading: true
    })
  );
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.45, 0.54, 0);
  bird.add(beak);

  const legMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.82,
    metalness: 0.01,
    flatShading: true
  });
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.34, 4), legMaterial);
  leftLeg.position.set(0.03, -0.05, 0.06);
  leftLeg.rotation.z = 0.08;
  bird.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.34, 4), legMaterial);
  rightLeg.position.set(-0.01, -0.05, -0.05);
  rightLeg.rotation.z = -0.03;
  bird.add(rightLeg);

  const leftWing = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.03, 0.42),
    legMaterial.clone()
  );
  leftWing.position.set(0.02, 0.18, 0.22);
  leftWing.rotation.x = -0.18;
  leftWing.rotation.y = -0.12;
  bird.add(leftWing);

  const rightWing = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.03, 0.42),
    legMaterial.clone()
  );
  rightWing.position.set(0.02, 0.18, -0.22);
  rightWing.rotation.x = 0.16;
  rightWing.rotation.y = 0.12;
  bird.add(rightWing);

  bird.userData = {
    kind: 'water-bird',
    wake,
    driftSpeed: config.driftSpeed || 0.11,
    driftPhase: config.driftPhase || 0,
    bobPhase: config.bobPhase || 0,
    bobStrength: config.bobStrength || 0.14,
    row: config.row || 0
  };

  return bird;
}

function createShoebillStork(config = {}) {
  const stork = new THREE.Group();
  const bodyColor = config.bodyColor || 0x9ca2a7;
  const beakColor = config.beakColor || 0xc7b27a;

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 10),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.88,
      metalness: 0.02,
      flatShading: true
    })
  );
  body.scale.set(1.1, 1.25, 0.9);
  body.position.y = 0.95;
  stork.add(body);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 0.56, 5),
    new THREE.MeshStandardMaterial({
      color: 0xaab0b5,
      roughness: 0.86,
      metalness: 0.01,
      flatShading: true
    })
  );
  neck.position.set(0.16, 1.3, 0);
  neck.rotation.z = -0.18;
  stork.add(neck);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xa7adb1,
      roughness: 0.85,
      metalness: 0.01,
      flatShading: true
    })
  );
  head.position.set(0.28, 1.58, 0);
  stork.add(head);

  const beak = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.12, 0.1),
    new THREE.MeshStandardMaterial({
      color: beakColor,
      roughness: 0.9,
      metalness: 0.01,
      flatShading: true
    })
  );
  beak.position.set(0.48, 1.54, 0);
  stork.add(beak);

  const legMaterial = new THREE.MeshStandardMaterial({
    color: 0x44413f,
    roughness: 0.92,
    metalness: 0.01,
    flatShading: true
  });
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.95, 4), legMaterial);
  leftLeg.position.set(-0.07, 0.46, 0.06);
  stork.add(leftLeg);
  const rightLeg = leftLeg.clone();
  rightLeg.position.z = -0.06;
  stork.add(rightLeg);

  stork.userData = {
    kind: 'shoebill',
    bobPhase: config.bobPhase || 0,
    stepPhase: config.stepPhase || 0,
    stepSpeed: config.stepSpeed || 0.18
  };

  return stork;
}

function createTallGrassPatch(config = {}) {
  const patch = new THREE.Group();
  const bladeCount = config.bladeCount || 14;
  const baseColor = config.baseColor || 0x6f9e41;
  const tipColor = config.tipColor || 0x91bd58;

  for (let i = 0; i < bladeCount; i += 1) {
    const height = 2.2 + Math.random() * 2.8;
    const blade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.14, height, 5),
      new THREE.MeshStandardMaterial({
        color: i % 3 === 0 ? tipColor : baseColor,
        roughness: 0.95,
        metalness: 0.01,
        flatShading: true
      })
    );
    blade.position.set(
      (Math.random() - 0.5) * 1.7,
      height * 0.5 - 0.1,
      (Math.random() - 0.5) * 1.7
    );
    blade.rotation.z = (Math.random() - 0.5) * 0.35;
    blade.rotation.x = (Math.random() - 0.5) * 0.12;
    patch.add(blade);
  }

  const seedHead = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.55, 5),
    new THREE.MeshStandardMaterial({
      color: 0xc6a95b,
      roughness: 0.94,
      metalness: 0.01,
      flatShading: true
    })
  );
  seedHead.position.y = 2.3;
  patch.add(seedHead);

  patch.userData = {
    kind: 'tall-grass',
    swayPhase: config.swayPhase || 0,
    swaySpeed: config.swaySpeed || 0.7,
    swayAmount: config.swayAmount || 0.16,
    lean: config.lean || 0
  };

  return patch;
}

function createPapyrus(config = {}) {
  const papyrus = new THREE.Group();
  const stalkHeight = config.height || (3 + Math.random() * 2.2);
  const stalkColor = config.stalkColor || 0x4f7d31;
  const crownColor = config.crownColor || 0x7eaf4c;

  const stalk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.065, stalkHeight, 6),
    new THREE.MeshStandardMaterial({
      color: stalkColor,
      roughness: 0.92,
      metalness: 0.01,
      flatShading: true
    })
  );
  stalk.position.y = stalkHeight * 0.5;
  papyrus.add(stalk);

  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 6),
    new THREE.MeshStandardMaterial({
      color: crownColor,
      roughness: 0.95,
      metalness: 0.01,
      wireframe: true
    })
  );
  crown.scale.set(1.7, 0.24, 1.7);
  crown.position.y = stalkHeight + 0.08;
  papyrus.add(crown);

  papyrus.userData = {
    kind: 'papyrus',
    swayPhase: config.swayPhase || 0,
    swaySpeed: config.swaySpeed || 0.65,
    swayAmount: config.swayAmount || 0.1,
    stalk,
    crown
  };

  return papyrus;
}

function createFloatingMat(config = {}) {
  const radius = config.radius || (2.2 + Math.random() * 2.6);
  const matGeometry = new THREE.PlaneGeometry(radius * 2.3, radius * 2.2, 18, 18);
  const positions = matGeometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const ridge = Math.sin(x * 1.8) * 0.17 + Math.cos(y * 1.9) * 0.12;
    const puff = Math.sin((x + y) * 2.1) * 0.09;
    const noise = Math.cos((x * 0.9 - y * 1.2) * 1.8) * 0.08;
    positions.setZ(i, ridge + puff + noise);
  }
  matGeometry.computeVertexNormals();

  const mat = new THREE.Mesh(
    matGeometry,
    new THREE.MeshStandardMaterial({
      color: config.color || 0x6f9f47,
      roughness: 0.9,
      metalness: 0.01,
      flatShading: true,
      side: THREE.DoubleSide
    })
  );
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = -0.08;
  mat.userData = {
    kind: 'floating-mat',
    driftPhase: config.driftPhase || 0,
    driftSpeed: config.driftSpeed || 0.2,
    bobAmount: config.bobAmount || 0.08
  };

  return mat;
}

function createHippo(config = {}) {
  const hippo = new THREE.Group();
  const bodyColor = config.bodyColor || 0x726c6a;

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 12, 10),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.92,
      metalness: 0.01,
      flatShading: true
    })
  );
  body.scale.set(1.65, 0.56, 1.1);
  body.position.y = 0.22;
  hippo.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 10, 8),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.9,
      metalness: 0.01,
      flatShading: true
    })
  );
  head.scale.set(1.15, 0.78, 1.2);
  head.position.set(1.4, 0.18, 0);
  hippo.add(head);

  const nostrilMaterial = new THREE.MeshStandardMaterial({ color: 0x2e2b2a, roughness: 0.9, metalness: 0.01 });
  const nostrilA = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), nostrilMaterial);
  nostrilA.position.set(1.9, 0.26, 0.16);
  hippo.add(nostrilA);
  const nostrilB = nostrilA.clone();
  nostrilB.position.z = -0.16;
  hippo.add(nostrilB);

  hippo.userData = {
    kind: 'hippo',
    driftPhase: config.driftPhase || 0,
    driftSpeed: config.driftSpeed || 0.09,
    bobStrength: config.bobStrength || 0.05
  };

  return hippo;
}

function createAmbatchCanoe(config = {}) {
  const canoe = new THREE.Group();

  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.56, 5.2, 12),
    new THREE.MeshStandardMaterial({
      color: config.hullColor || 0x7a5434,
      roughness: 0.93,
      metalness: 0.01,
      flatShading: true,
      side: THREE.DoubleSide
    })
  );
  hull.rotation.z = Math.PI / 2;
  hull.scale.y = 0.46;
  hull.position.y = 0.33;
  canoe.add(hull);

  const railLeft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 5.1, 8),
    new THREE.MeshStandardMaterial({ color: 0x6a462f, roughness: 0.95, metalness: 0.01, flatShading: true })
  );
  railLeft.rotation.z = Math.PI / 2;
  railLeft.position.set(0, 0.64, 0.28);
  canoe.add(railLeft);

  const railRight = railLeft.clone();
  railRight.position.z = -0.28;
  canoe.add(railRight);

  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.08, 0.45),
    new THREE.MeshStandardMaterial({
      color: 0x5f422b,
      roughness: 0.9,
      metalness: 0.01,
      flatShading: true
    })
  );
  seat.position.set(0, 0.48, 0);
  canoe.add(seat);

  const paddle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5),
    new THREE.MeshStandardMaterial({
      color: 0x6e4e2f,
      roughness: 0.93,
      metalness: 0.01,
      flatShading: true
    })
  );
  paddle.position.set(1.1, 0.9, 0);
  paddle.rotation.z = -0.75;
  canoe.add(paddle);

  canoe.userData = {
    kind: 'ambatch-canoe',
    paddle,
    bobPhase: config.bobPhase || 0,
    rowSpeed: config.rowSpeed || 0.62
  };

  return canoe;
}

function createWadingRipple() {
  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(0.24, 0.62, 24),
    new THREE.MeshBasicMaterial({
      color: 0xaedfff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  ripple.rotation.x = -Math.PI / 2;
  ripple.visible = false;
  return ripple;
}

function createCow(config = {}) {
  const cow = new THREE.Group();
  const groupIdentity = config.group || 'Dinka';
  const isDinka = groupIdentity === 'Dinka';
  const bodyColor = config.bodyColor || (isDinka ? 0xefefea : 0x6a4a35);
  const accentColor = config.accentColor || 0x2d241f;
  const spotColor = config.spotColor || (isDinka ? 0x8f8478 : 0xead9be);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.95, 1.02, 0.95),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.88,
      metalness: 0.02,
      flatShading: true
    })
  );
  body.position.y = 1.05;
  cow.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.74, 0.64),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.88,
      metalness: 0.02,
      flatShading: true
    })
  );
  head.position.set(1.28, 0.92, 0);
  cow.add(head);

  const muzzle = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.26, 0.28),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.9,
      metalness: 0.01,
      flatShading: true
    })
  );
  muzzle.position.set(1.68, 0.82, 0);
  cow.add(muzzle);

  const hornMaterial = new THREE.MeshStandardMaterial({
    color: 0xcbb88e,
    roughness: 0.84,
    metalness: 0.01,
    flatShading: true
  });
  const hornRadius = isDinka ? 0.55 : 0.42;
  const hornArc = isDinka ? Math.PI * 1.05 : Math.PI * 0.8;
  const leftHorn = new THREE.Mesh(new THREE.TorusGeometry(hornRadius, 0.05, 8, 18, hornArc), hornMaterial);
  leftHorn.position.set(1.28, 1.46, 0.28);
  leftHorn.rotation.set(0.2, Math.PI / 2, -0.15);
  cow.add(leftHorn);

  const rightHorn = new THREE.Mesh(new THREE.TorusGeometry(hornRadius * (isDinka ? 1 : 0.78), 0.05, 8, 16, hornArc), hornMaterial);
  rightHorn.position.set(1.28, 1.46, -0.28);
  rightHorn.rotation.set(-0.16, Math.PI / 2, 0.2);
  cow.add(rightHorn);

  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 8),
    new THREE.MeshStandardMaterial({ color: spotColor, roughness: 0.8, metalness: 0.01 })
  );
  eye.position.set(1.48, 1.0, 0.16);
  cow.add(eye);

  const legs = [
    [-0.7, 0.45, 0.34],
    [-0.7, 0.45, -0.34],
    [0.55, 0.45, 0.34],
    [0.55, 0.45, -0.34]
  ];
  legs.forEach(([x, y, z], index) => {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.95, 5),
      new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? bodyColor : 0xcfc2ad,
        roughness: 0.92,
        metalness: 0.01,
        flatShading: true
      })
    );
    leg.position.set(x, y, z);
    cow.add(leg);
  });

  const tail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.05, 0.62, 4),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.9,
      metalness: 0.01,
      flatShading: true
    })
  );
  tail.position.set(-1.16, 1.08, 0);
  tail.rotation.z = 0.4;
  cow.add(tail);

  const spotA = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshStandardMaterial({ color: spotColor, roughness: 0.9, metalness: 0.01, flatShading: true })
  );
  spotA.scale.set(1.6, 0.8, 1.1);
  spotA.position.set(-0.28, 1.18, 0.18);
  cow.add(spotA);

  const spotB = spotA.clone();
  spotB.position.set(0.16, 0.95, -0.22);
  if (!isDinka || Math.random() > 0.4) {
    cow.add(spotA);
    cow.add(spotB);
  }

  cow.userData = {
    kind: 'cow',
    group: groupIdentity,
    grazePhase: config.grazePhase || 0,
    grazeSpeed: config.grazeSpeed || 0.28,
    driftSpeed: config.driftSpeed || 0.08,
    lane: config.lane || 0,
    direction: config.direction || 1
  };

  return cow;
}

function createFishingPerson(config = {}) {
  const fisher = createNiloticHuman({
    role: 'fisher',
    group: config.group || 'Nuer',
    bodyColor: config.bodyColor,
    accentColor: config.accentColor,
    actionPhase: config.bobPhase || 0,
    actionSpeed: config.bobSpeed || 0.45,
    stepSpeed: 0.2,
    direction: 1
  });
  const fisherData = fisher.userData;

  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 3.2, 4),
    new THREE.MeshStandardMaterial({
      color: 0x3d2d21,
      roughness: 0.94,
      metalness: 0.01,
      flatShading: true
    })
  );
  rod.position.set(1.55, 1.56, 0.1);
  rod.rotation.z = -1.05;
  rod.rotation.y = -0.18;
  fisher.add(rod);

  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 1.5, 3),
    new THREE.MeshStandardMaterial({
      color: 0xd7e7ef,
      roughness: 0.96,
      metalness: 0,
      flatShading: true
    })
  );
  line.position.set(2.9, 0.6, 0.1);
  line.rotation.z = -0.68;
  fisher.add(line);

  const float = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 6, 6),
    new THREE.MeshStandardMaterial({
      color: 0xffd26e,
      roughness: 0.8,
      metalness: 0.01,
      flatShading: true
    })
  );
  float.position.set(3.5, 0.08, 0.1);
  fisher.add(float);

  fisherData.kind = 'fisher';
  fisherData.bobPhase = config.bobPhase || 0;
  fisherData.bobSpeed = config.bobSpeed || 0.45;
  fisherData.rodPhase = config.rodPhase || 0;
  fisherData.driftSpeed = config.driftSpeed || 0.05;
  fisherData.shoreOffset = config.shoreOffset || 0;
  fisherData.rod = rod;

  return fisher;
}

function createNiloticHuman(config = {}) {
  const worker = new THREE.Group();
  const role = config.role || (config.workType === 'farm' ? 'farmer' : 'carrier');
  const groupIdentity = config.group || 'Dinka';
  const isFisher = role === 'fisher' || config.workType === 'paddle';
  const isDinka = groupIdentity === 'Dinka';
  const bodyColor = config.bodyColor || 0x2a1b0a;
  const wrapColor = isDinka ? 0x99ccff : 0xcc6633;
  const accentColor = config.accentColor || 0x2f241d;

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.15, 1.8, 8),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.86,
      metalness: 0.01,
      flatShading: true
    })
  );
  torso.position.y = 0.9;
  worker.add(torso);

  const wrap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.2, 0.9, 8),
    new THREE.MeshStandardMaterial({
      color: wrapColor,
      roughness: 0.88,
      metalness: 0.01,
      flatShading: true
    })
  );
  wrap.position.y = 1.0;
  worker.add(wrap);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 12),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.84,
      metalness: 0.01,
      flatShading: true
    })
  );
  head.position.set(0.02, 1.94, 0);
  worker.add(head);

  const hips = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.2, 0.28),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.9,
      metalness: 0.01,
      flatShading: true
    })
  );
  hips.position.y = 0.42;
  worker.add(hips);

  const limbMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.9,
    metalness: 0.01,
    flatShading: true
  });
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.92, 4), limbMaterial);
  leftLeg.position.set(-0.11, -0.02, 0.08);
  worker.add(leftLeg);
  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.92, 4), limbMaterial);
  rightLeg.position.set(0.11, -0.02, -0.08);
  worker.add(rightLeg);

  const armMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.88,
    metalness: 0.01,
    flatShading: true
  });
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.72, 4), armMaterial);
  leftArm.position.set(-0.32, 1.1, 0.04);
  leftArm.rotation.z = 0.8;
  worker.add(leftArm);
  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.72, 4), armMaterial);
  rightArm.position.set(0.31, 1.06, -0.04);
  rightArm.rotation.z = -0.72;
  worker.add(rightArm);

  let hat = null;
  if (isFisher) {
    hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.23, 8),
      new THREE.MeshStandardMaterial({
        color: 0xbc9b6a,
        roughness: 0.95,
        metalness: 0.01,
        flatShading: true
      })
    );
    hat.position.y = 2.15;
    worker.add(hat);
  }

  let tool = null;
  if (role === 'farmer') {
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 2.5, 5),
      new THREE.MeshStandardMaterial({
        color: 0x4a3728,
        roughness: 0.94,
        metalness: 0.01,
        flatShading: true
      })
    );
    handle.rotation.z = Math.PI / 4;
    handle.position.set(0.7, 1.05, 0.04);
    worker.add(handle);

    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.08, 0.1),
      new THREE.MeshStandardMaterial({
        color: 0xb8b0a0,
        roughness: 0.82,
        metalness: 0.04,
        flatShading: true
      })
    );
    blade.position.set(1.46, 0.26, 0.08);
    blade.rotation.z = -0.3;
    worker.add(blade);
    tool = { handle, blade };
  } else if (role === 'carrier') {
    const basket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.24, 6),
      new THREE.MeshStandardMaterial({
        color: 0xb58a54,
        roughness: 0.95,
        metalness: 0.01,
        flatShading: true
      })
    );
    basket.position.set(0.55, 0.62, 0.08);
    worker.add(basket);
    tool = { basket };
  }

  worker.userData = {
    kind: 'worker',
    group: groupIdentity,
    role,
    workType: role === 'farmer' ? 'farm' : (isFisher ? 'paddle' : 'carry'),
    actionPhase: config.actionPhase || 0,
    actionSpeed: config.actionSpeed || 0.85,
    stepSpeed: config.stepSpeed || 0.35,
    direction: config.direction || 1,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    head,
    hips,
    hat,
    tool,
    torso,
    canoe: null,
    wadingRipple: null,
    guarding: false
  };

  return worker;
}

function createVillageWorker(config = {}) {
  return createNiloticHuman(config);
}

function createTinyHome(config = {}) {
  const home = new THREE.Group();
  const wallColor = config.wallColor || 0xc8b18f;
  const roofColor = config.roofColor || 0x7b4a34;
  const trimColor = config.trimColor || 0x5a4637;

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 1.0, 1.45),
    new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: 0.9,
      metalness: 0.01,
      flatShading: true
    })
  );
  base.position.y = 0.55;
  home.add(base);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.25, 1.0, 4),
    new THREE.MeshStandardMaterial({
      color: roofColor,
      roughness: 0.94,
      metalness: 0.01,
      flatShading: true
    })
  );
  roof.position.y = 1.55;
  roof.rotation.y = Math.PI / 4;
  home.add(roof);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.52, 0.06),
    new THREE.MeshStandardMaterial({
      color: trimColor,
      roughness: 0.92,
      metalness: 0.01,
      flatShading: true
    })
  );
  door.position.set(0.3, 0.32, 0.74);
  home.add(door);

  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0xbfe4f7,
    roughness: 0.62,
    metalness: 0.04,
    flatShading: true
  });
  const frontWindow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.05), windowMaterial);
  frontWindow.position.set(-0.42, 0.72, 0.74);
  home.add(frontWindow);

  const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.05), windowMaterial);
  sideWindow.position.set(-0.76, 0.66, 0.1);
  sideWindow.rotation.y = Math.PI / 2;
  home.add(sideWindow);

  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.34, 0.14),
    new THREE.MeshStandardMaterial({
      color: trimColor,
      roughness: 0.9,
      metalness: 0.01,
      flatShading: true
    })
  );
  chimney.position.set(0.5, 1.88, -0.18);
  home.add(chimney);

  home.userData = {
    kind: 'tiny-home'
  };

  return home;
}

function createCircularHut(config = {}) {
  const hut = new THREE.Group();
  const wallColor = config.wallColor || 0xa49168;
  const roofColor = config.roofColor || 0x9a7241;
  const accentColor = config.accentColor || 0x5a432d;

  const wallRadius = config.wallRadius || 2.7;
  const wallHeight = config.wallHeight || 2.7;
  const roofHeight = config.roofHeight || 2.9;

  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(wallRadius, wallRadius, wallHeight, 18),
    new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: 0.96,
      metalness: 0.01,
      flatShading: true
    })
  );
  wall.position.y = wallHeight * 0.5;
  wall.castShadow = true;
  hut.add(wall);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(wallRadius + 1.0, roofHeight, 18),
    new THREE.MeshStandardMaterial({
      color: roofColor,
      roughness: 1,
      metalness: 0.01,
      flatShading: true
    })
  );
  roof.position.y = wallHeight + roofHeight * 0.44;
  roof.castShadow = true;
  hut.add(roof);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 1.1, 0.12),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.92,
      metalness: 0.01,
      flatShading: true
    })
  );
  door.position.set(wallRadius - 0.24, 0.55, 0);
  door.rotation.y = Math.PI / 2;
  hut.add(door);

  const fenceCount = config.fenceCount || 10;
  const fenceRadius = wallRadius + 0.8;
  for (let i = 0; i < fenceCount; i += 1) {
    const angle = (i / fenceCount) * Math.PI * 2;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 0.95, 4),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x7a5a38 : 0x5e452c,
        roughness: 0.94,
        metalness: 0.01,
        flatShading: true
      })
    );
    post.position.set(Math.cos(angle) * fenceRadius, 0.48, Math.sin(angle) * fenceRadius);
    post.rotation.z = Math.sin(angle) * 0.15;
    hut.add(post);
  }

  hut.userData = {
    kind: 'circular-hut'
  };

  return hut;
}

function createVillageTree(config = {}) {
  const tree = new THREE.Group();
  const isGhostTree = !!config.ghostTree;
  const trunkColor = config.trunkColor || (isGhostTree ? 0x645a4d : 0x7a4d2c);
  const foliageColor = config.foliageColor || (isGhostTree ? 0x7f7a6e : 0x4f7d31);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.82, 7.5, 6),
    new THREE.MeshStandardMaterial({
      color: trunkColor,
      roughness: 0.94,
      metalness: 0.01,
      flatShading: true
    })
  );
  trunk.position.y = 3.75;
  tree.add(trunk);

  if (isGhostTree) {
    const branchMat = new THREE.MeshStandardMaterial({
      color: 0x756b5d,
      roughness: 0.98,
      metalness: 0.01,
      flatShading: true
    });
    for (let i = 0; i < 6; i += 1) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.04, 2.8, 4), branchMat);
      branch.position.set((i % 2 === 0 ? -1 : 1) * 0.22, 6.0 + i * 0.25, -0.15 + (i % 3) * 0.12);
      branch.rotation.z = (i % 2 === 0 ? -0.8 : 0.8) + (i % 3) * 0.12;
      branch.rotation.y = i * 0.55;
      tree.add(branch);
    }
  }

  const canopyLayers = [
    { radius: 4.4, y: 9.1 },
    { radius: 3.4, y: 10.9 },
    { radius: 2.4, y: 12.1 }
  ];
  canopyLayers.forEach((layer, index) => {
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(layer.radius, 12, 12),
      new THREE.MeshStandardMaterial({
        color: isGhostTree ? 0x78756d : (index === 1 ? 0x5f9440 : foliageColor),
        roughness: 0.96,
        metalness: 0.01,
        flatShading: true,
        transparent: isGhostTree,
        opacity: isGhostTree ? 0.42 : 1
      })
    );
    canopy.position.y = layer.y;
    canopy.scale.set(isGhostTree ? 0.92 : 1.15, isGhostTree ? 0.68 : 0.85, isGhostTree ? 0.95 : 1.05);
    tree.add(canopy);
  });

  tree.userData = {
    kind: 'village-tree'
  };

  return tree;
}

function createCropPatch(config = {}) {
  const patch = new THREE.Group();
  const cropColor = config.cropColor || 0x7ead45;
  const soilColor = config.soilColor || 0x6c5636;
  const cropCount = config.cropCount || 10;

  const soil = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 14),
    new THREE.MeshStandardMaterial({
      color: soilColor,
      roughness: 1,
      metalness: 0.01,
      flatShading: true
    })
  );
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.02;
  patch.add(soil);

  for (let i = 0; i < cropCount; i += 1) {
    const crop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.08, 0.78 + Math.random() * 0.48, 5),
      new THREE.MeshStandardMaterial({
        color: i % 3 === 0 ? 0x92be57 : cropColor,
        roughness: 0.95,
        metalness: 0.01,
        flatShading: true
      })
    );
    const angle = (i / cropCount) * Math.PI * 2 + Math.random() * 0.25;
    const radius = 0.45 + Math.random() * 0.75;
    crop.position.set(Math.cos(angle) * radius, 0.4, Math.sin(angle) * radius);
    crop.rotation.z = (Math.random() - 0.5) * 0.35;
    patch.add(crop);
  }

  patch.userData = {
    kind: 'crop-patch'
  };

  return patch;
}

function buildScene0System(sceneData) {
  const root = new THREE.Group();
  const scene0Config = sceneData.scene0 || {};
  const waterConfig = scene0Config.water || {};
  const vegetationConfig = scene0Config.vegetation || {};
  const lifeConfig = scene0Config.life || {};
  const communityConfig = scene0Config.community || {};
  const pulseConfig = scene0Config.pulse || {};

  const terrainGeometry = new THREE.PlaneGeometry(210, 210, 96, 96);
  const vertices = terrainGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i += 1) {
    const x = vertices.getX(i);
    const y = vertices.getY(i);
    const macro = Math.sin(x * 0.035) * 1.5 + Math.cos(y * 0.026) * 1.2;
    const channel = Math.sin((x + y * 0.7) * 0.06) * 0.9;
    const basin = Math.cos((x - y) * 0.04) * 0.7;
    vertices.setZ(i, macro + channel + basin - 2.2);
  }
  terrainGeometry.computeVertexNormals();

  const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0x556d3e,
    roughness: 0.93,
    metalness: 0.04
  });
  const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrain.rotation.x = -Math.PI / 2;
  terrain.receiveShadow = true;
  terrain.position.y = -0.8;
  root.add(terrain);

  const waterUniforms = {
    uTime: { value: 0 },
    uEvap: { value: 0 },
    uPulse: { value: 0 },
    uFlow: { value: waterConfig.flowSpeed || 0.35 }
  };

  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      uniform float uEvap;
      uniform float uPulse;
      varying vec2 vUv;
      varying float vWave;

      void main() {
        vUv = uv;
        vec3 transformed = position;
        float c1 = sin((uv.x * 11.0 + uTime * 0.75) + uv.y * 4.0) * 0.25;
        float c2 = cos((uv.y * 13.0 + uTime * 0.58) - uv.x * 3.0) * 0.22;
        float flow = sin((uv.x * 22.0 - uv.y * 9.0) + uTime * 1.25) * 0.07;
        vWave = c1 + c2 + flow;
        transformed.z += vWave;
        transformed.z -= uEvap * 0.35;
        transformed.z += uPulse * 0.2;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uEvap;
      uniform float uPulse;
      uniform float uFlow;
      varying vec2 vUv;
      varying float vWave;

      void main() {
        float stream = sin((vUv.x * 36.0 - vUv.y * 18.0) + uTime * (2.2 * uFlow));
        float eddy = cos((vUv.y * 30.0 + vUv.x * 12.0) + uTime * 1.35);
        float flowMask = smoothstep(0.1, 0.95, vUv.x);
        vec3 deepColor = vec3(0.09, 0.30, 0.41);
        vec3 brightColor = vec3(0.26, 0.60, 0.72);
        vec3 color = mix(deepColor, brightColor, flowMask + stream * 0.08 + eddy * 0.06 + uPulse * 0.09);
        float alpha = 0.88 - (uEvap * 0.28) + abs(vWave) * 0.08;
        gl_FragColor = vec4(color, clamp(alpha, 0.42, 0.94));
      }
    `
  });

  const water = new THREE.Mesh(new THREE.PlaneGeometry(148, 124, 120, 100), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.set(-8, -0.28, -2);
  root.add(water);

  const islands = new THREE.Group();
  const islandCount = 30;
  const islandOffsets = [];
  const islandAnchors = [];

  const isInsideOpenCorridor = (x, z) => {
    const mainChannel = Math.abs(x + 8) < 14 && z > -60 && z < 56;
    const secondaryNorth = Math.abs(x - 18) < 9 && z > -10 && z < 58;
    const secondarySouth = Math.abs(x + 26) < 10 && z > -56 && z < 10;
    return mainChannel || secondaryNorth || secondarySouth;
  };

  const isTooCloseToAnchor = (x, z) => {
    for (let i = 0; i < islandAnchors.length; i += 1) {
      const anchor = islandAnchors[i];
      if (Math.hypot(anchor.x - x, anchor.z - z) < 7.5) {
        return true;
      }
    }
    return false;
  };

  for (let i = 0; i < islandCount; i += 1) {
    let x = -62 + Math.random() * 118;
    let z = -54 + Math.random() * 108;

    // Place mats in wetland belts along channel edges, preserving open navigation lanes.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const beltType = i % 4;
      if (beltType === 0) {
        x = -54 + Math.random() * 16;
        z = -58 + Math.random() * 116;
      } else if (beltType === 1) {
        x = 26 + Math.random() * 24;
        z = -58 + Math.random() * 116;
      } else if (beltType === 2) {
        x = -44 + Math.random() * 84;
        z = -54 + Math.sin((i + attempt) * 0.6) * 10 + (Math.random() - 0.5) * 8;
      } else {
        x = -42 + Math.random() * 82;
        z = 48 + Math.sin((i + attempt) * 0.7) * 9 + (Math.random() - 0.5) * 8;
      }

      if (!isInsideOpenCorridor(x, z) && !isTooCloseToAnchor(x, z)) {
        break;
      }
    }

    const island = createFloatingMat({
      radius: 2.8 + Math.random() * 4.2,
      driftPhase: i * 0.43,
      driftSpeed: 0.16 + (i % 4) * 0.03,
      bobAmount: 0.05 + (i % 3) * 0.015,
      color: i % 2 === 0 ? 0x729d4a : 0x6b9346
    });
    island.position.set(x, -0.12 - Math.random() * 0.08, z);
    islands.add(island);
    islandAnchors.push({ x, z });
    islandOffsets.push(Math.random() * Math.PI * 2);
  }
  root.add(islands);

  const reeds = new THREE.Group();
  const reedCount = vegetationConfig.reedCount || 1500;
  const reedOffsets = [];
  const reedInstances = [];
  const reedDummy = new THREE.Object3D();
  const reedGeometry = new THREE.CylinderGeometry(0.04, 0.07, 2.2, 6);
  const reedMaterial = new THREE.MeshStandardMaterial({ color: 0x7aa943, roughness: 0.95, metalness: 0.02 });
  const reedInstancedMesh = new THREE.InstancedMesh(reedGeometry, reedMaterial, reedCount);
  reedInstancedMesh.castShadow = false;
  reedInstancedMesh.receiveShadow = true;
  for (let i = 0; i < reedCount; i += 1) {
    const height = 1.7 + Math.random() * 1.2;
    const side = i % 2 === 0 ? -1 : 1;
    const lane = i % 9;
    const x = side * (12 + Math.random() * 47) + lane * 0.5;
    const z = -69 + Math.random() * 138;
    reedDummy.position.set(
      x,
      -0.2 + height * 0.5,
      z
    );
    reedDummy.scale.set(1, height / 2.2, 1);
    reedDummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    reedDummy.updateMatrix();
    reedInstancedMesh.setMatrixAt(i, reedDummy.matrix);
    reedInstances.push({ x, z, y: -0.2 + height * 0.5, height, yaw: reedDummy.rotation.y });
    reedOffsets.push(Math.random() * Math.PI * 2);
  }
  reedInstancedMesh.instanceMatrix.needsUpdate = true;
  reeds.add(reedInstancedMesh);
  root.add(reeds);

  const shorelineCommunity = new THREE.Group();
  const grassPatches = [];
  const papyrusPatches = [];
  const cows = [];
  const fishers = [];
  const wadingRipples = [];
  const canoes = [];

  // Vegetation: papyrus patches
  const papyrusCount = 35;
  const papyrusSeeds = [
    [-88, -55], [-72, -68], [-50, -70], [-25, -75], [15, -72], [50, -65], [80, -50],
    [-95, -20], [-80, 10], [-60, 35], [-35, 55], [-10, 62], [25, 58], [70, 48], [88, 25],
    [-90, 42], [-70, 55], [-40, 68], [0, 70], [40, 65], [75, 52]
  ];
  for (let i = 0; i < papyrusCount; i += 1) {
    const seed = papyrusSeeds[i % papyrusSeeds.length];
    const papyrus = createPapyrus({
      swayPhase: i * 0.4,
      swaySpeed: 0.52 + (i % 5) * 0.06,
      swayAmount: 0.09 + (i % 3) * 0.02,
      stalkColor: i % 3 === 0 ? 0x4a7a2b : 0x5a8a3b,
      crownColor: i % 2 === 0 ? 0x7ba54f : 0x6d9545
    });
    papyrus.position.set(
      seed[0] + (Math.random() - 0.5) * 7,
      -0.18,
      seed[1] + (Math.random() - 0.5) * 7
    );
    papyrus.rotation.y = Math.random() * Math.PI * 2;
    papyrus.scale.setScalar(0.85 + Math.random() * 0.5);
    shorelineCommunity.add(papyrus);
    papyrusPatches.push(papyrus);
  }

  const cowCount = communityConfig.cowCount || 14;
  for (let i = 0; i < cowCount; i += 1) {
    const isDinkaCow = i < Math.ceil(cowCount * 0.45);
    const inNuerCamp = !isDinkaCow;
    const cow = createCow({
      grazePhase: i * 0.9,
      grazeSpeed: 0.24 + (i % 3) * 0.05,
      driftSpeed: 0.05 + (i % 2) * 0.02,
      lane: i,
      direction: i % 2 === 0 ? 1 : -1,
      group: isDinkaCow ? 'Dinka' : 'Nuer',
      bodyColor: isDinkaCow ? 0xefeee8 : (i % 2 === 0 ? 0x6c4d39 : 0x5f3f2e),
      spotColor: isDinkaCow ? 0x8b8176 : 0xebdcc6
    });
    const bankX = inNuerCamp
      ? -18 + (i % 5) * 6 + (Math.random() - 0.5) * 2
      : 42 + (i % 4) * 7 + (Math.random() - 0.5) * 2;
    const bankZ = inNuerCamp
      ? -26 + Math.floor(i / 2) * 5 + (Math.random() - 0.5) * 2
      : 30 + Math.floor(i / 2) * 5 + (Math.random() - 0.5) * 2;
    cow.position.set(bankX, 0, bankZ);
    cow.rotation.y = inNuerCamp ? 0.3 : -1.35;
    cow.scale.setScalar(1.45 + (i % 3) * 0.08);
    cow.userData.anchorX = bankX;
    cow.userData.anchorZ = bankZ;
    cow.userData.roamX = inNuerCamp ? 20 : 18;
    cow.userData.roamZ = inNuerCamp ? 16 : 14;
    shorelineCommunity.add(cow);
    cows.push(cow);
  }

  const villageLayout = [
    { kind: 'hut', position: [-16, 0, -10], scale: 1.15, rotation: 0.2 },
    { kind: 'hut', position: [-6, 0, 0], scale: 1.05, rotation: -0.35 },
    { kind: 'hut', position: [-18, 0, 7], scale: 1.1, rotation: 0.42 },
    { kind: 'hut', position: [15, 0, 10], scale: 1.12, rotation: -0.22 },
    { kind: 'hut', position: [22, 0, -5], scale: 1.06, rotation: 0.3 },
    { kind: 'tree', position: [-28, 0, -26], scale: 1.45, rotation: 0.1 },
    { kind: 'tree', position: [12, 0, -22], scale: 1.05, rotation: -0.1 },
    { kind: 'crop', position: [-28, 0, -4], scale: 1.0, rotation: 0.1 },
    { kind: 'crop', position: [-23, 0, 2], scale: 1.0, rotation: -0.2 },
    { kind: 'crop', position: [4, 0, 20], scale: 1.15, rotation: 0.0 },
    { kind: 'crop', position: [22, 0, 18], scale: 1.1, rotation: 0.15 }
  ];

  villageLayout.forEach((entry, index) => {
    let object = null;
    if (entry.kind === 'hut') {
      object = createCircularHut({
        wallColor: index % 2 === 0 ? 0xa99369 : 0x9f8a60,
        roofColor: index % 2 === 0 ? 0xa57645 : 0x8f653e,
        accentColor: 0x5c4730,
        wallRadius: 2.8 + (index % 2) * 0.2,
        wallHeight: 2.6 + (index % 3) * 0.05,
        roofHeight: 2.8 + (index % 2) * 0.15,
        fenceCount: 10 + (index % 3)
      });
    } else if (entry.kind === 'tree') {
      object = createVillageTree({
        trunkColor: index % 2 === 0 ? 0x7a4d2c : 0x6f4525,
        foliageColor: index % 2 === 0 ? 0x547f33 : 0x4c7630
      });
    } else {
      object = createCropPatch({
        cropColor: index % 2 === 0 ? 0x7dad48 : 0x6da242,
        soilColor: index % 2 === 0 ? 0x6d5738 : 0x5f4c31,
        cropCount: 12 + (index % 3)
      });
    }

    object.position.set(entry.position[0], entry.position[1], entry.position[2]);
    object.rotation.y = entry.rotation;
    object.scale.setScalar(entry.scale);
    shorelineCommunity.add(object);
  });

  const homeSeeds = [
    [-80, -40], [-76, -20], [-78, 2], [-76, 26], [-72, 48],
    [60, -44], [66, -20], [70, 8], [68, 30], [60, 50],
    [-52, 62], [-22, 66], [10, 64], [40, 60]
  ];
  const homeCount = communityConfig.homeCount || homeSeeds.length;
  for (let i = 0; i < homeCount; i += 1) {
    const seed = homeSeeds[i % homeSeeds.length];
    const home = createCircularHut({
      wallColor: i % 3 === 0 ? 0xa88f66 : 0x9f865f,
      roofColor: i % 2 === 0 ? 0x8a633d : 0x7d5735,
      accentColor: i % 4 === 0 ? 0x4f4337 : 0x655041,
      wallRadius: 1.6 + (i % 3) * 0.12,
      wallHeight: 1.9 + (i % 2) * 0.1,
      roofHeight: 2.1 + (i % 2) * 0.12,
      fenceCount: 7 + (i % 3)
    });
    home.position.set(
      seed[0] + (Math.random() - 0.5) * 4,
      0,
      seed[1] + (Math.random() - 0.5) * 4
    );
    home.rotation.y = Math.atan2(-home.position.x, -home.position.z);
    const scale = 0.75 + Math.random() * 0.2;
    home.scale.setScalar(scale);
    shorelineCommunity.add(home);
  }

  const fisherCount = communityConfig.fisherCount || 6;
  for (let i = 0; i < fisherCount; i += 1) {
    const fisher = createFishingPerson({
      bobPhase: i * 0.8,
      bobSpeed: 0.4 + (i % 3) * 0.06,
      rodPhase: i * 0.45,
      driftSpeed: 0.03 + (i % 2) * 0.015,
      shoreOffset: i
    });
    const shoreSide = i % 2 === 0 ? 1 : -1;
    fisher.position.set(
      -24 + i * 18,
      0.05,
      shoreSide > 0 ? 49.5 : -53.5
    );
    fisher.rotation.y = shoreSide > 0 ? Math.PI : 0;
    fisher.scale.setScalar(1.8 + (i % 2) * 0.12);
    shorelineCommunity.add(fisher);
    fishers.push(fisher);
  }

  root.add(shorelineCommunity);

  const villagers = new THREE.Group();
  const villagerBodies = [];
  const villagerCount = lifeConfig.villagerCount || 16;
  for (let i = 0; i < villagerCount; i += 1) {
    const isCanoePaddler = i < Math.max(2, Math.floor(villagerCount * 0.28));
    const groupIdentity = i % 2 === 0 ? 'Dinka' : 'Nuer';
    const role = isCanoePaddler ? 'fisher' : (i % 3 === 0 ? 'farmer' : 'carrier');
    const villager = createVillageWorker({
      role,
      group: groupIdentity,
      actionPhase: i * 0.62,
      actionSpeed: 0.72 + (i % 4) * 0.08,
      stepSpeed: 0.26 + (i % 3) * 0.05,
      direction: i % 2 === 0 ? 1 : -1,
      bodyColor: i % 2 === 0 ? 0x2b1d0e : 0x362312,
      accentColor: i % 3 === 0 ? 0x3a2f27 : 0x4b3b30
    });

    const row = Math.floor(i / 2);
    villager.scale.setScalar(3.2 + (i % 3) * 0.22);

    if (isCanoePaddler) {
      const canoe = createAmbatchCanoe({
        bobPhase: i * 0.9,
        rowSpeed: 0.46 + (i % 2) * 0.08
      });
      canoe.position.set(-34 + i * 15, -0.02, -18 + i * 6);
      canoe.rotation.y = i % 2 === 0 ? 0.2 : -0.32;
      villager.position.set(0, 0.52, 0);
      villager.rotation.y = Math.PI / 2;
      villager.userData.canoe = canoe;
      villager.userData.workType = 'paddle';
      canoe.add(villager);
      villagers.add(canoe);
      canoes.push(canoe);
    } else {
      const inNuerCamp = groupIdentity === 'Nuer';
      const homeX = inNuerCamp ? (-34 + Math.random() * 30) : (28 + Math.random() * 34);
      const homeZ = inNuerCamp
        ? (-36 + row * 7 + (Math.random() - 0.5) * 6)
        : (12 + row * 7 + (Math.random() - 0.5) * 7);
      villager.position.set(
        homeX,
        0.05,
        homeZ
      );
      villager.rotation.y = inNuerCamp ? 0.85 : -1.2;
      villager.userData.anchorX = homeX;
      villager.userData.anchorZ = homeZ;
      villager.userData.roamX = inNuerCamp ? 24 : 20;
      villager.userData.roamZ = inNuerCamp ? 18 : 16;
      villagers.add(villager);

      const ripple = createWadingRipple();
      ripple.position.set(villager.position.x, -0.04, villager.position.z);
      shorelineCommunity.add(ripple);
      villager.userData.wadingRipple = ripple;
      wadingRipples.push(ripple);
    }

    villagerBodies.push(villager);
  }
  root.add(villagers);

  const birds = new THREE.Group();
  const flyingBirds = [];
  const waterBirds = [];
  const shoebills = [];

  const flyingBirdCount = lifeConfig.flyingBirdCount || 11;
  for (let i = 0; i < flyingBirdCount; i += 1) {
    const bird = createFlyingBird({
      bodyColor: i % 3 === 0 ? 0xf4f1e7 : 0xe7dcc8,
      accentColor: i % 2 === 0 ? 0x2e2a24 : 0x51463d,
      flapPhase: i * 0.8,
      flapSpeed: 2.1 + (i % 4) * 0.18,
      glideSpeed: 0.26 + (i % 5) * 0.025,
      orbitRadiusX: 31 + (i % 4) * 3.4,
      orbitRadiusZ: 18 + (i % 3) * 2.7,
      orbitOffset: i * 0.55,
      altitude: 8.5 + (i % 5) * 0.85,
      bank: 0.18 + (i % 4) * 0.05,
      sway: 0.6 + (i % 3) * 0.15
    });
    bird.position.set(-12 + i * 2.2, 10 + (i % 4) * 0.55, -16 + (i % 5) * 5.2);
    bird.scale.setScalar(1.15 + (i % 3) * 0.06);
    birds.add(bird);
    flyingBirds.push(bird);
  }

  const waterBirdCount = lifeConfig.waterBirdCount || 5;
  for (let i = 0; i < waterBirdCount; i += 1) {
    const bird = createWaterBird({
      driftSpeed: 0.08 + (i % 3) * 0.02,
      driftPhase: i * 1.3,
      bobPhase: i * 0.75,
      bobStrength: 0.1 + (i % 2) * 0.03,
      row: i
    });
    bird.position.set(-26 + i * 13.5, -0.02, -8 + (i % 2) * 7.5);
    bird.scale.setScalar(0.92 + (i % 2) * 0.08);
    birds.add(bird);
    waterBirds.push(bird);
  }

  const shoebillCount = lifeConfig.shoebillCount || 2;
  for (let i = 0; i < shoebillCount; i += 1) {
    const stork = createShoebillStork({
      bobPhase: i * 0.9,
      stepPhase: i * 0.45,
      stepSpeed: 0.16 + i * 0.03
    });
    stork.position.set(-10 + i * 22, -0.02, -14 + i * 9);
    stork.rotation.y = i % 2 === 0 ? 0.6 : -0.4;
    stork.scale.setScalar(1.3 + i * 0.05);
    birds.add(stork);
    shoebills.push(stork);
  }

  root.add(birds);

  const hippoPods = new THREE.Group();
  const hippos = [];
  const hippoCount = lifeConfig.hippoCount || 3;
  for (let i = 0; i < hippoCount; i += 1) {
    const hippo = createHippo({
      driftPhase: i * 1.2,
      driftSpeed: 0.06 + (i % 2) * 0.02,
      bobStrength: 0.03 + (i % 3) * 0.015,
      bodyColor: i % 2 === 0 ? 0x79726f : 0x6f6a68
    });
    hippo.position.set(-16 + i * 18, -0.06, -6 + i * 8);
    hippo.rotation.y = 0.2 + i * 0.18;
    hippo.scale.setScalar(1 + (i % 2) * 0.12);
    hippoPods.add(hippo);
    hippos.push(hippo);
  }
  root.add(hippoPods);

  const pulseRing = new THREE.Mesh(
    new THREE.RingGeometry(18, 19.4, 60),
    new THREE.MeshBasicMaterial({ color: 0x92d7ff, transparent: true, opacity: 0 })
  );
  pulseRing.rotation.x = -Math.PI / 2;
  pulseRing.position.y = -0.2;
  root.add(pulseRing);

  const evaporationGeometry = new THREE.BufferGeometry();
  const evaporationCount = 360;
  const evaporationData = new Float32Array(evaporationCount * 3);
  const evaporationOrigin = new Float32Array(evaporationCount * 3);
  for (let i = 0; i < evaporationCount; i += 1) {
    const x = -64 + Math.random() * 116;
    const y = 0.3 + Math.random() * 4.2;
    const z = -56 + Math.random() * 112;

    evaporationData[i * 3] = x;
    evaporationData[i * 3 + 1] = y;
    evaporationData[i * 3 + 2] = z;

    evaporationOrigin[i * 3] = x;
    evaporationOrigin[i * 3 + 1] = y;
    evaporationOrigin[i * 3 + 2] = z;
  }
  evaporationGeometry.setAttribute('position', new THREE.BufferAttribute(evaporationData, 3));
  const evaporationPoints = new THREE.Points(
    evaporationGeometry,
    new THREE.PointsMaterial({
      color: 0xc6e9ff,
      size: 0.45,
      transparent: true,
      opacity: 0.46,
      depthWrite: false
    })
  );
  root.add(evaporationPoints);

  scene.add(root);

  return {
    root,
    terrain,
    water,
    waterUniforms,
    islands,
    islandOffsets,
    reeds,
    reedInstancedMesh,
    reedInstances,
    reedDummy,
    reedOffsets,
    shorelineCommunity,
    grassPatches,
    papyrusPatches,
    cows,
    fishers,
    wadingRipples,
    canoes,
    villagers,
    villagerBodies,
    birds,
    flyingBirds,
    waterBirds,
    shoebills,
    hippoPods,
    hippos,
    pulseRing,
    evaporationPoints,
    evaporationOrigin,
    zoomState: {
      focus: new THREE.Vector3(-4, -2, 0),
      smoothFocus: new THREE.Vector3(-4, -2, 0),
      smoothDirection: new THREE.Vector3(0, 0, 1),
      direction: new THREE.Vector3(),
      distance: camera.position.distanceTo(new THREE.Vector3(-4, -2, 0)),
      targetDistance: camera.position.distanceTo(new THREE.Vector3(-4, -2, 0)),
      isManualZooming: false
    },
    introActive: !document.body.classList.contains('experience-started'),
    revealProgress: 0,
    pulseInterval: pulseConfig.intervalMs || 9000,
    lastPulseTime: 0,
    pulseStrength: 0,
    baseWaterScale: 1,
    evaporationTrend: 0,
    flowDirection: waterConfig.flowDirection || [0.8, 0.2],
    barrierStrength: vegetationConfig.barrierStrength || 0.7,
    adaptationDrift: lifeConfig.adaptationDrift || 0.36
  };
}

function updateScene0(deltaSeconds, elapsedTime) {
  if (!scene0Runtime) {
    return;
  }

  const system = scene0Runtime;
  const t = elapsedTime;
  const tmpVecA = new THREE.Vector3();
  const tmpVecB = new THREE.Vector3();

  if (system.introActive) {
    system.revealProgress = Math.max(0, system.revealProgress - deltaSeconds * 0.35);
  } else {
    system.revealProgress = Math.min(1, system.revealProgress + deltaSeconds * 0.75);
  }

  const pulseTrigger = (performance.now() - system.lastPulseTime) > system.pulseInterval;
  if (pulseTrigger && !system.introActive) {
    system.lastPulseTime = performance.now();
    system.pulseStrength = 1;
  }
  system.pulseStrength = Math.max(0, system.pulseStrength - deltaSeconds * 0.24);

  system.evaporationTrend = 0.18 + (Math.sin(t * 0.1) * 0.5 + 0.5) * 0.34;
  const evapIntensity = system.evaporationTrend * (0.35 + system.revealProgress * 0.65);

  system.waterUniforms.uTime.value += deltaSeconds;
  system.waterUniforms.uEvap.value = evapIntensity;
  system.waterUniforms.uPulse.value = system.pulseStrength;
  system.waterUniforms.uFlow.value = 0.3 + system.barrierStrength * 0.2;

  const waterShrink = 1 - evapIntensity * 0.06;
  system.water.scale.set(waterShrink, 1, waterShrink);
  system.water.position.y = -0.28 - evapIntensity * 0.12;

  system.islands.children.forEach((island, idx) => {
    const islandData = island.userData || {};
    const bob = Math.sin(t * 0.7 + system.islandOffsets[idx]) * (islandData.bobAmount || 0.07);
    const drift = Math.cos(t * (islandData.driftSpeed || 0.26) + system.islandOffsets[idx]) * 0.06;
    island.position.y = -0.09 + bob;
    island.position.x += drift * deltaSeconds;
    if (island.position.x > 58) {
      island.position.x = -62;
    }
  });

  const pulseBoost = system.pulseStrength * 0.22;
  if (system.reedInstancedMesh) {
    for (let i = 0; i < system.reedInstances.length; i += 1) {
      const reedState = system.reedInstances[i];
      const sway = Math.sin(t * 2.1 + system.reedOffsets[i]) * (0.08 + pulseBoost);
      const bend = Math.cos(t * 1.8 + system.reedOffsets[i]) * (0.03 + pulseBoost * 0.35);
      const flowPush = (system.flowDirection[0] || 0) * 0.05;
      system.reedDummy.position.set(reedState.x, reedState.y, reedState.z);
      system.reedDummy.scale.set(1, reedState.height / 2.2, 1);
      system.reedDummy.rotation.set(bend, reedState.yaw, sway + flowPush);
      system.reedDummy.updateMatrix();
      system.reedInstancedMesh.setMatrixAt(i, system.reedDummy.matrix);
    }
    system.reedInstancedMesh.instanceMatrix.needsUpdate = true;
  }

  system.grassPatches.forEach((grass, idx) => {
    const grassData = grass.userData;
    grass.rotation.z = Math.sin(t * grassData.swaySpeed + grassData.swayPhase + idx * 0.15) * (grassData.swayAmount + pulseBoost * 0.7);
    grass.rotation.x = Math.cos(t * grassData.swaySpeed * 0.85 + grassData.swayPhase) * 0.04;
  });

  system.papyrusPatches.forEach((papyrus, idx) => {
    const papyrusData = papyrus.userData;
    const sway = Math.sin(t * papyrusData.swaySpeed + papyrusData.swayPhase + idx * 0.2) * (papyrusData.swayAmount + pulseBoost * 0.5);
    papyrus.rotation.z = sway;
    papyrus.rotation.x = Math.cos(t * papyrusData.swaySpeed * 0.8 + idx * 0.2) * 0.04;
  });

  system.villagerBodies.forEach((villager, idx) => {
    const villagerData = villager.userData;
    const phase = t * villagerData.actionSpeed + villagerData.actionPhase;
    const isInCanoe = !!villagerData.canoe;
    const inWaterZone = !isInCanoe
      && villager.position.x > -84
      && villager.position.x < 70
      && villager.position.z > -66
      && villager.position.z < 62;
    const speedFactor = inWaterZone ? 0.5 : 1;
    const stride = Math.sin(phase * 1.2) * deltaSeconds * villagerData.stepSpeed * speedFactor;

    if (isInCanoe) {
      const canoeData = villagerData.canoe.userData;
      villagerData.canoe.position.y = -0.02 + Math.sin(t * 1.2 + canoeData.bobPhase) * 0.08;
      villagerData.canoe.position.x += Math.sin(phase * 0.35) * deltaSeconds * 0.6;
      villagerData.canoe.position.z += Math.cos(phase * 0.3) * deltaSeconds * 0.45;
      canoeData.paddle.rotation.z = -0.75 + Math.sin(t * canoeData.rowSpeed + idx) * 0.45;
      villagerData.leftArm.rotation.z = 1.12 + Math.sin(t * canoeData.rowSpeed + idx) * 0.3;
      villagerData.rightArm.rotation.z = -1.0 - Math.sin(t * canoeData.rowSpeed + idx + 0.3) * 0.22;
      villagerData.torso.rotation.x = -0.15 + Math.sin(t * canoeData.rowSpeed + idx) * 0.1;
      villagerData.head.rotation.x = 0.08;
      return;
    }

    let nearestCow = null;
    let nearestCowDistance = Infinity;
    if (system.cows.length > 0) {
      for (let c = 0; c < system.cows.length; c += 1) {
        const cow = system.cows[c];
        const dx = cow.position.x - villager.position.x;
        const dz = cow.position.z - villager.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < nearestCowDistance) {
          nearestCowDistance = distance;
          nearestCow = cow;
        }
      }
    }
    const isGuardingCow = !!nearestCow && nearestCowDistance <= 5;
    villagerData.guarding = isGuardingCow;

    villager.position.y = 0.08 + Math.abs(Math.sin(phase * 1.6)) * 0.08;
    villager.rotation.y += Math.sin(phase * 0.35) * deltaSeconds * 0.25;
    villager.position.z += stride * villagerData.direction;
    villager.rotation.z = Math.sin(phase * 0.8) * 0.15;

    if (isGuardingCow) {
      villagerData.leftArm.rotation.z = 0.5 + Math.sin(phase) * 0.05;
      villagerData.rightArm.rotation.z = -0.5 - Math.sin(phase * 1.05) * 0.05;
      villagerData.torso.rotation.x = -0.03;
      villager.position.z += Math.sin(phase * 0.7) * deltaSeconds * 0.08;
    } else if (villagerData.workType === 'farm') {
      villagerData.leftArm.rotation.z = 0.78 + Math.sin(phase * 1.8) * 0.22;
      villagerData.rightArm.rotation.z = -0.72 - Math.sin(phase * 1.4) * 0.18;
      villagerData.torso.rotation.x = 0.15 + Math.max(0, Math.sin(phase)) * 0.3;
      if (villagerData.tool && villagerData.tool.handle) {
        villagerData.tool.handle.rotation.z = -1.02 + Math.sin(phase * 1.6) * 0.16;
      }
      if (villagerData.tool && villagerData.tool.blade) {
        villagerData.tool.blade.rotation.z = -0.32 + Math.sin(phase * 1.6) * 0.08;
      }
    } else {
      villagerData.leftArm.rotation.z = 0.95 + Math.sin(phase * 1.3) * 0.18;
      villagerData.rightArm.rotation.z = -0.55 - Math.sin(phase * 1.1) * 0.12;
      villagerData.torso.rotation.x = -0.1;
      if (villagerData.tool && villagerData.tool.basket) {
        villagerData.tool.basket.position.y = 0.6 + Math.sin(phase * 1.5) * 0.06;
      }
    }

    const floodDepth = inWaterZone ? clamp(0.56 + system.waterUniforms.uPulse.value * 0.52, 0.56, 0.96) : 1;
    villagerData.leftLeg.scale.y = floodDepth;
    villagerData.rightLeg.scale.y = floodDepth;
    villagerData.leftLeg.position.y = inWaterZone ? (0.18 - floodDepth * 0.16) : -0.02;
    villagerData.rightLeg.position.y = inWaterZone ? (0.18 - floodDepth * 0.16) : -0.02;

    if (villagerData.wadingRipple) {
      if (inWaterZone && Math.abs(stride) > 0.0003) {
        villagerData.wadingRipple.visible = true;
        villagerData.wadingRipple.position.set(villager.position.x, -0.04, villager.position.z);
        const rippleScale = 1 + Math.abs(Math.sin(phase * 3.2)) * 0.6;
        villagerData.wadingRipple.scale.set(rippleScale, rippleScale, rippleScale);
        villagerData.wadingRipple.material.opacity = 0.12 + Math.abs(Math.sin(phase * 2.5)) * 0.2;
      } else {
        villagerData.wadingRipple.visible = false;
      }
    }

    if (nearestCow) {
      nearestCow.getWorldPosition(tmpVecA);
      tmpVecB.copy(tmpVecA);
      villager.worldToLocal(tmpVecB);
      villagerData.head.lookAt(tmpVecB);
      villagerData.head.rotation.x += isGuardingCow ? -0.05 : 0;
    }

    const anchorX = Number.isFinite(villagerData.anchorX) ? villagerData.anchorX : villager.position.x;
    const anchorZ = Number.isFinite(villagerData.anchorZ) ? villagerData.anchorZ : villager.position.z;
    const roamX = Number.isFinite(villagerData.roamX) ? villagerData.roamX : 20;
    const roamZ = Number.isFinite(villagerData.roamZ) ? villagerData.roamZ : 16;
    villager.position.x = clamp(villager.position.x, anchorX - roamX, anchorX + roamX);
    villager.position.z = clamp(villager.position.z, anchorZ - roamZ, anchorZ + roamZ);
  });

  system.cows.forEach((cow, idx) => {
    const cowData = cow.userData;
    const phase = t * cowData.grazeSpeed + cowData.grazePhase;
    cow.position.x += Math.cos(phase) * deltaSeconds * 0.45 * cowData.direction;
    cow.position.z += Math.sin(phase * 0.8) * deltaSeconds * 0.2 * cowData.direction;
    cow.rotation.y += Math.sin(phase * 0.5) * deltaSeconds * 0.04;
    cow.position.y = Math.sin(phase * 1.4) * 0.02;
    const anchorX = Number.isFinite(cowData.anchorX) ? cowData.anchorX : cow.position.x;
    const anchorZ = Number.isFinite(cowData.anchorZ) ? cowData.anchorZ : cow.position.z;
    const roamX = Number.isFinite(cowData.roamX) ? cowData.roamX : 18;
    const roamZ = Number.isFinite(cowData.roamZ) ? cowData.roamZ : 14;

    if (cow.position.x > anchorX + roamX) {
      cow.position.x = anchorX + roamX;
      cowData.direction = -1;
    }
    if (cow.position.x < anchorX - roamX) {
      cow.position.x = anchorX - roamX;
      cowData.direction = 1;
    }
    cow.position.z = clamp(cow.position.z, anchorZ - roamZ, anchorZ + roamZ);
  });

  system.fishers.forEach((fisher) => {
    const fisherData = fisher.userData;
    const phase = t * fisherData.bobSpeed + fisherData.bobPhase;
    fisher.position.y = 0.05 + Math.sin(phase) * 0.08;
    fisher.position.x += Math.sin(phase * 0.45) * deltaSeconds * fisherData.driftSpeed;
    fisher.rotation.z = Math.sin(phase * 0.8) * 0.03;
    fisherData.torso.rotation.x = -0.06 + Math.sin(phase * 0.9) * 0.08;
    if (fisherData.rod) {
      fisherData.rod.rotation.z = -1.05 + Math.sin(t * 0.8 + fisherData.rodPhase) * (0.1 + system.pulseStrength * 0.18);
    }
    fisher.position.x = clamp(fisher.position.x, -42, 38);
  });

  system.flyingBirds.forEach((bird, idx) => {
    const birdData = bird.userData;
    const angle = t * birdData.glideSpeed + birdData.orbitOffset;
    bird.position.x = Math.sin(angle) * birdData.orbitRadiusX;
    bird.position.z = Math.cos(angle) * birdData.orbitRadiusZ;
    bird.position.y = birdData.altitude + Math.sin(t * 0.7 + idx * 1.1) * birdData.sway;
    const heading = Math.atan2(
      Math.cos(angle) * birdData.orbitRadiusX,
      -Math.sin(angle) * birdData.orbitRadiusZ
    );
    const bank = Math.sin(t * birdData.glideSpeed * 1.8 + birdData.orbitOffset) * birdData.bank;
    bird.rotation.y = heading;
    bird.rotation.z = bank;

    const flap = Math.sin(t * birdData.flapSpeed + birdData.flapPhase);
    birdData.leftWingPivot.rotation.x = 0.36 + flap * 0.55;
    birdData.rightWingPivot.rotation.x = -0.36 - flap * 0.55;
  });

  system.waterBirds.forEach((bird, idx) => {
    const birdData = bird.userData;
    const drift = t * birdData.driftSpeed + birdData.driftPhase;
    bird.position.x = -30 + idx * 14 + Math.sin(drift) * 2.4;
    bird.position.z = -4 + idx * 3.8 + Math.cos(drift * 0.7) * 2.2;
    bird.position.y = -0.02 + Math.sin(t * 1.3 + birdData.bobPhase) * birdData.bobStrength;
    bird.rotation.y = Math.sin(drift) * 0.18;
    bird.rotation.z = Math.sin(t * 0.9 + birdData.row) * 0.05;
    birdData.wake.scale.setScalar(1 + Math.sin(t * 1.5 + birdData.row) * 0.12);
    birdData.wake.material.opacity = 0.26 + (Math.sin(t * 1.1 + birdData.row) * 0.08 + 0.1);
  });

  system.shoebills.forEach((stork, idx) => {
    const storkData = stork.userData;
    const step = t * storkData.stepSpeed + storkData.stepPhase;
    stork.position.y = -0.02 + Math.sin(t * 1.2 + storkData.bobPhase) * 0.04;
    stork.position.x += Math.sin(step + idx) * deltaSeconds * 0.12;
    stork.position.z += Math.cos(step * 0.8 + idx * 0.5) * deltaSeconds * 0.1;
    stork.rotation.y += Math.sin(step * 0.6) * deltaSeconds * 0.2;
    stork.position.x = clamp(stork.position.x, -28, 28);
    stork.position.z = clamp(stork.position.z, -26, 24);
  });

  system.hippos.forEach((hippo, idx) => {
    const hippoData = hippo.userData;
    const phase = t * hippoData.driftSpeed + hippoData.driftPhase;
    hippo.position.x += Math.sin(phase + idx * 0.3) * deltaSeconds * 0.18;
    hippo.position.z += Math.cos(phase * 0.6) * deltaSeconds * 0.16;
    hippo.position.y = -0.06 + Math.sin(phase * 1.3) * hippoData.bobStrength;
    hippo.rotation.y += Math.sin(phase * 0.5) * deltaSeconds * 0.18;
    hippo.position.x = clamp(hippo.position.x, -44, 30);
    hippo.position.z = clamp(hippo.position.z, -24, 24);
  });

  const positions = system.evaporationPoints.geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] += (0.02 + evapIntensity * 0.05);
    positions[i] += Math.sin(t * 0.8 + i) * 0.002;
    if (positions[i + 1] > 5.7 + evapIntensity * 2.8) {
      positions[i] = system.evaporationOrigin[i];
      positions[i + 1] = system.evaporationOrigin[i + 1];
      positions[i + 2] = system.evaporationOrigin[i + 2];
    }
  }
  system.evaporationPoints.geometry.attributes.position.needsUpdate = true;
  system.evaporationPoints.material.opacity = 0.24 + evapIntensity * 0.52;

  const ringScale = 1 + (1 - system.pulseStrength) * 1.8;
  system.pulseRing.scale.set(ringScale, ringScale, ringScale);
  system.pulseRing.material.opacity = system.pulseStrength * 0.45;

  const terrainTarget = new THREE.Color(0x556d3e).lerp(new THREE.Color(0x788451), system.revealProgress * 0.45 + system.pulseStrength * 0.15);
  system.terrain.material.color.lerp(terrainTarget, 0.08);
}

function getRendererSize() {
  if (canvas && canvas.parentElement) {
    const w = Math.max(canvas.parentElement.clientWidth, 1);
    const h = Math.max(canvas.parentElement.clientHeight, 1);
    return { width: w, height: h };
  }

  return {
    width: Math.max(window.innerWidth, 1),
    height: Math.max(window.innerHeight, 1)
  };
}

function getDefaultGeometryFromType(objectType) {
  switch (objectType) {
    case 'terrain':
    case 'water':
    case 'vegetation':
      return 'plane';
    case 'infrastructure':
      return 'box';
    case 'character':
    case 'animal':
      return 'cylinder';
    case 'props':
      return 'box';
    case 'animation':
      return 'sphere';
    default:
      return 'box';
  }
}

function getDefaultScale(geometryType, objectType) {
  if (geometryType === 'plane') {
    return objectType === 'terrain' ? [200, 200] : [10, 10];
  }

  if (geometryType === 'sphere') {
    return [2, 2, 2];
  }

  if (geometryType === 'cylinder') {
    return objectType === 'character' || objectType === 'animal' ? [1.2, 4, 1.2] : [1, 3, 1];
  }

  if (geometryType === 'cone') {
    return [1.5, 3, 1.5];
  }

  if (geometryType === 'line') {
    return [20, 1, 1];
  }

  return [3, 3, 3];
}

function getDefaultColor(objectType) {
  switch (objectType) {
    case 'terrain': return 0x7f6a4a;
    case 'water': return 0x4a90e2;
    case 'vegetation': return 0x6ba82f;
    case 'character': return 0xd4b08a;
    case 'animal': return 0x8d6e63;
    case 'infrastructure': return 0x777777;
    case 'props': return 0xc28f5b;
    case 'animation': return 0x88c8ff;
    default: return 0x999999;
  }
}

/**
 * Initialize Three.js renderer and scene
 */
export function initThreeJS() {
  canvas = document.getElementById('three-canvas');
  
  if (!isWebGLSupported()) {
    console.warn('WebGL not supported; using fallback mode');
    setWebGLFallback();
    return false;
  }

  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a2a3a);
  scene.fog = new THREE.FogExp2(0xd7e7ef, 0.005);

  // Camera setup
  const initialSize = getRendererSize();
  camera = new THREE.PerspectiveCamera(62, initialSize.width / initialSize.height, 0.1, 1000);
  camera.position.set(8, 26, 42);
  camera.lookAt(0, 8, 0);

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(initialSize.width, initialSize.height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  scene0Controls = new OrbitControls(camera, renderer.domElement);
  scene0Controls.enableDamping = true;
  scene0Controls.dampingFactor = 0.05;
  scene0Controls.enableRotate = true;
  scene0Controls.enablePan = true;
  scene0Controls.enableZoom = true;
  scene0Controls.minDistance = 18;
  scene0Controls.maxDistance = 78;
  scene0Controls.target.set(0, 8, 0);
  scene0Controls.screenSpacePanning = true;
  scene0Controls.minPolarAngle = 0.35;
  scene0Controls.maxPolarAngle = 1.35;
  scene0Controls.enabled = false;
  scene0Controls.update();

  // Lighting
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.left = -200;
  directionalLight.shadow.camera.right = 200;
  directionalLight.shadow.camera.top = 200;
  directionalLight.shadow.camera.bottom = -200;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  scene.add(directionalLight);
  directionalLightRef = directionalLight;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);
  ambientLightRef = ambientLight;

  const hemiLight = new THREE.HemisphereLight(0xf2fbff, 0x5a4d3d, 0.55);
  scene.add(hemiLight);
  hemiLightRef = hemiLight;
  weatherEffects = createWeatherEffects();
  applyLiveWeatherToScene({ theme: 'sunny' });

  window.addEventListener('jonglei:intro-start', () => {
    if (scene0Runtime) {
      scene0Runtime.introActive = false;
    }
  });

  // Start animation loop
  animate();

  // Handle resize
  window.addEventListener('resize', onWindowResize);

  return true;
}

/**
 * Animation loop
 */
function animate() {
  animationFrameId = requestAnimationFrame(animate);

  const now = performance.now();
  const deltaSeconds = Math.min((now - scene0LastFrameTime) / 1000, 0.05);
  const elapsedTime = (now - scene0StartTime) / 1000;
  scene0LastFrameTime = now;

  // Update animated objects
  Object.values(sceneObjects).forEach(obj => {
    if (obj.userData && obj.userData.animated) {
      if (obj.userData.animationType === 'water') {
        obj.rotation.z += 0.0005;
      } else if (obj.userData.animationType === 'character') {
        obj.position.y = Math.sin(Date.now() * 0.002) * 0.1;
      }
    }
  });

  if (currentSceneIndex === 0) {
    updateScene0(deltaSeconds, elapsedTime);
  } else if (currentSceneIndex === 1) {
    updateScene1(deltaSeconds, elapsedTime);
  }

  updateWeatherEffects(deltaSeconds, elapsedTime);

  if (scene0Controls && !isTransitioning) {
    scene0Controls.update();
  }

  renderer.render(scene, camera);
}

/**
 * Create basic geometry for scene objects
 */
function createGeometry(objectDef) {
  const objectType = objectDef.type || 'props';
  const type = objectDef.geometry || getDefaultGeometryFromType(objectType);
  const scale = objectDef.scale || getDefaultScale(type, objectType);
  const color = objectDef.color || getDefaultColor(objectType);
  let geom;

  switch (type) {
    case 'plane':
      if (objectDef.puddle === true) {
        const radius = Math.min(scale[0], scale[1]) * 0.5;
        geom = new THREE.CircleGeometry(radius, 28);
        const pos = geom.attributes.position;
        for (let i = 1; i < pos.count; i += 1) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          const angle = Math.atan2(y, x);
          const edgeNoise = Math.sin(angle * 3) * 1.1 + Math.cos(angle * 5) * 0.6;
          pos.setXY(i, x + Math.cos(angle) * edgeNoise, y + Math.sin(angle) * edgeNoise);
        }
        geom.computeVertexNormals();
      } else {
        geom = new THREE.PlaneGeometry(scale[0], scale[1]);
      }
      break;
    case 'sphere':
      geom = new THREE.SphereGeometry(scale[0], 32, 32);
      break;
    case 'box':
      geom = new THREE.BoxGeometry(scale[0], scale[1], scale[2]);
      break;
    case 'cylinder':
      geom = new THREE.CylinderGeometry(scale[0], scale[0], scale[1], 32);
      break;
    case 'cone':
      geom = new THREE.ConeGeometry(scale[0], scale[1], 32);
      break;
    case 'line':
      geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-scale[0] / 2, 0, 0),
        new THREE.Vector3(scale[0] / 2, 0, 0)
      ]);
      break;
    default:
      geom = new THREE.BoxGeometry(1, 1, 1);
  }

  const material = type === 'line'
    ? new THREE.LineBasicMaterial({ color })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 });

  const mesh = type === 'line'
    ? new THREE.Line(geom, material)
    : new THREE.Mesh(geom, material);

  if (mesh instanceof THREE.Mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }

  return mesh;
}

/**
 * Load a scene from scene definition
 */
export function loadScene(sceneData) {
  if (!scene || !camera) {
    return;
  }

  const incomingSceneIndex = Number.isFinite(sceneData.id) ? sceneData.id : 0;
  const previousSceneIndex = currentSceneIndex;
  const previousScene0Root = scene0Runtime ? scene0Runtime.root : null;
  const isScene0To1Transition = previousSceneIndex === 0 && incomingSceneIndex === 1 && !!previousScene0Root;

  if (scene0Controls) {
    scene0Controls.enabled = false;
  }

  if (!isScene0To1Transition) {
    clearSceneObjects();
    scene0Runtime = null;
  }

  if (incomingSceneIndex !== 1) {
    scene1Runtime = null;
  }

  currentSceneIndex = incomingSceneIndex;

  // Set camera position and target
  const { pos, target } = sceneData.camera;
  const startPos = camera.position.clone();
  const endPos = new THREE.Vector3(...pos);
  const endTarget = new THREE.Vector3(...target);

  let transitionSourceRoot = null;
  let transitionTargetRoot = null;

  if (incomingSceneIndex === 0) {
    scene0Runtime = buildScene0System(sceneData);
    sceneObjects['scene0-root'] = scene0Runtime.root;
  } else {
    // Create new objects
    sceneData.objects.forEach((objDef, idx) => {
      const mesh = createGeometry(objDef);
      if (objDef.position) {
        mesh.position.set(...objDef.position);
      }

      const geometryType = objDef.geometry || getDefaultGeometryFromType(objDef.type);
      if (geometryType === 'plane') {
        mesh.rotation.x = -Math.PI / 2;
      }

      if (Array.isArray(objDef.stretch) && objDef.stretch.length >= 3) {
        mesh.scale.set(objDef.stretch[0], objDef.stretch[1], objDef.stretch[2]);
      }

      mesh.userData = {
        animated: objDef.animated || false,
        animationType: objDef.type
      };
      scene.add(mesh);
      const key = objDef.id || objDef.name || `obj-${idx}`;
      sceneObjects[key] = mesh;
    });

    if (incomingSceneIndex === 1) {
      scene1Runtime = buildScene1System(sceneData);
      scene1Runtime.root.position.y = isScene0To1Transition ? -30 : 0;
      sceneObjects['scene1-root'] = scene1Runtime.root;
      transitionTargetRoot = scene1Runtime.root;
    }
  }

  if (isScene0To1Transition) {
    transitionSourceRoot = previousScene0Root;
  }

  // Animate camera transition
  isTransitioning = true;
  const startTime = Date.now();
  const duration = 1000; // 1 second

  const animateCamera = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);

    camera.position.lerpVectors(startPos, endPos, eased);
    camera.lookAt(endTarget);

    if (isScene0To1Transition) {
      transitionToScene(progress, transitionSourceRoot, transitionTargetRoot);
    }

    if (progress < 1) {
      requestAnimationFrame(animateCamera);
    } else {
      if (isScene0To1Transition && transitionSourceRoot) {
        scene.remove(transitionSourceRoot);
        disposeObject3D(transitionSourceRoot);
        delete sceneObjects['scene0-root'];
        scene0Runtime = null;
      }

      isTransitioning = false;
      if (scene0Controls) {
        scene0Controls.enabled = true;
        if (currentSceneIndex === 1) {
          scene0Controls.minDistance = 6;
          scene0Controls.maxDistance = 62;
          scene0Controls.target.set(0, 6, -20);
        } else {
          scene0Controls.minDistance = 18;
          scene0Controls.maxDistance = 78;
          scene0Controls.target.set(0, 8, 0);
        }
      }

      if (scene0Controls && currentSceneIndex === 0) {
        scene0Controls.enabled = true;
        scene0Controls.update();
      } else if (scene0Controls && currentSceneIndex === 1) {
        scene0Controls.update();
      }
    }
  };

  animateCamera();
}

/**
 * Handle window resize
 */
function onWindowResize() {
  if (!camera || !renderer) return;

  const { width, height } = getRendererSize();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

/**
 * Fallback for WebGL unavailable
 */
function setWebGLFallback() {
  const canvas = document.getElementById('three-canvas');
  canvas.style.display = 'none';
  const fallbackImage = document.getElementById('fallback-image');
  fallbackImage.style.display = 'block';
  fallbackImage.src = `assets/fallback/scene-0.png`;
}

/**
 * Update fallback image for current scene
 */
export function updateFallbackImage(sceneIndex) {
  const fallbackImage = document.getElementById('fallback-image');
  fallbackImage.src = `assets/fallback/scene-${sceneIndex}.png`;
}

/**
 * Check if transitioning
 */
export function isSceneTransitioning() {
  return isTransitioning;
}

/**
 * Cleanup on page unload
 */
export function cleanupThreeJS() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  window.removeEventListener('resize', onWindowResize);
  if (scene0Controls) {
    scene0Controls.dispose();
    scene0Controls = null;
  }
  directionalLightRef = null;
  ambientLightRef = null;
  hemiLightRef = null;
  if (weatherEffects) {
    scene.remove(weatherEffects.root);
    disposeObject3D(weatherEffects.root);
    weatherEffects = null;
  }
  scene0Runtime = null;
  scene1Runtime = null;
  clearSceneObjects();
}
