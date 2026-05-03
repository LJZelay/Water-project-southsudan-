/**
 * three-init.js
 * Three.js scene initialization, rendering, and geometry setup
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { isWebGLSupported, lerp, easeInOutCubic, clamp } from './utils.js';
import { selectPersonWithDialogue, setHoveredPerson, getSceneState } from './sceneState.js';

let scene, camera, renderer;
let canvas;
let externalThreeContext = null;
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
let scene2Runtime = null;
let scene3Runtime = null;
let scene4Runtime = null;
let scene5Runtime = null;
let scene0Controls = null;
let scene0LastFrameTime = performance.now();
let scene0StartTime = scene0LastFrameTime;
const SCENE1_WHEEL_ROTATION_SPEED = 1.35;
const sceneClickRaycaster = new THREE.Raycaster();
const sceneClickPointer = new THREE.Vector2();
let hoveredDialogueTarget = null;

export function setExternalThreeContext(context = null) {
  externalThreeContext = context;
}

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

  group.userData = { 
    kind: 'refined-engineer', 
    hasTheodolite: !!config.hasTheodolite,
    body,
    head,
    hat,
    leftLeg,
    rightLeg,
    torso: body,
    leftArm: null,
    rightArm: null
  };
  return group;
}

function createKneelingEngineer() {
  const group = new THREE.Group();
  const engineer = createRefinedEngineer();
  
  // Wrap legs in pivot groups for kneeling pose
  const leftLegPivot = new THREE.Group();
  const rightLegPivot = new THREE.Group();
  
  // Get direct references to legs from userData
  if (engineer.userData.leftLeg && engineer.userData.rightLeg) {
    const leftLeg = engineer.userData.leftLeg;
    const rightLeg = engineer.userData.rightLeg;
    
    // Remove legs from engineer
    engineer.remove(leftLeg);
    engineer.remove(rightLeg);
    
    // Set up pivot positions
    leftLegPivot.position.copy(leftLeg.position);
    rightLegPivot.position.copy(rightLeg.position);
    
    // Reset leg positions relative to pivots
    leftLeg.position.set(0, -0.43, 0);
    rightLeg.position.set(0, -0.43, 0);
    
    // Add legs to pivots
    leftLegPivot.add(leftLeg);
    rightLegPivot.add(rightLeg);
    
    // Add pivots to engineer
    engineer.add(leftLegPivot);
    engineer.add(rightLegPivot);
    
    // Apply kneeling pose
    leftLegPivot.rotation.x = -1.5;
    rightLegPivot.rotation.x = -1.5;
  }
  
  // Bend torso forward
  if (engineer.userData.torso) {
    engineer.userData.torso.rotation.x = 1.2;
  }
  
  group.add(engineer);
  group.userData = { kind: 'kneeling-engineer' };
  
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

// Dust particles rising from damaged machinery
  const dustCount = 40;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount * 3; i += 3) {
    dustPositions[i] = (Math.random() - 0.5) * 4 + 5;
    dustPositions[i + 1] = Math.random() * 2 + 3;
    dustPositions[i + 2] = (Math.random() - 0.5) * 4 + 12;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xbbaa88,
    size: 0.15,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  root.add(dust);

  // Make the entire excavator clickable
  bwe.userData.interactive = true;
  bwe.userData.dialogue = [
    "The excavator was silenced—not by failure, but by resistance.",
    "When machines stopped, the land could breathe again."
  ];
  bwe.userData.dialogueId = 'scene5-excavator';

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

class CrowdManager {
  constructor(parent) {
    this.parent = parent;
    this.group = new THREE.Group();
    this.people = [];
    this.militaryMembers = [];
    this.leaderMesh = null;
    this.militaryGroup = null;
    this.frontLineZ = -14;
    this.frontLinePushback = 0.08;
    this.sharedBanners = [];
    this.tensionFlash = null;
    this.isEscalating = false;
    this.escalationSun = null;
    this.escalationFill = null;
    this.baseSunIntensity = 0;
    this.baseFillIntensity = 0;
    this.nextFlashTime = 0.9 + Math.random() * 0.9;
    this.flashStartTime = -1;
    this.flashEndTime = -1;
    this.flashReactUntil = -1;
    this.flashPeakIntensity = 0;
    this.flashBurstDistance = 0;
    this.flashSourceX = -4;
    this.flashSourceZ = -19.6;
    this.screenFlash = null;
    this.lastUpdateTime = null;

    // Shared low-poly assets keep memory usage and draw setup lightweight.
    this.headGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    this.torsoGeometry = new THREE.BoxGeometry(0.5, 0.68, 0.26);
    this.upperLimbGeometry = new THREE.CylinderGeometry(0.055, 0.06, 0.36, 6);
    this.lowerLimbGeometry = new THREE.CylinderGeometry(0.05, 0.055, 0.34, 6);
    this.defaultBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x5b5a57, roughness: 0.86, metalness: 0.04 });
    this.defaultSkinMaterial = new THREE.MeshStandardMaterial({ color: 0xa2836f, roughness: 0.9, metalness: 0.02 });
    this.bannerStickGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1.15, 5);
    this.bannerPlaneGeometry = new THREE.PlaneGeometry(0.58, 0.34);
    this.bannerStickMaterial = new THREE.MeshStandardMaterial({ color: 0x7a6a56, roughness: 0.9, metalness: 0.03 });
    this.bannerPlaneMaterial = new THREE.MeshStandardMaterial({ color: 0xd7d4c6, roughness: 0.88, metalness: 0.02, side: THREE.DoubleSide });
    this.sharedBannerTexts = ['SAVE THE SUDD', 'WATER IS LIFE', 'OUR LAND OUR FUTURE'];
  }

  createBannerTexture(text, useRedText = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = useRedText ? '#a22a1f' : '#111111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  createSharedBanners() {
    if (!Array.isArray(this.people) || this.people.length < 1) {
      return;
    }

    const carriers = [];
    const maxCarriers = 12;
    const step = Math.max(2, Math.floor(this.people.length / maxCarriers));
    for (let i = 0; i < this.people.length; i += step) {
      carriers.push(this.people[i]);
      if (carriers.length >= maxCarriers) {
        break;
      }
    }

    carriers.forEach((carrier, idx) => {
      const text = this.sharedBannerTexts[idx % this.sharedBannerTexts.length];
      const posterTexture = this.createBannerTexture(text, idx % 2 === 1);

      const posterGroup = new THREE.Group();
      const stick = new THREE.Mesh(this.bannerStickGeometry, this.bannerStickMaterial);
      stick.position.y = 0.58;
      posterGroup.add(stick);

      // Place the poster at the top of the stick instead of center.
      const posterBoard = new THREE.Mesh(
        new THREE.PlaneGeometry(0.46, 0.3),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.84,
          metalness: 0.02,
          map: posterTexture,
          transparent: true,
          opacity: 0.62,
          side: THREE.DoubleSide
        })
      );
      posterBoard.position.set(0, 1.14, 0.035);
      posterGroup.add(posterBoard);

      this.group.add(posterGroup);
      this.sharedBanners.push({
        mesh: posterGroup,
        board: posterBoard,
        carrier,
        handLocal: new THREE.Vector3(-0.24, 1.22, 0.18),
        chestLift: 0.03,
        forwardPush: 0.08,
        offset: Math.random() * Math.PI * 2,
        swaySpeed: 0.85 + Math.random() * 0.35,
        swayAmount: 0.035 + Math.random() * 0.02
      });
    });
  }

  createHumanoid(options = {}) {
    const person = new THREE.Group();

    const torsoMaterial = options.torsoMaterial || this.defaultBodyMaterial;
    const limbMaterial = options.limbMaterial || torsoMaterial;
    const skinMaterial = options.skinMaterial || this.defaultSkinMaterial;

    const torso = new THREE.Mesh(this.torsoGeometry, torsoMaterial);
    torso.position.y = 1.15;
    torso.name = 'torso';
    person.add(torso);

    const head = new THREE.Mesh(this.headGeometry, skinMaterial);
    head.position.y = 1.62;
    head.name = 'head';
    person.add(head);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.3, 1.38, 0);
    leftArm.name = 'leftArm';
    const leftUpperArm = new THREE.Mesh(this.upperLimbGeometry, limbMaterial);
    leftUpperArm.position.y = -0.18;
    leftArm.add(leftUpperArm);
    const leftElbow = new THREE.Group();
    leftElbow.position.y = -0.36;
    leftElbow.name = 'leftElbow';
    const leftLowerArm = new THREE.Mesh(this.lowerLimbGeometry, limbMaterial);
    leftLowerArm.position.y = -0.17;
    leftElbow.add(leftLowerArm);
    leftArm.add(leftElbow);
    person.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.3, 1.38, 0);
    rightArm.name = 'rightArm';
    const rightUpperArm = new THREE.Mesh(this.upperLimbGeometry, limbMaterial);
    rightUpperArm.position.y = -0.18;
    rightArm.add(rightUpperArm);
    const rightElbow = new THREE.Group();
    rightElbow.position.y = -0.36;
    rightElbow.name = 'rightElbow';
    const rightLowerArm = new THREE.Mesh(this.lowerLimbGeometry, limbMaterial);
    rightLowerArm.position.y = -0.17;
    rightElbow.add(rightLowerArm);
    rightArm.add(rightElbow);
    person.add(rightArm);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.13, 0.82, 0);
    leftLeg.name = 'leftLeg';
    const leftUpperLeg = new THREE.Mesh(this.upperLimbGeometry, limbMaterial);
    leftUpperLeg.position.y = -0.18;
    leftLeg.add(leftUpperLeg);
    const leftKnee = new THREE.Group();
    leftKnee.position.y = -0.36;
    leftKnee.name = 'leftKnee';
    const leftLowerLeg = new THREE.Mesh(this.lowerLimbGeometry, limbMaterial);
    leftLowerLeg.position.y = -0.17;
    leftKnee.add(leftLowerLeg);
    leftLeg.add(leftKnee);
    person.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.13, 0.82, 0);
    rightLeg.name = 'rightLeg';
    const rightUpperLeg = new THREE.Mesh(this.upperLimbGeometry, limbMaterial);
    rightUpperLeg.position.y = -0.18;
    rightLeg.add(rightUpperLeg);
    const rightKnee = new THREE.Group();
    rightKnee.position.y = -0.36;
    rightKnee.name = 'rightKnee';
    const rightLowerLeg = new THREE.Mesh(this.lowerLimbGeometry, limbMaterial);
    rightLowerLeg.position.y = -0.17;
    rightKnee.add(rightLowerLeg);
    rightLeg.add(rightKnee);
    person.add(rightLeg);

    person.userData.torso = torso;
    person.userData.head = head;
    person.userData.leftArm = leftArm;
    person.userData.rightArm = rightArm;
    person.userData.leftElbow = leftElbow;
    person.userData.rightElbow = rightElbow;
    person.userData.leftLeg = leftLeg;
    person.userData.rightLeg = rightLeg;
    person.userData.leftKnee = leftKnee;
    person.userData.rightKnee = rightKnee;
    person.userData.velocity = new THREE.Vector3(0, 0, 0);

    return person;
  }

  pickDialogueRole(movementRole = 'hold', type = 'confronting') {
    if (movementRole === 'retreat') {
      return 'villager';
    }

    if (movementRole === 'advance-stick') {
      return 'organizer';
    }

    if (type === 'hands_up') {
      return 'student';
    }

    const roll = Math.random();
    if (roll < 0.34) return 'student';
    if (roll < 0.72) return 'villager';
    return 'organizer';
  }

  getDialogueLines(role) {
    const dialogueMap = {
      student: [
        'We protested... and they opened fire on students.',
        'We are students, but we will not stay silent.'
      ],
      villager: [
        'It will drain the wetlands and destroy livelihoods.',
        'This canal is digging our grave before we perish.',
        'You cannot take our water and call it development.'
      ],
      organizer: [
        'Stay together. Do not break the line.',
        "They're pushing forward-hold your ground!",
        "They're shooting-get back!"
      ]
    };

    return dialogueMap[role] || dialogueMap.villager;
  }

  applyDialogueProfile(person, role) {
    const safeRole = role === 'student' || role === 'organizer' ? role : 'villager';
    person.userData.role = safeRole;
    person.userData.dialogue = [...this.getDialogueLines(safeRole)];
    person.userData.voiceIndex = 0;
  }

  setEscalating(active) {
    this.isEscalating = !!active;
  }

  bindEscalationLighting(sun, fill) {
    this.escalationSun = sun || null;
    this.escalationFill = fill || null;
    this.baseSunIntensity = sun ? sun.intensity : 0;
    this.baseFillIntensity = fill ? fill.intensity : 0;
  }

  findClosestTarget(source, candidates) {
    if (!source || !Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }

    let closest = null;
    let closestDistSq = Infinity;
    for (let i = 0; i < candidates.length; i += 1) {
      const target = candidates[i];
      if (!target || target === source) {
        continue;
      }
      const dx = target.position.x - source.position.x;
      const dz = target.position.z - source.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closest = target;
      }
    }

    return closest;
  }

  ensureVelocity(agent) {
    if (!agent) {
      return null;
    }

    if (!agent.userData) {
      agent.userData = {};
    }

    if (!(agent.userData.velocity instanceof THREE.Vector3)) {
      agent.userData.velocity = new THREE.Vector3(0, 0, 0);
    }

    return agent.userData.velocity;
  }

  integrateVelocity(agent, force, damping = 0.9, maxSpeed = 0.12) {
    if (!agent) {
      return;
    }

    const velocity = this.ensureVelocity(agent);
    if (!velocity) {
      return;
    }

    if (force) {
      velocity.add(force);
    }

    if (velocity.lengthSq() > maxSpeed * maxSpeed) {
      velocity.setLength(maxSpeed);
    }

    velocity.multiplyScalar(damping);
    agent.position.add(velocity);
  }

  applySeparation(agent, neighbors, minDistance, strength, deltaTime, forceOut = null) {
    if (!agent || !Array.isArray(neighbors) || deltaTime <= 0) {
      return;
    }

    let pushX = 0;
    let pushZ = 0;
    for (let i = 0; i < neighbors.length; i += 1) {
      const other = neighbors[i];
      if (!other || other === agent) {
        continue;
      }

      const dx = agent.position.x - other.position.x;
      const dz = agent.position.z - other.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < 1e-6) {
        continue;
      }

      const dist = Math.sqrt(distSq);
      if (dist >= minDistance) {
        continue;
      }

      const overlap = (minDistance - dist) / minDistance;
      pushX += (dx / dist) * overlap;
      pushZ += (dz / dist) * overlap;
    }

    if (forceOut) {
      forceOut.x += pushX * strength * deltaTime;
      forceOut.z += pushZ * strength * deltaTime;
      return;
    }

    const velocity = this.ensureVelocity(agent);
    if (!velocity) {
      return;
    }

    velocity.x += pushX * strength * deltaTime;
    velocity.z += pushZ * strength * deltaTime;
  }

  keepInsideTerrain(agent, padding = 4) {
    if (!agent) {
      return;
    }

    const minX = -50 + padding;
    const maxX = 50 - padding;
    const minZ = -50 + padding;
    const maxZ = 50 - padding;
    const velocity = this.ensureVelocity(agent);
    const clampedX = clamp(agent.position.x, minX, maxX);
    const clampedZ = clamp(agent.position.z, minZ, maxZ);
    if (velocity) {
      if (clampedX !== agent.position.x) {
        velocity.x = 0;
      }
      if (clampedZ !== agent.position.z) {
        velocity.z = 0;
      }
    }
    agent.position.x = clampedX;
    agent.position.z = clampedZ;
  }

  keepWithinCrowdRadius(agent, centerX, centerZ, radius) {
    if (!agent || !Number.isFinite(centerX) || !Number.isFinite(centerZ) || !Number.isFinite(radius) || radius <= 0) {
      return;
    }

    const dx = agent.position.x - centerX;
    const dz = agent.position.z - centerZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist <= radius || dist <= 1e-6) {
      return;
    }

    const nx = dx / dist;
    const nz = dz / dist;
    agent.position.x = centerX + nx * radius;
    agent.position.z = centerZ + nz * radius;
    const velocity = this.ensureVelocity(agent);
    if (velocity) {
      const outward = velocity.x * nx + velocity.z * nz;
      if (outward > 0) {
        velocity.x -= nx * outward;
        velocity.z -= nz * outward;
      }
    }
  }

  createMilitaryLine(count = 10, center = new THREE.Vector3(-4, 0, -8)) {
    const militaryGroup = new THREE.Group();
    this.militaryMembers = [];
    const militaryBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x2f3a33, roughness: 0.92, metalness: 0.04 });
    const militaryLimbMaterial = new THREE.MeshStandardMaterial({ color: 0x32373b, roughness: 0.9, metalness: 0.04 });
    const militaryHeadMaterial = new THREE.MeshStandardMaterial({ color: 0x5d5852, roughness: 0.92, metalness: 0.03 });
    const helmetMaterial = new THREE.MeshStandardMaterial({ color: 0x2e3330, roughness: 0.88, metalness: 0.06 });
    const rifleMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.86, metalness: 0.08 });
    const spacing = 1.05;

    for (let i = 0; i < count; i += 1) {
      const figure = this.createHumanoid({
        torsoMaterial: militaryBodyMaterial,
        limbMaterial: militaryLimbMaterial,
        skinMaterial: militaryHeadMaterial
      });

      if (figure.userData.torso) {
        figure.userData.torso.scale.x = 1.28;
      }

      const helmet = new THREE.Mesh(this.headGeometry, helmetMaterial);
      helmet.scale.set(1.04, 0.62, 1.04);
      helmet.position.set(0, 1.78, 0);
      figure.add(helmet);

      const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.95), rifleMaterial);
      rifle.position.set(0.22, 1.05, 0.26);
      rifle.rotation.x = Math.PI / 2;
      rifle.rotation.z = 0.1;
      figure.add(rifle);

      const muzzleFlash = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffa53d, transparent: true, opacity: 0 })
      );
      muzzleFlash.visible = false;
      this.group.add(muzzleFlash);

      const muzzleLight = new THREE.PointLight(0xffc35a, 0, 4.4, 2);
      muzzleLight.visible = false;
      this.group.add(muzzleLight);

      // Firm stance: planted legs and a slight forward lean.
      figure.rotation.x = -0.08;
      if (figure.userData.leftLeg) figure.userData.leftLeg.rotation.x = 0;
      if (figure.userData.rightLeg) figure.userData.rightLeg.rotation.x = 0;
      if (figure.userData.leftKnee) figure.userData.leftKnee.rotation.x = 0;
      if (figure.userData.rightKnee) figure.userData.rightKnee.rotation.x = 0;
      if (figure.userData.leftArm) figure.userData.leftArm.rotation.x = -0.04;
      if (figure.userData.rightArm) figure.userData.rightArm.rotation.x = -0.04;

      figure.position.set(
        center.x + (i - (count - 1) / 2) * spacing,
        center.y,
        center.z - 11.5
      );
      figure.rotation.y = Math.PI;
      figure.userData.baseX = figure.position.x;
      figure.userData.baseZ = figure.position.z;
      figure.userData.stepOffset = Math.random() * Math.PI * 2;
      figure.userData.patrolPhase = Math.random() * Math.PI * 2;
      figure.userData.patrolRadius = 0.9 + Math.random() * 1.1;
      figure.userData.rifle = rifle;
      figure.userData.muzzleFlash = muzzleFlash;
      figure.userData.muzzleLight = muzzleLight;
      figure.userData.shotUntil = -1;
      this.militaryMembers.push(figure);
      militaryGroup.add(figure);
    }

    this.group.add(militaryGroup);
    this.militaryGroup = militaryGroup;
    const militaryLineZ = center.z - 11.5;
    this.frontLineZ = militaryLineZ + 5.5;
    this.militaryFocus = new THREE.Vector3(center.x, 0, militaryLineZ);

    return militaryGroup;
  }

  createLeader(center = new THREE.Vector3(-4, 0, -8), platformAnchor = null) {
    const leader = this.createHumanoid({
      torsoMaterial: new THREE.MeshStandardMaterial({ color: 0x4d5157, roughness: 0.84, metalness: 0.06 }),
      limbMaterial: new THREE.MeshStandardMaterial({ color: 0x44484d, roughness: 0.86, metalness: 0.05 }),
      skinMaterial: new THREE.MeshStandardMaterial({ color: 0x9c7f67, roughness: 0.9, metalness: 0.02 })
    });
    this.applyDialogueProfile(leader, 'organizer');
    const leaderHead = leader.userData.head;
    const rightArm = leader.userData.rightArm;
    const rightElbow = leader.userData.rightElbow;
    const leftArm = leader.userData.leftArm;
    const leftElbow = leader.userData.leftElbow;

    const megaphoneGroup = new THREE.Group();
    const shellMaterial = new THREE.MeshStandardMaterial({ color: 0xc8c6c1, roughness: 0.48, metalness: 0.45 });
    const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x202326, roughness: 0.82, metalness: 0.08 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xe48e2c, roughness: 0.5, metalness: 0.22, emissive: 0x5a2d09, emissiveIntensity: 0.18 });

    const hornShell = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.132, 0.34, 14), shellMaterial);
    hornShell.rotation.x = Math.PI / 2;
    megaphoneGroup.add(hornShell);

    const hornRim = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.012, 8, 20), accentMaterial);
    hornRim.rotation.x = Math.PI / 2;
    hornRim.position.z = 0.17;
    megaphoneGroup.add(hornRim);

    const rearCap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 12), shellMaterial);
    rearCap.rotation.x = Math.PI / 2;
    rearCap.position.z = -0.18;
    megaphoneGroup.add(rearCap);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.19, 10), gripMaterial);
    handle.position.set(0, -0.1, -0.02);
    megaphoneGroup.add(handle);

    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.02), accentMaterial);
    trigger.position.set(0.01, -0.045, -0.045);
    megaphoneGroup.add(trigger);

    if (leaderHead) {
      leaderHead.add(megaphoneGroup);
      // Anchor the horn at the mouth so the leader appears to be speaking into it.
      megaphoneGroup.position.set(0.15, -0.03, 0.25);
      megaphoneGroup.rotation.set(-1.48, -0.04, 0.02);
    }

    if (platformAnchor) {
      leader.position.set(platformAnchor.x, platformAnchor.y, platformAnchor.z);
    } else {
      leader.position.set(center.x + 0.4, center.y, center.z + 2.3);
    }
    leader.scale.setScalar(1.2);
    leader.userData.type = 'leader';
    leader.userData.offset = Math.random() * Math.PI * 2;
    leader.userData.baseRotX = -0.09;
    leader.userData.head = leaderHead;
    leader.userData.platformAnchor = platformAnchor ? platformAnchor.clone() : null;
    leader.userData.megaphone = megaphoneGroup;
    leader.userData.dialogueId = 'scene2-leader';

    // One-hand hold pose: right hand grips near mouth-level megaphone, left hand stays relaxed.
    if (rightArm) {
      rightArm.rotation.x = -1.5;
      rightArm.rotation.z = -0.24;
    }
    if (rightElbow) rightElbow.rotation.x = 0.72;
    if (leftArm) {
      leftArm.rotation.x = 0.12;
      leftArm.rotation.z = 0.04;
    }
    if (leftElbow) leftElbow.rotation.x = 0.12;

    this.group.add(leader);
    this.leaderMesh = leader;
    return leader;
  }

  pickCrowdType() {
    const roll = Math.random();
    if (roll < 0.68) return 'confronting';
    if (roll < 0.9) return 'hands_up';
    if (roll < 0.96) return 'retreating';
    return 'listening';
  }

  createCrowd(count = 40, center = new THREE.Vector3(-4, 0, -8), minRadius = 4, maxRadius = 6, leaderAnchor = null) {
    const crowdClothingPalette = [0x5b5a57, 0x4f5d68, 0x5c5049, 0x4a5a50, 0x645755];
    const clusterCount = Math.max(8, Math.floor(count / 3.5));
    const clusterCenters = [];
    for (let i = 0; i < clusterCount; i += 1) {
      const t = i / clusterCount;
      const clusterAngle = t * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const radialMix = 0.3 + Math.random() * 0.7;
      const clusterRadius = minRadius + (maxRadius - minRadius) * radialMix;
      clusterCenters.push(new THREE.Vector3(
        center.x + Math.cos(clusterAngle) * clusterRadius,
        center.y,
        center.z + Math.sin(clusterAngle) * clusterRadius
      ));
    }

    this.crowdCenter = center.clone();
    this.crowdContainmentRadius = Math.max(8.6, maxRadius + 3.5);

    for (let i = 0; i < count; i += 1) {
      const torsoColor = crowdClothingPalette[(Math.random() * crowdClothingPalette.length) | 0];
      const limbColor = crowdClothingPalette[(Math.random() * crowdClothingPalette.length) | 0];
      const person = this.createHumanoid({
        torsoMaterial: new THREE.MeshStandardMaterial({ color: torsoColor, roughness: 0.86, metalness: 0.04 }),
        limbMaterial: new THREE.MeshStandardMaterial({ color: limbColor, roughness: 0.88, metalness: 0.03 }),
        skinMaterial: new THREE.MeshStandardMaterial({ color: 0xa2836f, roughness: 0.9, metalness: 0.02 })
      });
      const head = person.userData.head;

      const cluster = clusterCenters[i % clusterCenters.length] || center;
      const localAngle = Math.random() * Math.PI * 2;
      const localRadius = 0.45 + Math.random() * 1.4;
      const px = cluster.x + Math.cos(localAngle) * localRadius + (Math.random() - 0.5) * 0.22;
      const pz = cluster.z + Math.sin(localAngle) * localRadius + (Math.random() - 0.5) * 0.22;
      person.position.set(
        px,
        center.y,
        pz
      );
      const forwardYaw = Math.atan2(center.x - px, this.frontLineZ - pz);
      person.rotation.y = forwardYaw;

      person.userData.type = this.pickCrowdType();
      person.userData.offset = Math.random() * Math.PI * 2;
      person.userData.baseY = person.position.y;
      person.userData.baseX = person.position.x;
      person.userData.baseZ = person.position.z;
      person.userData.baseRotX = person.rotation.x;
      person.userData.engageOffset = ((i % 7) - 3) * 0.32;
      person.userData.targetMilitaryIndex = i % 10;
      person.userData.roamPhase = Math.random() * Math.PI * 2;
      person.userData.driftSpeed = 0.82 + Math.random() * 0.38;
      person.userData.bobAmplitude = 0.025 + Math.random() * 0.02;
      person.userData.bobSpeed = 1.1 + Math.random() * 0.5;
      person.userData.retreatBackSpeed = 0.42 + Math.random() * 0.22;
      person.userData.retreatTargetZ = person.userData.baseZ + (0.6 + Math.random() * 0.45);
      const roleRoll = Math.random();
      const movementRole = roleRoll < 0.25
        ? 'advance-stick'
        : (roleRoll < 0.5
          ? 'retreat'
          : (roleRoll < 0.85 ? 'raise-hands' : 'hold'));
      person.userData.movementRole = movementRole;
      person.userData.state = movementRole === 'advance-stick'
        ? 'approaching'
        : (movementRole === 'retreat' ? 'retreating' : 'holding');
      person.userData.stateTimer = movementRole === 'retreat'
        ? (0.6 + Math.random() * 1.2)
        : ((movementRole === 'hold' || movementRole === 'raise-hands') ? (1.2 + Math.random() * 1.6) : 0);
      if (movementRole === 'raise-hands') {
        person.userData.type = 'hands_up';
      }
      person.userData.head = head;
      person.userData.dialogueId = `scene2-person-${i}`;
      this.applyDialogueProfile(person, this.pickDialogueRole(movementRole, person.userData.type));

      if (movementRole === 'advance-stick' && person.userData.rightArm) {
        const stick = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.014, 1.06, 5),
          new THREE.MeshStandardMaterial({ color: 0x7b6348, roughness: 0.92, metalness: 0.02 })
        );
        stick.position.set(0.04, -0.5, 0.02);
        stick.rotation.z = -0.08;
        person.userData.rightArm.add(stick);
        person.userData.stick = stick;
      }

      this.group.add(person);
      this.people.push(person);
    }

    this.createLeader(center, leaderAnchor);
    this.createMilitaryLine(16, center);
    this.createSharedBanners();

    this.parent.add(this.group);
    return this.group;
  }

  update(time) {
    if (!Number.isFinite(time)) {
      return;
    }

    const deltaTime = this.lastUpdateTime === null
      ? 0
      : Math.max(0, Math.min(time - this.lastUpdateTime, 0.1));
    this.lastUpdateTime = time;

    // Check for vehicle presence from React side; if a vehicle is near the front line escalate tensions.
    try {
      const sceneStateSnap = getSceneState ? getSceneState() : null;
      if (sceneStateSnap && Number.isFinite(Number(sceneStateSnap.lastVehicleZ))) {
        const z = Number(sceneStateSnap.lastVehicleZ);
        if (z >= this.frontLineZ - 6 && z <= this.frontLineZ + 6) {
          this.setEscalating(true);
        } else {
          this.setEscalating(false);
        }
      }
    } catch (err) {
      // ignore if getSceneState isn't available
    }

    if (time >= this.nextFlashTime) {
      const duration = 0.14 + Math.random() * 0.12;
      this.flashStartTime = time;
      this.flashEndTime = time + duration;
      this.flashReactUntil = this.flashEndTime + 0.36;
      this.nextFlashTime = time + 0.8 + Math.random() * 0.9;

      if (this.militaryMembers.length > 0) {
        const shooterCount = Math.max(2, Math.floor(this.militaryMembers.length * 0.45));
        for (let i = 0; i < shooterCount; i += 1) {
          const pickIdx = (i * 2 + ((Math.random() * 3) | 0)) % this.militaryMembers.length;
          const shooter = this.militaryMembers[pickIdx];
          if (!shooter?.userData) {
            continue;
          }
          const shotExtension = Math.random() * 0.08;
          shooter.userData.shotUntil = Math.max(shooter.userData.shotUntil || -1, this.flashEndTime + shotExtension);
        }
      }
    }

    const flashActive = time < this.flashEndTime;
    const crowdReactActive = time < this.flashReactUntil;
    if (this.tensionFlash) this.tensionFlash.intensity = 0;
    if (this.screenFlash) this.screenFlash.intensity = 0;

    if (this.escalationSun || this.escalationFill) {
      const sunTarget = this.isEscalating ? this.baseSunIntensity * 0.72 : this.baseSunIntensity;
      const fillTarget = this.isEscalating ? this.baseFillIntensity * 0.78 : this.baseFillIntensity;
      if (this.escalationSun) {
        this.escalationSun.intensity += (sunTarget - this.escalationSun.intensity) * 0.06;
      }
      if (this.escalationFill) {
        this.escalationFill.intensity += (fillTarget - this.escalationFill.intensity) * 0.06;
      }
    }

    this.people.forEach((person, idx) => {
      const data = person.userData || {};
      const prevX = person.position.x;
      const prevZ = person.position.z;
      const isHovered = hoveredDialogueTarget === person;
      const pulseScale = 1 + Math.sin(time * 2.1 + idx * 0.27) * 0.016;
      const targetScale = isHovered ? 1.13 : pulseScale;
      const nextScale = person.scale.x + (targetScale - person.scale.x) * 0.18;
      person.scale.setScalar(nextScale);
      const moveForce = new THREE.Vector3(0, 0, 0);
      const velocity = this.ensureVelocity(person);
      const addMove = (dx, dz, scale = 0.35) => {
        moveForce.x += dx * scale;
        moveForce.z += dz * scale;
      };
      const bob = Math.sin(time * (data.bobSpeed || 1.2) + (data.offset || 0)) * (data.bobAmplitude || 0.03);
      const focusX = this.militaryFocus ? this.militaryFocus.x : -4;
      const focusZ = this.militaryFocus ? this.militaryFocus.z : this.frontLineZ;
      const desiredYaw = Math.atan2(focusX - person.position.x, focusZ - person.position.z);
      const yawDelta = Math.atan2(
        Math.sin(desiredYaw - person.rotation.y),
        Math.cos(desiredYaw - person.rotation.y)
      );
      person.rotation.y += yawDelta * 0.16;

      const assignedMilitary = this.militaryMembers.length > 0
        ? this.militaryMembers[(data.targetMilitaryIndex || idx) % this.militaryMembers.length]
        : null;
      const closestMilitary = assignedMilitary || this.findClosestTarget(person, this.militaryMembers);
      const dxToMilitary = closestMilitary ? (closestMilitary.position.x - person.position.x) : 0;
      const dzToMilitary = closestMilitary ? (closestMilitary.position.z - person.position.z) : 0;
      const distToMilitary = closestMilitary ? Math.sqrt(dxToMilitary * dxToMilitary + dzToMilitary * dzToMilitary) : Infinity;
      const reactionMoveScale = crowdReactActive ? 0.14 : 1;
      const movementRole = data.movementRole || 'hold';
      const FRONT_LINE_Z = this.militaryFocus ? this.militaryFocus.z : this.frontLineZ;
      if (!Number.isFinite(data.stateTimer)) {
        data.stateTimer = 0;
      }
      if (data.stateTimer > 0) {
        data.stateTimer = Math.max(0, data.stateTimer - deltaTime);
      }
      if (!data.state) {
        data.state = 'approaching';
      }

      let stateChangedThisFrame = false;
      const setState = (nextState, nextTimer = 0) => {
        if (stateChangedThisFrame || data.stateTimer > 0 || data.state === nextState) {
          return;
        }
        data.state = nextState;
        data.stateTimer = nextTimer;
        stateChangedThisFrame = true;
      };

      const toMilitaryX = distToMilitary > 1e-5 ? dxToMilitary / distToMilitary : 0;
      const toMilitaryZ = distToMilitary > 1e-5 ? dzToMilitary / distToMilitary : 0;
      const towardFront = FRONT_LINE_Z >= person.position.z ? 1 : -1;
      const reachedFrontLine = towardFront > 0
        ? person.position.z >= FRONT_LINE_Z - 1
        : person.position.z <= FRONT_LINE_Z + 1;

      if (data.state === 'approaching') {
        const roleBoost = movementRole === 'advance-stick' ? 1 : 0.45;
        const forwardForce = 0.012 * roleBoost * reactionMoveScale * (flashActive ? 0.5 : 1) * (this.isEscalating ? 0.72 : 1);
        if (distToMilitary < Infinity && distToMilitary > 1e-5) {
          addMove(toMilitaryX * forwardForce, toMilitaryZ * forwardForce, 1);
        } else {
          addMove(0, towardFront * forwardForce, 1);
        }

        if (reachedFrontLine) {
          setState('holding', movementRole === 'advance-stick' ? 1.1 : 1.8);
        }
      } else if (data.state === 'holding') {
        const idleScale = movementRole === 'hold' ? 0.25 : 1;
        const idleX = (data.baseX || person.position.x) + Math.sin(time * 0.72 + (data.roamPhase || 0)) * (0.28 * idleScale);
        const idleZ = (data.baseZ || person.position.z) + Math.cos(time * 0.7 + (data.roamPhase || 0)) * (0.16 * idleScale);
        addMove((idleX - person.position.x) * 0.006, (idleZ - person.position.z) * 0.006, 1);

        if (data.stateTimer <= 0) {
          if (movementRole === 'retreat') {
            setState('retreating', 1.8 + Math.random() * 1.1);
          } else if (movementRole === 'advance-stick' && flashActive && Math.random() < 0.2) {
            setState('retreating', 1.3 + Math.random() * 0.9);
          }
        }
      } else if (data.state === 'retreating') {
        const retreatForce = (movementRole === 'retreat' ? 0.016 : 0.012) * (flashActive ? 1.16 : 1);
        const sideSign = Math.sin((data.offset || 0) + idx * 0.67) >= 0 ? 1 : -1;
        addMove(-toMilitaryX * retreatForce, -toMilitaryZ * retreatForce, 1);
        addMove(sideSign * retreatForce * 0.6, 0, 1);

        if (data.stateTimer <= 0) {
          setState('holding', movementRole === 'retreat' ? 0.8 : 0.4);
        }
      } else {
        data.state = 'approaching';
        data.stateTimer = 0;
      }

      if (data.state === 'holding') {
        person.position.y = (data.baseY || 0) + bob * 0.25;
      } else if (data.state === 'retreating') {
        person.position.y = (data.baseY || 0) + bob * 0.45;
      } else {
        person.position.y = (data.baseY || 0) + bob * 0.4;
      }

      const protestTargetX = this.crowdCenter ? this.crowdCenter.x : -4;
      const protestTargetZ = this.frontLineZ - 0.9;
      const neighborRadius = 3.7;
      const neighborRadiusSq = neighborRadius * neighborRadius;
      let neighborCount = 0;
      let avgPosX = 0;
      let avgPosZ = 0;
      let avgVelX = 0;
      let avgVelZ = 0;
      for (let i = 0; i < this.people.length; i += 1) {
        const other = this.people[i];
        if (!other || other === person) {
          continue;
        }

        const dx = other.position.x - person.position.x;
        const dz = other.position.z - person.position.z;
        const distSq = dx * dx + dz * dz;
        if (distSq > neighborRadiusSq || distSq < 1e-6) {
          continue;
        }

        neighborCount += 1;
        avgPosX += other.position.x;
        avgPosZ += other.position.z;
        const otherVelocity = this.ensureVelocity(other);
        if (otherVelocity) {
          avgVelX += otherVelocity.x;
          avgVelZ += otherVelocity.z;
        }
      }

      if (neighborCount > 0) {
        avgPosX /= neighborCount;
        avgPosZ /= neighborCount;
        avgVelX /= neighborCount;
        avgVelZ /= neighborCount;
        const cohesionStrength = data.state === 'retreating' ? 0.0022 : 0.0048;
        const alignmentStrength = data.state === 'retreating' ? 0.009 : 0.018;
        addMove((avgPosX - person.position.x) * cohesionStrength, (avgPosZ - person.position.z) * cohesionStrength, 1);
        addMove(
          (avgVelX - (velocity ? velocity.x : 0)) * alignmentStrength,
          (avgVelZ - (velocity ? velocity.z : 0)) * alignmentStrength,
          1
        );
      }

      if (data.state !== 'retreating' && movementRole !== 'hold') {
        const tx = protestTargetX - person.position.x;
        const tz = protestTargetZ - person.position.z;
        const targetDist = Math.hypot(tx, tz);
        if (targetDist > 1e-5) {
          const targetStrength = movementRole === 'advance-stick'
            ? (data.state === 'holding' ? 0.0012 : 0.0038)
            : (data.state === 'holding' ? 0.0006 : 0.0014);
          addMove((tx / targetDist) * targetStrength, (tz / targetDist) * targetStrength, 1);
        }
      }

      const containCenterX = this.crowdCenter ? this.crowdCenter.x : -4;
      const containCenterZ = this.frontLineZ - 0.9;
      const containRadius = Number.isFinite(this.crowdContainmentRadius) ? this.crowdContainmentRadius : 7.5;
      const fromContainX = person.position.x - containCenterX;
      const fromContainZ = person.position.z - containCenterZ;
      const containDist = Math.sqrt(fromContainX * fromContainX + fromContainZ * fromContainZ);
      if (containDist > containRadius) {
        const inwardX = -fromContainX / Math.max(1e-6, containDist);
        const inwardZ = -fromContainZ / Math.max(1e-6, containDist);
        const overflow = containDist - containRadius;
        const containPull = Math.min(0.06, 0.012 + overflow * 0.01);
        addMove(inwardX * containPull, inwardZ * containPull, 1);
      }

      person.rotation.x += ((data.baseRotX || 0) - person.rotation.x) * 0.08;
      if (data.head) {
        data.head.rotation.y = Math.sin(time * 0.6 + (data.offset || 0)) * 0.2;
      }

      this.applySeparation(person, this.people, 1.18, 3.5, deltaTime, moveForce);
      this.applySeparation(person, this.militaryMembers, 1.05, 3.2, deltaTime, moveForce);

      if (velocity) {
        for (let i = 0; i < this.people.length; i += 1) {
          const other = this.people[i];
          if (!other || other === person) {
            continue;
          }

          let dx = person.position.x - other.position.x;
          let dz = person.position.z - other.position.z;
          const distance = Math.sqrt(dx * dx + dz * dz);
          if (distance <= 1e-6 || distance > 1.2) {
            continue;
          }

          dx /= distance;
          dz /= distance;
          const strength = (1.2 - distance) * 0.02;
          velocity.x += dx * strength;
          velocity.z += dz * strength;
        }
      }

      if (closestMilitary && distToMilitary < 0.9) {
        const invDist = 1 / Math.max(0.001, distToMilitary);
        addMove(
          -dxToMilitary * invDist * deltaTime * 2.2,
          -dzToMilitary * invDist * deltaTime * 2.2
        );
      }

      this.integrateVelocity(person, moveForce, 0.9, 0.052);
      if (movementRole === 'hold' && data.state === 'holding' && velocity) {
        velocity.multiplyScalar(0.86);
      }
      this.keepInsideTerrain(person, 3.5);
      this.keepWithinCrowdRadius(person, containCenterX, containCenterZ, containRadius + 0.8);

      if (data.banner) {
        data.banner.rotation.z = Math.sin(time * 1.1 + (data.bannerOffset || 0)) * 0.08;
      }

      const walkCycle = Math.sin(time * 4.2 + (data.offset || 0));
      const moveDistance = Math.hypot(person.position.x - prevX, person.position.z - prevZ);
      const moveStrength = deltaTime > 0 ? clamp(moveDistance / (deltaTime * 1.0), 0, 1) : 0;
      const moving = moveStrength > 0.12;
      const legSwing = moving ? walkCycle * (0.18 + moveStrength * 0.32) : 0;
      const armSwing = moving ? -walkCycle * (0.12 + moveStrength * 0.2) : 0;
      if (data.leftLeg) data.leftLeg.rotation.x = legSwing;
      if (data.rightLeg) data.rightLeg.rotation.x = -legSwing;
      if (data.leftKnee) data.leftKnee.rotation.x = Math.max(0, -legSwing * 0.45);
      if (data.rightKnee) data.rightKnee.rotation.x = Math.max(0, legSwing * 0.45);
      if (data.leftArm) data.leftArm.rotation.x = armSwing;
      if (data.rightArm) data.rightArm.rotation.x = -armSwing;
      if (data.leftElbow) data.leftElbow.rotation.x = Math.max(0, -armSwing * 0.25);
      if (data.rightElbow) data.rightElbow.rotation.x = Math.max(0, armSwing * 0.25);

      if (data.type === 'hands_up' || data.type === 'listening') {
        const raiseWave = Math.sin(time * 2.3 + (data.offset || 0)) * 0.12;
        if (data.leftArm) {
          data.leftArm.rotation.x = -1.32 + raiseWave;
          data.leftArm.rotation.z = 0.16;
        }
        if (data.rightArm) {
          data.rightArm.rotation.x = -1.32 - raiseWave;
          data.rightArm.rotation.z = -0.16;
        }
        if (data.leftElbow) data.leftElbow.rotation.x = 0.36 + Math.abs(raiseWave) * 0.5;
        if (data.rightElbow) data.rightElbow.rotation.x = 0.36 + Math.abs(raiseWave) * 0.5;
      }

      if (crowdReactActive) {
        const flinchWave = Math.sin(time * 42 + (data.offset || 0)) * 0.05;
        person.rotation.x += ((-0.24 + flinchWave) - person.rotation.x) * 0.32;
        if (data.leftArm) {
          data.leftArm.rotation.x = -0.55 + flinchWave;
          data.leftArm.rotation.z = 0.22;
        }
        if (data.rightArm) {
          data.rightArm.rotation.x = -0.55 - flinchWave;
          data.rightArm.rotation.z = -0.22;
        }
      }

      if (movementRole === 'advance-stick') {
        if (data.rightArm) {
          data.rightArm.rotation.x = -1.45;
          data.rightArm.rotation.z = -0.24;
        }
        if (data.rightElbow) data.rightElbow.rotation.x = 0.22;
        if (data.leftArm) {
          data.leftArm.rotation.x = -0.22 + Math.sin(time * 2.4 + (data.offset || 0)) * 0.08;
          data.leftArm.rotation.z = 0.08;
        }
      } else if (movementRole === 'raise-hands') {
        const raiseWave = Math.sin(time * 2.1 + (data.offset || 0)) * 0.08;
        if (data.leftArm) {
          data.leftArm.rotation.x = -1.38 + raiseWave;
          data.leftArm.rotation.z = 0.2;
        }
        if (data.rightArm) {
          data.rightArm.rotation.x = -1.38 - raiseWave;
          data.rightArm.rotation.z = -0.2;
        }
        if (data.leftElbow) data.leftElbow.rotation.x = 0.54 + Math.abs(raiseWave) * 0.4;
        if (data.rightElbow) data.rightElbow.rotation.x = 0.54 + Math.abs(raiseWave) * 0.4;
      }

      // Everyone keeps some visible hand/arm motion, even when mostly stationary.
      if (!crowdReactActive) {
        const armIdle = Math.sin(time * 2.5 + (data.offset || 0)) * 0.05;
        const elbowIdle = Math.sin(time * 3.0 + (data.offset || 0) + 0.6) * 0.04;
        if (movementRole === 'hold' || movementRole === 'retreat') {
          if (data.leftArm) data.leftArm.rotation.x += armIdle;
          if (data.rightArm) data.rightArm.rotation.x -= armIdle;
          if (data.leftElbow) data.leftElbow.rotation.x = Math.max(0, data.leftElbow.rotation.x + elbowIdle);
          if (data.rightElbow) data.rightElbow.rotation.x = Math.max(0, data.rightElbow.rotation.x - elbowIdle);
        }
      }

      if (moving) {
        const stepBounce = Math.abs(walkCycle) * 0.03;
        person.position.y -= stepBounce;
      }
    });

    if (Array.isArray(this.sharedBanners)) {
      this.sharedBanners.forEach((entry) => {
        const {
          mesh,
          board,
          carrier,
          offset,
          swaySpeed,
          swayAmount,
          handLocal,
          chestLift,
          forwardPush
        } = entry;
        if (!mesh || !carrier) {
          return;
        }

        const handWorld = carrier.localToWorld((handLocal || new THREE.Vector3(-0.24, 1.22, 0.18)).clone());
        const carrierForward = new THREE.Vector3(0, 0, 1).applyQuaternion(carrier.quaternion);
        handWorld.add(carrierForward.multiplyScalar(forwardPush || 0));
        handWorld.y += chestLift || 0;

        mesh.position.copy(handWorld);
        mesh.rotation.y = carrier.rotation.y;
        mesh.rotation.z = Math.sin(time * swaySpeed + offset) * swayAmount;

        if (camera && board?.material) {
          const cameraDistance = mesh.position.distanceTo(camera.position);
          const hideDistance = 5;
          const fadeDistance = 11;
          const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
          const toPoster = mesh.position.clone().sub(camera.position);
          const toPosterLen = Math.max(1e-4, toPoster.length());
          toPoster.multiplyScalar(1 / toPosterLen);
          const inView = camForward.dot(toPoster) > 0.14;
          const fade = clamp((cameraDistance - hideDistance) / (fadeDistance - hideDistance), 0, 1);

          board.material.opacity = fade;
          mesh.visible = inView && fade > 0.02;
        }
      });
    }

    if (this.leaderMesh) {
      const leaderData = this.leaderMesh.userData || {};
      const leaderHovered = hoveredDialogueTarget === this.leaderMesh;
      const leaderPulse = 1.2 + Math.sin(time * 2.3 + (leaderData.offset || 0)) * 0.018;
      const leaderTargetScale = leaderHovered ? 1.3 : leaderPulse;
      const nextLeaderScale = this.leaderMesh.scale.x + (leaderTargetScale - this.leaderMesh.scale.x) * 0.2;
      this.leaderMesh.scale.setScalar(nextLeaderScale);
      if (leaderData.platformAnchor) {
        const anchor = leaderData.platformAnchor;
        this.leaderMesh.position.x += (anchor.x - this.leaderMesh.position.x) * 0.28;
        this.leaderMesh.position.z += (anchor.z - this.leaderMesh.position.z) * 0.28;
        this.leaderMesh.position.y = anchor.y + Math.sin(time * 1.7 + (leaderData.offset || 0)) * 0.015;
        const leaderVelocity = this.ensureVelocity(this.leaderMesh);
        if (leaderVelocity) {
          leaderVelocity.set(0, 0, 0);
        }
        if (camera) {
          const faceYaw = Math.atan2(camera.position.x - this.leaderMesh.position.x, camera.position.z - this.leaderMesh.position.z);
          const yawDelta = Math.atan2(
            Math.sin(faceYaw - this.leaderMesh.rotation.y),
            Math.cos(faceYaw - this.leaderMesh.rotation.y)
          );
          this.leaderMesh.rotation.y += yawDelta * 0.22;
        }
      } else {
        const leaderWanderX = (this.crowdCenter ? this.crowdCenter.x : this.leaderMesh.position.x) + Math.sin(time * 0.55 + (leaderData.offset || 0)) * 2.3;
        const leaderWanderZ = (this.crowdCenter ? this.crowdCenter.y : this.leaderMesh.position.z) + 1.8 + Math.cos(time * 0.52 + (leaderData.offset || 0)) * 1.1;
        const leaderForce = new THREE.Vector3(0, 0, 0);
        const leaderBlend = Math.min(1, deltaTime * 1.3);
        leaderForce.x += (leaderWanderX - this.leaderMesh.position.x) * leaderBlend * 0.35;
        leaderForce.z += (leaderWanderZ - this.leaderMesh.position.z) * leaderBlend * 0.35;
        this.integrateVelocity(this.leaderMesh, leaderForce, 0.9, 0.09);
        this.keepInsideTerrain(this.leaderMesh, 4.5);
      }
      this.leaderMesh.rotation.x += ((leaderData.baseRotX || -0.08) - this.leaderMesh.rotation.x) * 0.08;
      if (leaderData.head) {
        leaderData.head.rotation.y = Math.sin(time * 0.9 + (leaderData.offset || 0)) * 0.35;
      }
    }

    if (this.militaryGroup) {
      const crowdFocusX = this.crowdCenter ? this.crowdCenter.x : -5;
      const crowdFocusZ = this.frontLineZ + 0.6;

      this.militaryMembers.forEach((soldier, idx) => {
        const sData = soldier.userData || {};
        const prevX = soldier.position.x;
        const prevZ = soldier.position.z;
        const soldierForce = new THREE.Vector3(0, 0, 0);
        const linkedCrowd = this.people.length > 0
          ? this.people[(idx * 3) % this.people.length]
          : null;

        const targetXRaw = linkedCrowd
          ? linkedCrowd.position.x
          : (sData.baseX || soldier.position.x) + Math.sin(time * 0.45 + (sData.patrolPhase || 0)) * (sData.patrolRadius || 1.2);
        const desiredX = clamp(targetXRaw, crowdFocusX - 10, crowdFocusX + 10);
        const engageBaseZ = this.frontLineZ - 2.8 + Math.cos(time * 0.5 + idx * 0.28) * 0.4;
        const pulse = Math.sin(time * 0.85 + idx * 0.42) * 0.24;
        const pressure = (flashActive ? 0.24 : 0) + (this.isEscalating ? 0.18 : 0);
        const targetCrowdZ = linkedCrowd ? linkedCrowd.position.z : (this.frontLineZ + 0.9);
        const desiredZ = clamp(Math.min(engageBaseZ + pulse + pressure, targetCrowdZ - 0.7), this.frontLineZ - 6, this.frontLineZ + 4);

        soldierForce.x += (desiredX - soldier.position.x) * Math.min(1, deltaTime * 1.9) * 0.35;
        soldierForce.z += (desiredZ - soldier.position.z) * Math.min(1, deltaTime * 1.7) * 0.35;

        this.applySeparation(soldier, this.militaryMembers, 0.92, 2.7, deltaTime, soldierForce);
        this.applySeparation(soldier, this.people, 1.05, 3.0, deltaTime, soldierForce);
        this.integrateVelocity(soldier, soldierForce, 0.9, 0.1);
        this.keepInsideTerrain(soldier, 3.2);

        const desiredYaw = Math.atan2(crowdFocusX - soldier.position.x, crowdFocusZ - soldier.position.z);
        const yawDelta = Math.atan2(
          Math.sin(desiredYaw - soldier.rotation.y),
          Math.cos(desiredYaw - soldier.rotation.y)
        );
        soldier.rotation.y += yawDelta * 0.18;
        soldier.rotation.x += (-0.08 - soldier.rotation.x) * 0.12;

        if (sData.rifle) {
          const aimTarget = linkedCrowd
            ? linkedCrowd.position.clone()
            : new THREE.Vector3(crowdFocusX, 1.2, crowdFocusZ);
          aimTarget.y = 1.2;
          const localAimTarget = soldier.worldToLocal(aimTarget.clone());
          sData.rifle.lookAt(localAimTarget);
        }

        if (sData.muzzleFlash && sData.muzzleLight && sData.rifle) {
          const muzzleTip = sData.rifle.localToWorld(new THREE.Vector3(0, 0, 0.53));
          sData.muzzleFlash.position.copy(muzzleTip);
          sData.muzzleLight.position.copy(muzzleTip);

          const firing = time < (sData.shotUntil || -1);
          if (firing) {
            const pulseOn = Math.sin(time * (95 + idx * 3)) > -0.18;
            sData.muzzleFlash.visible = pulseOn;
            sData.muzzleLight.visible = pulseOn;
            if (pulseOn) {
              sData.muzzleFlash.material.opacity = 0.72 + Math.random() * 0.22;
              sData.muzzleLight.intensity = 2.4 + Math.random() * 2.2;
            } else {
              sData.muzzleFlash.material.opacity = 0;
              sData.muzzleLight.intensity = 0;
            }
          } else {
            sData.muzzleFlash.visible = false;
            sData.muzzleFlash.material.opacity = 0;
            sData.muzzleLight.visible = false;
            sData.muzzleLight.intensity = 0;
          }
        }

        const moveAmount = Math.hypot(soldier.position.x - prevX, soldier.position.z - prevZ);
        const movePower = deltaTime > 0 ? clamp(moveAmount / (deltaTime * 0.7), 0, 1) : 0;
        const march = Math.sin(time * 5.0 + (sData.stepOffset || 0));
        const legSwing = march * (0.1 + movePower * 0.2);

        if (sData.leftLeg) sData.leftLeg.rotation.x = legSwing;
        if (sData.rightLeg) sData.rightLeg.rotation.x = -legSwing;
        if (sData.leftKnee) sData.leftKnee.rotation.x = Math.max(0, -legSwing * 0.35);
        if (sData.rightKnee) sData.rightKnee.rotation.x = Math.max(0, legSwing * 0.35);
        if (sData.leftArm) sData.leftArm.rotation.x = -0.08 - march * 0.06;
        if (sData.rightArm) sData.rightArm.rotation.x = -0.08 + march * 0.06;

        soldier.position.y = Math.sin(time * 3.2 + idx * 0.7) * 0.01;
      });
    }
  }
}

function buildScene2Environment() {
  const root = new THREE.Group();
  const crowdCenter = new THREE.Vector2(-5, -8);

  const wetPatchSeeds = [
    [-30, -33, 1.6],
    [-8, -36, 1.2],
    [14, -34, 1.4],
    [30, -37, 1.3]
  ];
  const terrainBaseY = 0.04;

  const pseudoNoise = (x, z) => {
    const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return (v - Math.floor(v)) - 0.5;
  };

  const getTerrainOffset = (x, z) => {
    const rollingNoise = Math.sin(x * 0.16) * 0.016 + Math.cos(z * 0.13) * 0.014;
    const crossNoise = Math.sin((x + z) * 0.07) * 0.01;
    const microNoise = pseudoNoise(x * 0.4, z * 0.4) * 0.012;
    let depression = 0;

    wetPatchSeeds.forEach(([sx, sz, r]) => {
      const dx = x - sx;
      const dz = z - sz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const influenceRadius = r * 3.2;
      if (dist < influenceRadius) {
        const t = 1 - (dist / influenceRadius);
        depression -= t * t * 0.055;
      }
    });

    return rollingNoise + crossNoise + microNoise + depression;
  };
  const terrainYAt = (x, z) => terrainBaseY + getTerrainOffset(x, z);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100, 64, 64),
    new THREE.MeshStandardMaterial({
      color: 0x69705c,
      roughness: 0.9,
      metalness: 0.05
    })
  );
  const groundPos = ground.geometry.attributes.position;
  for (let i = 0; i < groundPos.count; i += 1) {
    const x = groundPos.getX(i);
    const z = groundPos.getY(i);
    groundPos.setZ(i, getTerrainOffset(x, z));
  }
  groundPos.needsUpdate = true;
  ground.geometry.computeVertexNormals();
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, terrainBaseY, 0);
  ground.receiveShadow = true;
  root.add(ground);

  const grassClusters = new THREE.Group();
  const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x58674b, roughness: 0.92, metalness: 0.01 });
  const grassBladeGeometry = new THREE.CylinderGeometry(0.01, 0.016, 0.34, 5);
  const grassPatchCount = 88;
  for (let c = 0; c < grassPatchCount; c += 1) {
    const angle = Math.random() * Math.PI * 2;
    // Dense ring around crowd edge with lighter falloff farther away.
    const edgeBias = Math.random() < 0.72;
    const radius = edgeBias
      ? 8 + Math.random() * 13
      : 22 + Math.random() * 18;
    const cx = crowdCenter.x + Math.cos(angle) * radius;
    const cz = crowdCenter.y + Math.sin(angle) * radius;
    const dist = Math.sqrt((cx - crowdCenter.x) * (cx - crowdCenter.x) + (cz - crowdCenter.y) * (cz - crowdCenter.y));
    const edgeDensity = Math.max(0, 1 - Math.abs(dist - 14) / 12);
    const farFalloff = Math.max(0.25, 1 - dist / 42);
    const density = edgeDensity * 0.75 + farFalloff * 0.5;
    const bladeCount = 4 + Math.floor(10 * density);

    for (let i = 0; i < bladeCount; i += 1) {
      const blade = new THREE.Mesh(grassBladeGeometry, grassMaterial);
      const ox = (Math.random() - 0.5) * (0.5 + (1 - density) * 0.45);
      const oz = (Math.random() - 0.5) * (0.5 + (1 - density) * 0.45);
      const px = cx + ox;
      const pz = cz + oz;
      const bladeHeight = 0.26 + Math.random() * 0.26;
      blade.scale.y = bladeHeight / 0.34;
      blade.position.set(px, terrainYAt(px, pz) + bladeHeight * 0.5, pz);
      blade.rotation.z = (Math.random() - 0.5) * 0.35;
      blade.rotation.x = (Math.random() - 0.5) * 0.12;
      grassClusters.add(blade);
    }
  }
  root.add(grassClusters);

  const trees = new THREE.Group();
  const treeTrunkGeometry = new THREE.CylinderGeometry(0.14, 0.18, 1.85, 6);
  const treeCanopyGeometry = new THREE.SphereGeometry(0.72, 8, 8);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4634, roughness: 0.9, metalness: 0.02 });
  const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0x4d6444, roughness: 0.9, metalness: 0.01 });
  const treeCount = 5 + Math.floor(Math.random() * 6);
  for (let t = 0; t < treeCount; t += 1) {
    // Keep trees in the far background to avoid crowd obstruction.
    const tx = -42 + Math.random() * 84;
    const tz = -48 + Math.random() * 12;
    const ty = terrainYAt(tx, tz);

    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(treeTrunkGeometry, trunkMaterial);
    trunk.position.y = ty + 0.92;
    tree.add(trunk);

    const canopy = new THREE.Mesh(treeCanopyGeometry, canopyMaterial);
    canopy.position.y = ty + 2.05;
    canopy.scale.set(1 + Math.random() * 0.25, 0.9 + Math.random() * 0.2, 1 + Math.random() * 0.25);
    tree.add(canopy);
    trees.add(tree);
  }
  root.add(trees);

  const waterPatches = new THREE.Group();
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x5f87a1,
    roughness: 0.5,
    metalness: 0.08,
    transparent: true,
    opacity: 0.5
  });
  const puddleAnchors = [];
  const puddleCount = 24;
  let createdPuddles = 0;
  let attempts = 0;
  while (createdPuddles < puddleCount && attempts < 260) {
    attempts += 1;
    const x = -45 + Math.random() * 90;
    const z = -45 + Math.random() * 90;
    const terrainOffset = getTerrainOffset(x, z);

    // Keep puddles in naturally lower pockets so the scene reads as marshy land.
    if (terrainOffset > -0.004) {
      continue;
    }

    const radius = 1 + Math.random() * 3;
    const patchGeom = new THREE.CircleGeometry(radius, 20);
    const patchPos = patchGeom.attributes.position;
    for (let i = 0; i < patchPos.count; i += 1) {
      const px = patchPos.getX(i);
      const py = patchPos.getY(i);
      const radial = Math.min(1, Math.sqrt(px * px + py * py) / radius);
      const bowl = -0.008 * (1 - radial * radial);
      patchPos.setZ(i, bowl);
    }
    patchPos.needsUpdate = true;
    patchGeom.computeVertexNormals();

    const patch = new THREE.Mesh(patchGeom, waterMaterial);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(x, terrainYAt(x, z) + 0.05, z);
    waterPatches.add(patch);
    puddleAnchors.push({ x, z, radius });
    createdPuddles += 1;
  }
  root.add(waterPatches);

  const reeds = new THREE.Group();
  const reedMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a6a4d,
    roughness: 0.9,
    metalness: 0.02
  });
  puddleAnchors.forEach((anchor, idx) => {
    const reedCount = 5 + ((idx * 7) % 7);
    for (let i = 0; i < reedCount; i += 1) {
      const angle = (i / reedCount) * Math.PI * 2 + Math.random() * 0.5;
      const spread = anchor.radius * (0.85 + Math.random() * 0.45);
      const rx = anchor.x + Math.cos(angle) * spread;
      const rz = anchor.z + Math.sin(angle) * spread;
      const reedHeight = 0.9 + Math.random() * 1.1;
      const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, reedHeight, 5), reedMaterial);
      reed.position.set(rx, terrainYAt(rx, rz) + reedHeight * 0.5, rz);
      reed.rotation.z = (Math.random() - 0.5) * 0.2;
      reed.castShadow = false;
      reed.receiveShadow = false;
      reeds.add(reed);
    }
  });
  root.add(reeds);

  const houses = new THREE.Group();
  const houseCount = 6;
  for (let i = 0; i < houseCount; i += 1) {
    const home = createCircularHut({
      wallColor: i % 2 === 0 ? 0xa88f66 : 0x9f865f,
      roofColor: i % 3 === 0 ? 0x7d5735 : 0x8a633d,
      accentColor: i % 2 === 0 ? 0x4f4337 : 0x655041,
      wallRadius: 1.5 + (i % 2) * 0.16,
      wallHeight: 1.85 + (i % 2) * 0.1,
      roofHeight: 2.0 + (i % 3) * 0.08,
      fenceCount: 6 + (i % 3)
    });

    const angle = i < 4
      ? (-Math.PI * 0.78 + i * 0.24)
      : (-Math.PI * 0.2 + (i - 4) * 0.5);
    const radius = i < 4 ? (18 + i * 2.4) : (30 + i * 2.5);
    const hx = crowdCenter.x + Math.cos(angle) * radius;
    const hz = crowdCenter.y + Math.sin(angle) * radius;
    const hy = terrainYAt(hx, hz);
    home.position.set(hx, hy, hz);
    home.rotation.y = Math.atan2(crowdCenter.x - hx, crowdCenter.y - hz);
    home.scale.setScalar(0.58 + Math.random() * 0.12);
    houses.add(home);
  }
  root.add(houses);

  const speakerPlatform = new THREE.Group();
  const platformX = crowdCenter.x + 1.3;
  const platformZ = crowdCenter.y + 3.2;
  const platformY = terrainYAt(platformX, platformZ);
  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x6a503b, roughness: 0.9, metalness: 0.03 });
  const platformTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 1.4), woodMaterial);
  platformTop.position.set(platformX, platformY + 0.28, platformZ);
  speakerPlatform.add(platformTop);

  const legOffsets = [
    [-0.92, -0.55],
    [0.92, -0.55],
    [-0.92, 0.55],
    [0.92, 0.55]
  ];
  legOffsets.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 5), woodMaterial);
    leg.position.set(platformX + lx, platformY + 0.06, platformZ + lz);
    speakerPlatform.add(leg);
  });
  root.add(speakerPlatform);

  const referenceLine = new THREE.Mesh(
    new THREE.PlaneGeometry(82, 0.42),
    new THREE.MeshBasicMaterial({
      color: 0xe8ddb4,
      transparent: true,
      opacity: 0.2,
      depthWrite: false
    })
  );
  referenceLine.rotation.x = -Math.PI / 2;
  referenceLine.position.set(0, terrainYAt(0, -4) + 0.02, -4);
  root.add(referenceLine);

  const sun = new THREE.DirectionalLight(0xd8bf97, 0.66);
  sun.position.set(24, 34, 18);
  root.add(sun);

  const fill = new THREE.AmbientLight(0x8f7d67, 0.3);
  root.add(fill);

  const crowdManager = new CrowdManager(root);
  const leaderAnchor = new THREE.Vector3(platformX, platformY + 0.36, platformZ);
  crowdManager.createCrowd(34, new THREE.Vector3(-5, 0, -8), 5, 8, leaderAnchor);
  crowdManager.bindEscalationLighting(sun, fill);

  return {
    root,
    sun,
    fill,
    crowdManager,
    previousFog: scene.fog
  };
}

function applyScene2Environment() {
  scene2Runtime = buildScene2Environment();
  scene.add(scene2Runtime.root);
  // Dusty near-ground atmosphere with slightly stronger fade in the distance.
  scene.fog = new THREE.Fog(0x9f9385, 8, 54);
}

function getFourStateBlend(progress) {
  const clamped = clamp(progress, 0, 1);
  const scaled = clamped * 3;
  const index = Math.min(2, Math.floor(scaled));
  return {
    index,
    nextIndex: index + 1,
    t: scaled - index
  };
}

function createWetlandFish(config = {}) {
  const fish = new THREE.Group();
  const bodyColor = config.bodyColor || 0xa19b93;
  const backColor = config.backColor || 0x7d766c;
  const bellyColor = config.bellyColor || 0xb9b3aa;
  const finColor = config.finColor || 0x9f988f;

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.12, 0.46, 4, 8),
    new THREE.MeshBasicMaterial({ color: bodyColor })
  );
  body.rotation.z = Math.PI / 2;
  fish.add(body);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.035, 0.4),
    new THREE.MeshBasicMaterial({ color: backColor })
  );
  back.position.set(0.01, 0.07, 0);
  back.rotation.z = Math.PI / 2;
  fish.add(back);

  const belly = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.03, 0.28),
    new THREE.MeshBasicMaterial({ color: bellyColor })
  );
  belly.position.set(-0.03, -0.07, 0);
  fish.add(belly);

  const tail = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshBasicMaterial({ color: finColor, side: THREE.DoubleSide })
  );
  tail.position.set(-0.31, 0, 0);
  tail.rotation.y = Math.PI / 2;
  tail.rotation.z = Math.PI / 2;
  fish.add(tail);

  const dorsal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.07, 0.12),
    new THREE.MeshBasicMaterial({ color: backColor, side: THREE.DoubleSide })
  );
  dorsal.position.set(0.04, 0.09, 0);
  dorsal.rotation.x = -Math.PI / 2;
  dorsal.rotation.z = -0.08;
  fish.add(dorsal);

  const pectoralLeft = new THREE.Mesh(
    new THREE.PlaneGeometry(0.05, 0.08),
    new THREE.MeshBasicMaterial({ color: finColor, side: THREE.DoubleSide })
  );
  pectoralLeft.position.set(0.02, -0.01, 0.09);
  pectoralLeft.rotation.x = -Math.PI / 2;
  pectoralLeft.rotation.z = 0.45;
  fish.add(pectoralLeft);

  const pectoralRight = new THREE.Mesh(
    new THREE.PlaneGeometry(0.05, 0.08),
    new THREE.MeshBasicMaterial({ color: finColor, side: THREE.DoubleSide })
  );
  pectoralRight.position.set(0.02, -0.01, -0.09);
  pectoralRight.rotation.x = -Math.PI / 2;
  pectoralRight.rotation.z = -0.45;
  fish.add(pectoralRight);

  const fadedStripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.02, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x8f887f })
  );
  fadedStripe.position.set(0.01, 0.01, 0);
  fish.add(fadedStripe);

  fish.userData.baseOrientation = config.baseOrientation || new THREE.Euler(0, 0, 0);
  fish.userData.twitchSeed = Math.random() * Math.PI * 2;
  fish.userData.basePosition = config.basePosition ? config.basePosition.clone() : new THREE.Vector3();
  fish.userData.baseRotX = 0;
  fish.userData.baseRotZ = 0;
  return fish;
}

function buildScene4System() {
  const root = new THREE.Group();

  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100, 64, 64),
    new THREE.MeshStandardMaterial({
      color: 0x8b7d3c,
      roughness: 0.95,
      metalness: 0.02
    })
  );
  const terrainPos = terrain.geometry.attributes.position;
  for (let i = 0; i < terrainPos.count; i += 1) {
    const x = terrainPos.getX(i);
    const z = terrainPos.getY(i);
    const radial = Math.min(1, Math.hypot(x, z) / 50);
    const humps = Math.sin(x * 0.12) * 0.25 + Math.cos(z * 0.1) * 0.2;
    const edgeLift = radial * radial * 0.65;
    terrainPos.setZ(i, -0.25 + humps + edgeLift);
  }
  terrainPos.needsUpdate = true;
  terrain.geometry.computeVertexNormals();
  terrain.rotation.x = -Math.PI / 2;
  terrain.receiveShadow = true;
  root.add(terrain);

  const terrainYAt = (x, z) => {
    const radial = Math.min(1, Math.hypot(x, z) / 50);
    const humps = Math.sin(x * 0.12) * 0.25 + Math.cos(z * 0.1) * 0.2;
    const edgeLift = radial * radial * 0.65;
    return -0.25 + humps + edgeLift;
  };

  const poolSeeds = [
    [-15, -18, 2.6],
    [5, -15, 2.2],
    [18, -9, 1.9],
    [-28, 8, 2.4],
    [12, 18, 2.8],
    [26, -18, 1.8],
    [-6, 10, 1.7]
  ];

  const vegetationStateDefs = [
    {
      grassColor: 0x5f8c3d,
      density: 1,
      grassHeight: 1,
      grassLean: 0.1,
      soilColor: 0x7d703f,
      moistOpacity: 0.24,
      bareOpacity: 0.08,
      cropHeight: 1,
      cropLean: 0.08,
      cropPresence: 1
    },
    {
      grassColor: 0x7a7d40,
      density: 0.7,
      grassHeight: 0.88,
      grassLean: 0.2,
      soilColor: 0x8a7b4f,
      moistOpacity: 0.13,
      bareOpacity: 0.28,
      cropHeight: 0.82,
      cropLean: 0.2,
      cropPresence: 0.92
    },
    {
      grassColor: 0x8d7f58,
      density: 0.38,
      grassHeight: 0.62,
      grassLean: 0.38,
      soilColor: 0x9b8a64,
      moistOpacity: 0.04,
      bareOpacity: 0.58,
      cropHeight: 0.54,
      cropLean: 0.52,
      cropPresence: 0.56
    },
    {
      grassColor: 0x8f8879,
      density: 0.12,
      grassHeight: 0.32,
      grassLean: 0.56,
      soilColor: 0xaaa08c,
      moistOpacity: 0,
      bareOpacity: 0.82,
      cropHeight: 0.2,
      cropLean: 0.84,
      cropPresence: 0.12
    }
  ];

  const waterStateDefs = [
    {
      color: 0x5d8798,
      roughness: 0.24,
      metalness: 0.2,
      opacity: 0.64,
      ripple: 0.08,
      debris: 0.08,
      film: 0.03,
      algae: 0,
      rim: 0.18,
      waterlogged: 0.08
    },
    {
      color: 0x4f6d6f,
      roughness: 0.38,
      metalness: 0.14,
      opacity: 0.71,
      ripple: 0.04,
      debris: 0.32,
      film: 0.16,
      algae: 0.08,
      rim: 0.35,
      waterlogged: 0.18
    },
    {
      color: 0x435145,
      roughness: 0.52,
      metalness: 0.08,
      opacity: 0.82,
      ripple: 0.016,
      debris: 0.58,
      film: 0.32,
      algae: 0.3,
      rim: 0.55,
      waterlogged: 0.34
    },
    {
      color: 0x2f3a34,
      roughness: 0.66,
      metalness: 0.03,
      opacity: 0.92,
      ripple: 0,
      debris: 0.86,
      film: 0.54,
      algae: 0.62,
      rim: 0.78,
      waterlogged: 0.52
    }
  ];

  const vegetationPatches = [];
  const vegetationPatchCount = 72;
  const vegetationRoot = new THREE.Group();
  for (let i = 0; i < vegetationPatchCount; i += 1) {
    const x = -46 + Math.random() * 92;
    const z = -46 + Math.random() * 92;
    const baseY = terrainYAt(x, z);
    let nearestPoolDistance = Infinity;
    poolSeeds.forEach(([px, pz]) => {
      nearestPoolDistance = Math.min(nearestPoolDistance, Math.hypot(px - x, pz - z));
    });
    const nearWaterFactor = clamp(1 - (nearestPoolDistance / 18), 0, 1);
    const patch = new THREE.Group();
    patch.position.set(x, baseY + 0.01, z);

    const moistDisk = new THREE.Mesh(
      new THREE.CircleGeometry(0.8 + Math.random() * 0.45, 14),
      new THREE.MeshStandardMaterial({
        color: 0x6b6c42,
        roughness: 0.95,
        metalness: 0,
        transparent: true,
        opacity: 0.2,
        depthWrite: false
      })
    );
    moistDisk.rotation.x = -Math.PI / 2;
    moistDisk.position.y = 0.008;
    patch.add(moistDisk);

    const barePatch = new THREE.Mesh(
      new THREE.CircleGeometry(0.95 + Math.random() * 0.7, 14),
      new THREE.MeshStandardMaterial({
        color: 0x96856a,
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: 0.12,
        depthWrite: false
      })
    );
    barePatch.rotation.x = -Math.PI / 2;
    barePatch.rotation.z = Math.random() * Math.PI;
    barePatch.position.y = 0.01;
    patch.add(barePatch);

    const blades = [];
    const bladeCount = 9 + Math.floor(Math.random() * 8);
    for (let b = 0; b < bladeCount; b += 1) {
      const bladeHeight = 0.35 + Math.random() * 0.6;
      const blade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.02, bladeHeight, 5),
        new THREE.MeshStandardMaterial({ color: 0x6f9e41, roughness: 0.95, metalness: 0.01 })
      );
      blade.position.set(
        (Math.random() - 0.5) * 1.9,
        bladeHeight * 0.5,
        (Math.random() - 0.5) * 1.9
      );
      blade.rotation.z = (Math.random() - 0.5) * 0.18;
      blade.userData.baseHeight = bladeHeight;
      blade.userData.resilience = Math.random();
      blade.userData.bendPhase = Math.random() * Math.PI * 2;
      patch.add(blade);
      blades.push(blade);
    }

    const crop = new THREE.Group();
    const cropHeight = 1 + Math.random() * 1.1;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.1, cropHeight, 6),
      new THREE.MeshStandardMaterial({ color: 0x807462, roughness: 0.98, metalness: 0 })
    );
    stem.position.y = cropHeight * 0.5;
    crop.add(stem);

    const wiltHead = new THREE.Mesh(
      new THREE.ConeGeometry(0.22 + Math.random() * 0.22, 0.6 + Math.random() * 0.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x8d867b, roughness: 1, metalness: 0 })
    );
    wiltHead.position.y = cropHeight * 0.95;
    crop.add(wiltHead);

    const sideShoots = [];
    const shootCount = 1 + Math.floor(Math.random() * 3);
    for (let s = 0; s < shootCount; s += 1) {
      const shoot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.03, 0.5 + Math.random() * 0.45, 5),
        new THREE.MeshStandardMaterial({ color: 0x7f7a6f, roughness: 1, metalness: 0 })
      );
      const side = s % 2 === 0 ? 1 : -1;
      shoot.position.set(side * (0.11 + Math.random() * 0.1), 0.45 + s * 0.24, 0);
      shoot.rotation.z = side * (0.42 + Math.random() * 0.2);
      crop.add(shoot);
      sideShoots.push(shoot);
    }

    crop.position.set((Math.random() - 0.5) * 0.9, 0, (Math.random() - 0.5) * 0.9);
    crop.rotation.y = Math.random() * Math.PI;
    patch.add(crop);

    patch.userData.stateBias = (Math.random() - 0.5) * 0.35 + nearWaterFactor * 0.18;
    patch.userData.nearWaterFactor = nearWaterFactor;
    vegetationRoot.add(patch);

    vegetationPatches.push({
      patch,
      moistDisk,
      barePatch,
      blades,
      crop,
      stem,
      wiltHead,
      sideShoots,
      cropHeight,
      dryThreshold: 0.22 + Math.random() * 0.5
    });
  }

  root.add(vegetationRoot);

  const stagnantPools = [];
  const waterBodies = [];
  const poolMatTemplate = new THREE.MeshStandardMaterial({
    color: 0x4f6d6f,
    roughness: 0.34,
    metalness: 0.16,
    transparent: true,
    opacity: 0.74,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const deadFish = [];
  const snailClusters = [];
  const muddyFootprints = [];
  const sparseEdgeVegetation = [];
  poolSeeds.forEach(([x, z, r], idx) => {
    const poolGeometry = new THREE.CircleGeometry(r, 28);
    const poolPos = poolGeometry.attributes.position;
    for (let p = 0; p < poolPos.count; p += 1) {
      const px = poolPos.getX(p);
      const py = poolPos.getY(p);
      const angle = Math.atan2(py, px);
      const radial = Math.sqrt((px * px) + (py * py));
      const rimNoise = Math.sin(angle * (3.2 + (idx % 3))) * 0.14 + Math.cos(angle * 6.3 + idx) * 0.09;
      const warped = Math.max(0.22, radial + rimNoise);
      poolPos.setXY(p, Math.cos(angle) * warped, Math.sin(angle) * warped);
    }
    poolPos.needsUpdate = true;
    poolGeometry.computeVertexNormals();

    const mudRim = new THREE.Mesh(
      poolGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x5f503d,
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: 0.26,
        depthWrite: false
      })
    );
    mudRim.rotation.x = -Math.PI / 2;
    mudRim.scale.set(1.18, 1.18, 1);
    mudRim.position.set(x, terrainYAt(x, z) + 0.015, z);
    root.add(mudRim);

    const waterloggedZone = new THREE.Mesh(
      new THREE.CircleGeometry(r * (1.55 + Math.random() * 0.2), 18),
      new THREE.MeshStandardMaterial({
        color: 0x6f634e,
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: 0.14,
        depthWrite: false
      })
    );
    waterloggedZone.rotation.x = -Math.PI / 2;
    waterloggedZone.rotation.z = Math.random() * Math.PI;
    waterloggedZone.position.set(x, terrainYAt(x, z) + 0.012, z);
    root.add(waterloggedZone);

    const pool = new THREE.Mesh(poolGeometry, poolMatTemplate.clone());
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, terrainYAt(x, z) + 0.05, z);
    pool.userData.interactive = true;
    pool.userData.dialogue = [
      'This water is trapped and warm now, perfect for parasite hosts.',
      'Stagnation here raises disease risk for people and cattle alike.'
    ];
    pool.userData.dialogueId = `scene3-pool-${idx}`;
    root.add(pool);
    stagnantPools.push(pool);

    const surfaceFilm = new THREE.Mesh(
      poolGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x768176,
        roughness: 0.95,
        metalness: 0,
        transparent: true,
        opacity: 0.06,
        depthWrite: false
      })
    );
    surfaceFilm.rotation.x = -Math.PI / 2;
    surfaceFilm.scale.set(0.86, 0.86, 1);
    surfaceFilm.position.set(x, terrainYAt(x, z) + 0.052, z);
    root.add(surfaceFilm);

    const algaePatches = new THREE.Group();
    const algaeMaterials = [];
    const algaeCount = 3 + (idx % 3);
    for (let a = 0; a < algaeCount; a += 1) {
      const algaeMaterial = new THREE.MeshStandardMaterial({
        color: 0x53603e,
        roughness: 0.96,
        metalness: 0,
        transparent: true,
        opacity: 0.04,
        depthWrite: false
      });
      const algae = new THREE.Mesh(
        new THREE.CircleGeometry(0.22 + Math.random() * 0.28, 10),
        algaeMaterial
      );
      algae.rotation.x = -Math.PI / 2;
      algae.position.set(
        x + (Math.random() - 0.5) * (r * 1.45),
        terrainYAt(x, z) + 0.056,
        z + (Math.random() - 0.5) * (r * 1.45)
      );
      algae.rotation.z = Math.random() * Math.PI;
      root.add(algae);
      algaePatches.add(algae);
      algaeMaterials.push(algaeMaterial);
    }

    const debrisPieces = [];
    const debrisCount = 5 + (idx % 3);
    for (let d = 0; d < debrisCount; d += 1) {
      const debris = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18 + Math.random() * 0.18, 0.06 + Math.random() * 0.1),
        new THREE.MeshStandardMaterial({
          color: d % 2 === 0 ? 0x655845 : 0x574e3f,
          roughness: 1,
          metalness: 0,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.08,
          depthWrite: false
        })
      );
      debris.rotation.x = -Math.PI / 2;
      debris.rotation.z = Math.random() * Math.PI;
      debris.position.set(
        x + (Math.random() - 0.5) * (r * 1.95),
        terrainYAt(x, z) + 0.055,
        z + (Math.random() - 0.5) * (r * 1.95)
      );
      root.add(debris);
      debrisPieces.push(debris);
    }

    const edgeGrass = [];
    const edgeBladeCount = 6 + Math.floor(Math.random() * 4);
    for (let e = 0; e < edgeBladeCount; e += 1) {
      const h = 0.2 + Math.random() * 0.45;
      const blade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.018, h, 5),
        new THREE.MeshStandardMaterial({ color: 0x6f7751, roughness: 0.95, metalness: 0.01 })
      );
      const angle = Math.random() * Math.PI * 2;
      const edgeRadius = r * (1.25 + Math.random() * 0.55);
      const gx = x + Math.cos(angle) * edgeRadius;
      const gz = z + Math.sin(angle) * edgeRadius;
      const groundY = terrainYAt(gx, gz);
      blade.position.set(gx, groundY + h * 0.5, gz);
      blade.rotation.z = (Math.random() - 0.5) * 0.35;
      blade.userData.baseHeight = h;
      blade.userData.resilience = Math.random();
      blade.userData.baseGroundY = groundY;
      root.add(blade);
      edgeGrass.push(blade);
    }
    sparseEdgeVegetation.push(edgeGrass);

    const footprintCount = 3 + (idx % 2);
    for (let f = 0; f < footprintCount; f += 1) {
      const footprint = new THREE.Mesh(
        new THREE.CircleGeometry(0.13 + Math.random() * 0.09, 10),
        new THREE.MeshStandardMaterial({
          color: 0x574737,
          roughness: 1,
          metalness: 0,
          transparent: true,
          opacity: 0.09,
          depthWrite: false
        })
      );
      footprint.rotation.x = -Math.PI / 2;
      footprint.scale.set(1, 0.65 + Math.random() * 0.25, 1);
      const angle = Math.random() * Math.PI * 2;
      const distance = r * (1.35 + Math.random() * 0.9);
      const fx = x + Math.cos(angle) * distance;
      const fz = z + Math.sin(angle) * distance;
      footprint.position.set(fx, terrainYAt(fx, fz) + 0.02, fz);
      footprint.rotation.z = angle + (Math.random() - 0.5) * 0.4;
      root.add(footprint);
      muddyFootprints.push(footprint);
    }

    const snailCluster = new THREE.Group();
    const snailCount = 8 + (idx % 4);
    for (let s = 0; s < snailCount; s += 1) {
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(0.1 + Math.random() * 0.06, 10, 10),
        new THREE.MeshStandardMaterial({
          color: 0xe6ded1,
          roughness: 0.55,
          metalness: 0.04
        })
      );
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.05, 0.18, 3, 6),
        new THREE.MeshStandardMaterial({
          color: 0x3c3b36,
          roughness: 0.92,
          metalness: 0
        })
      );
      const localX = (Math.random() - 0.5) * (r * 1.2);
      const localZ = (Math.random() - 0.5) * (r * 1.2);
      shell.position.set(localX, 0.08, localZ);
      body.position.set(localX + 0.03, 0.05, localZ + 0.05);
      body.rotation.z = Math.PI / 2;
      snailCluster.add(shell);
      snailCluster.add(body);
    }
    const snailBaseY = terrainYAt(x, z) + 0.16;
    snailCluster.position.set(x, snailBaseY, z);
    snailCluster.userData.baseY = snailBaseY;
    snailCluster.userData.interactive = true;
    snailCluster.userData.dialogue = [
      'Snails multiply quickly around stagnant warm pools.',
      'These freshwater snails carry the parasite lifecycle that raises schistosomiasis risk.'
    ];
    snailCluster.userData.dialogueId = `scene3-snail-cluster-${idx}`;
    root.add(snailCluster);
    snailClusters.push(snailCluster);

    const fishCount = idx % 2 === 0 ? 1 : 2;
    for (let i = 0; i < fishCount; i += 1) {
      if (deadFish.length >= 8) {
        break;
      }
      const fish = createWetlandFish({
        bodyColor: idx % 3 === 0 ? 0xa9a39b : 0xa49e96,
        backColor: idx % 2 === 0 ? 0x7b7469 : 0x6f675d,
        bellyColor: idx % 2 === 0 ? 0xbeb8b1 : 0xaba59d,
        finColor: 0x948b81
      });
      const fx = x + (Math.random() - 0.5) * (r * 4.8);
      const fz = z + (Math.random() - 0.5) * (r * 4.8);
      const baseY = terrainYAt(fx, fz) + 0.06;
      fish.position.set(fx, baseY, fz);
      const poseRoll = idx % 3 === 0 ? Math.PI : (idx % 3 === 1 ? Math.PI / 2 : -Math.PI / 2);
      const posePitch = idx % 4 === 0 ? -0.08 : (idx % 4 === 1 ? 0.1 : -0.04);
      fish.rotation.set(posePitch, Math.random() * Math.PI, poseRoll);
      fish.userData.interactive = true;
      fish.userData.dialogue = [
        'Fish are stranded outside water and flopping for oxygen.',
        'As pools shrink and oxygen drops, fish die in plain sight, signaling ecological collapse.'
      ];
      fish.userData.dialogueId = `scene3-dead-fish-${deadFish.length}`;
      fish.userData.flopSeed = Math.random() * Math.PI * 2;
      fish.userData.flopBaseY = fish.position.y;
      fish.userData.flopBaseRotX = fish.rotation.x;
      fish.userData.flopBaseRotZ = fish.rotation.z;
      fish.userData.pollutionBias = 0.38 + Math.random() * 0.55;
      root.add(fish);
      deadFish.push(fish);
    }

    waterBodies.push({
      pool,
      mudRim,
      waterloggedZone,
      surfaceFilm,
      algaeMaterials,
      debrisPieces,
      edgeGrass,
      stateBias: (Math.random() - 0.5) * 0.2 + (idx / poolSeeds.length) * 0.35
    });
  });

  const crackedSoil = [];
  const crackSeeds = [
    [-30, -18], [-20, -2], [-11, 6], [-2, -10], [8, -3], [16, 7], [23, 3], [-30, 14], [30, 14], [34, -4], [2, 22], [-12, 20], [26, 20]
  ];
  crackSeeds.forEach(([x, z], idx) => {
    const crack = new THREE.Mesh(
      new THREE.PlaneGeometry(3 + Math.random() * 2.5, 0.28 + Math.random() * 0.2),
      new THREE.MeshStandardMaterial({ color: 0x3f2b15, roughness: 1, metalness: 0 })
    );
    crack.rotation.x = -Math.PI / 2;
    crack.rotation.z = Math.random() * Math.PI;
    crack.position.set(x, terrainYAt(x, z) + 0.03, z);
    crack.userData.interactive = true;
    crack.userData.dialogue = [
      'The soil crust is hardening and losing fertility.',
      'Without seasonal wet cycles, this ground cannot recover.'
    ];
    crack.userData.dialogueId = `scene3-cracked-soil-${idx}`;
    root.add(crack);
    crackedSoil.push(crack);

    const dryPlate = new THREE.Mesh(
      new THREE.CircleGeometry(1.2 + Math.random() * 1.5, 14),
      new THREE.MeshStandardMaterial({ color: 0xb7a983, roughness: 0.98, metalness: 0 })
    );
    dryPlate.rotation.x = -Math.PI / 2;
    dryPlate.rotation.z = Math.random() * Math.PI;
    dryPlate.position.set(x + (Math.random() - 0.5) * 1.5, terrainYAt(x, z) + 0.015, z + (Math.random() - 0.5) * 1.5);
    root.add(dryPlate);
  });

  const pollutedTrees = [];
  for (let i = 0; i < 26; i += 1) {
    const tx = -44 + Math.random() * 88;
    const tz = -42 + Math.random() * 84;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 2.6 + Math.random() * 1.8, 6),
      new THREE.MeshStandardMaterial({ color: 0x4e4a45, roughness: 0.95, metalness: 0.02 })
    );
    trunk.position.y = terrainYAt(tx, tz) + 1.3;
    tree.add(trunk);

    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.9 + Math.random() * 0.7, 8, 8),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x696a69 : 0x787674, roughness: 0.92, metalness: 0.01 })
    );
    canopy.position.y = trunk.position.y + 1.2;
    canopy.scale.set(1.15, 0.75, 1.1);
    tree.add(canopy);

    tree.position.set(tx, 0, tz);
    tree.rotation.y = Math.random() * Math.PI * 2;
    tree.userData.interactive = true;
    tree.userData.dialogue = [
      'These trees are stressed, grey, and thinning under polluted conditions.',
      'Loss of clean seasonal water and soil quality weakens tree health and reduces local shade and habitat.'
    ];
    tree.userData.dialogueId = `scene3-polluted-tree-${i}`;
    root.add(tree);
    pollutedTrees.push(tree);
  }

  const weakCows = [];
  const cowSeeds = [
    [-10, 0.05, -8],
    [0, 0.05, -8],
    [10, 0.05, -8],
    [20, 0.05, -8]
  ];
  cowSeeds.forEach((seed, idx) => {
    const cow = createCow({
      group: idx % 2 === 0 ? 'Dinka' : 'Nuer',
      direction: idx % 2 === 0 ? 1 : -1,
      grazeSpeed: 0.16,
      driftSpeed: 0.02
    });
    cow.position.set(seed[0], terrainYAt(seed[0], seed[2]) + seed[1], seed[2]);
    cow.scale.setScalar(0.8);
    cow.userData.interactive = true;
    cow.userData.dialogue = [
      'These herds are weaker each season as grazing routes shrink.',
      'Pastoral mobility is breaking under fragmented water access.'
    ];
    cow.userData.dialogueId = `scene3-cow-${idx}`;
    root.add(cow);
    weakCows.push(cow);
  });

  const hutSeeds = [
    [-30, -20], [-25, -10], [-20, 0],
    [25, -20], [30, -10], [20, 0]
  ];
  hutSeeds.forEach((seed, idx) => {
    const hut = createCircularHut({
      wallColor: 0x8b7d5a,
      roofColor: 0x6b5a3e,
      accentColor: idx % 2 === 0 ? 0x5a4f39 : 0x4c4330,
      wallRadius: 1.6 + (idx % 2) * 0.2,
      wallHeight: 1.8,
      roofHeight: 1.95,
      fenceCount: 6
    });
    const x = seed[0];
    const z = seed[1];
    hut.position.set(x, terrainYAt(x, z), z);
    hut.rotation.y = Math.atan2(-x, -z);
    hut.scale.setScalar(0.95);
    root.add(hut);
  });

  const canal = new THREE.Group();
  canal.position.z = 38;
  const canalWallMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.92, metalness: 0.04 });
  const canalBedMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2f, roughness: 0.98, metalness: 0.01 });

  const northWall = new THREE.Mesh(new THREE.BoxGeometry(80, 2, 0.3), canalWallMat);
  northWall.position.set(0, terrainYAt(0, 38) + 0.95, 1.75);
  canal.add(northWall);

  const southWall = new THREE.Mesh(new THREE.BoxGeometry(80, 2, 0.3), canalWallMat);
  southWall.position.set(0, terrainYAt(0, 38) + 0.95, -1.75);
  canal.add(southWall);

  const bed = new THREE.Mesh(new THREE.PlaneGeometry(80, 3.5), canalBedMat);
  bed.rotation.x = -Math.PI / 2;
  bed.position.set(0, terrainYAt(0, 38) - 2, 0);
  canal.add(bed);

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x706050, roughness: 0.95, metalness: 0.02 });
  for (let i = 0; i < 20; i += 1) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + Math.random() * 0.15, 0), rockMat);
    rock.position.set(-38 + Math.random() * 76, terrainYAt(0, 38) - 1.85 + Math.random() * 0.35, -1.3 + Math.random() * 2.6);
    canal.add(rock);
  }

  canal.userData.interactive = true;
  canal.userData.dialogue = [
    'This trench imposed engineered flow where seasonal movement once dominated.',
    'Canal geometry disrupted ecology, migration, and local health systems together.'
  ];
  canal.userData.dialogueId = 'scene3-canal';
  root.add(canal);

  const blockedPathMarker = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
  );
  blockedPathMarker.rotation.x = -Math.PI / 2;
  blockedPathMarker.position.set(0, terrainYAt(0, 36) + 0.05, 36);
  blockedPathMarker.visible = false;
  blockedPathMarker.userData.interactive = true;
  blockedPathMarker.userData.dialogue = [
    'The old migration corridor is blocked by canal infrastructure.',
    'Movement restrictions amplify conflict, hunger, and disease exposure.'
  ];
  blockedPathMarker.userData.dialogueId = 'scene3-blocked-path';
  root.add(blockedPathMarker);

  const pastoralist = createNiloticHuman({ group: 'Dinka', role: 'pastoralist', direction: 1 });
  pastoralist.position.set(-15, terrainYAt(-15, -15) + 0.05, -15);
  pastoralist.scale.setScalar(1.8);
  pastoralist.userData.interactive = true;
  pastoralist.userData.dialogue = [
    'Our dry-season movement is gone, and the cattle routes are fractured.',
    'Water access now depends on barriers we never needed before.'
  ];
  pastoralist.userData.dialogueId = 'scene3-pastoralist';
  root.add(pastoralist);

  const fisher = createNiloticHuman({ group: 'Nuer', role: 'fisher', direction: -1 });
  fisher.position.set(5, terrainYAt(5, -12) + 0.05, -12);
  fisher.scale.setScalar(1.8);
  fisher.userData.interactive = true;
  fisher.userData.dialogue = [
    'Fish vanished from the spawning channels when flow patterns changed.',
    'The pools left behind are shallow, warm, and biologically stressed.'
  ];
  fisher.userData.dialogueId = 'scene3-fisher';
  root.add(fisher);

  const villager = createNiloticHuman({ group: 'Dinka', role: 'villager', direction: -1 });
  villager.position.set(22, terrainYAt(22, 5) + 0.05, 5);
  villager.scale.setScalar(1.8);
  villager.userData.interactive = true;
  villager.userData.dialogue = [
    'Children are getting sick from contact with stagnant water.',
    'Disease risk rose while warnings were dismissed as collateral.'
  ];
  villager.userData.dialogueId = 'scene3-villager';
  root.add(villager);

  const elder = createNiloticHuman({ group: 'Nuer', role: 'elder', direction: 1 });
  elder.position.set(-8, terrainYAt(-8, 30) + 0.05, 30);
  elder.scale.setScalar(1.8);
  elder.userData.interactive = true;
  elder.userData.dialogue = [
    'We warned that altering this wetland would bring sickness.',
    'The signs were clear long before institutions chose to listen.'
  ];
  elder.userData.dialogueId = 'scene3-elder';
  root.add(elder);

  const fatiguedPerson = createNiloticHuman({ group: 'Dinka', role: 'villager', direction: 1 });
  fatiguedPerson.scale.setScalar(1.8);
  fatiguedPerson.position.set(10, terrainYAt(10, 12) + 0.62, 12);
  fatiguedPerson.rotation.set(Math.PI / 2, 0.35, 0.25);
  fatiguedPerson.userData.interactive = true;
  fatiguedPerson.userData.dialogue = [
    'I am exhausted and feverish after repeated exposure to stagnant water.',
    'Fatigue and weakness are common in chronic schistosomiasis and related water-borne illness.'
  ];
  fatiguedPerson.userData.dialogueId = 'scene3-fatigued-person';
  fatiguedPerson.userData.scene4BaseY = fatiguedPerson.position.y;
  root.add(fatiguedPerson);

  const sun = new THREE.DirectionalLight(0xbbaf8a, 0.5);
  sun.position.set(26, 28, 12);
  sun.castShadow = true;
  root.add(sun);

  const fill = new THREE.AmbientLight(0x706050, 0.4);
  root.add(fill);

  return {
    root,
    weakCows,
    stagnantPools,
    waterBodies,
    muddyFootprints,
    sparseEdgeVegetation,
    vegetationPatches,
    vegetationStateDefs,
    waterStateDefs,
    snailClusters,
    deadFish,
    crackedSoil,
    pollutedTrees,
    pastoralist,
    fisher,
    villager,
    elder,
    fatiguedPerson,
    canal,
    previousFog: scene.fog,
    characters: [pastoralist, fisher, villager, elder, fatiguedPerson]
  };
}

function createSpear() {
  const spear = new THREE.Group();
  
  // Shaft
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8, metalness: 0.05 })
  );
  shaft.position.y = 0.9;
  spear.add(shaft);
  
  // Sharp tip (cone)
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.8 })
  );
  tip.position.y = 1.85;
  spear.add(tip);
  
  return spear;
}

function buildScene5System() {
  const root = new THREE.Group();

  // === TERRAIN ===
  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100, 64, 64),
    new THREE.MeshStandardMaterial({
      color: 0x8b7d3c,
      roughness: 0.95,
      metalness: 0.02
    })
  );
  const terrainPos = terrain.geometry.attributes.position;
  for (let i = 0; i < terrainPos.count; i += 1) {
    const x = terrainPos.getX(i);
    const z = terrainPos.getY(i);
    const humps = Math.sin(x * 0.12) * 0.25 + Math.cos(z * 0.1) * 0.2;
    terrainPos.setZ(i, -0.1 + humps);
  }
  terrainPos.needsUpdate = true;
  terrain.geometry.computeVertexNormals();
  terrain.rotation.x = -Math.PI / 2;
  terrain.receiveShadow = true;
  root.add(terrain);

  // === CANAL TRENCH ===
  // Canal runs along z=10, length 80, width 4, depth 3
  const canalWallMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.85, metalness: 0.05 });
  const canalBedMat = new THREE.MeshStandardMaterial({ color: 0x3d2e24, roughness: 0.92, metalness: 0 });
  
  // Left wall
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(80, 3, 0.4), canalWallMat);
  leftWall.position.set(0, -1.5, 8);
  root.add(leftWall);
  
  // Right wall
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(80, 3, 0.4), canalWallMat);
  rightWall.position.set(0, -1.5, 12);
  root.add(rightWall);
  
  // Canal bed
  const canalBed = new THREE.Mesh(new THREE.PlaneGeometry(80, 4), canalBedMat);
  canalBed.rotation.x = -Math.PI / 2;
  canalBed.position.set(0, -3, 10);
  root.add(canalBed);
  
  // Rocks in canal
  for (let i = 0; i < 12; i += 1) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.3),
      new THREE.MeshStandardMaterial({ color: 0x706050, roughness: 0.9, metalness: 0 })
    );
    rock.position.set((Math.random() - 0.5) * 70, -2.5, 10 + (Math.random() - 0.5) * 3);
    root.add(rock);
  }
  
  // Canal as interactive object
  const canalInteractive = new THREE.Group();
  canalInteractive.userData.interactive = true;
  canalInteractive.userData.dialogue = [
    "The canal cut through the wetland like a scar that wouldn't heal.",
    "Construction—state-controlled infrastructure—was the justification for stripping local rights."
  ];
  canalInteractive.userData.dialogueId = 'scene5-canal';
  canalBed.userData.interactive = true;
  canalBed.userData.dialogue = canalInteractive.userData.dialogue;
  canalBed.userData.dialogueId = canalInteractive.userData.dialogueId;

  // === ABANDONED BWE (scaled to 0.6) ===
  const bwe = createImmersiveBWE();
  bwe.scale.setScalar(0.6);
  // Ground the BWE on the terrain (terrain y ≈ 0.08 at x=5, z=12)
  bwe.position.set(5, 0.08, 12);
  // Raise boom
  if (bwe.userData?.boom) {
    bwe.userData.boom.rotation.x = -0.3;
  }
  // Add broken window to cabin
  if (bwe.userData?.cabin) {
    const brokenWindow = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.2 })
    );
    brokenWindow.position.set(0.15, 0.1, -0.15);
    bwe.userData.cabin.add(brokenWindow);

    const crackCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.1 })
    );
    crackCylinder.rotation.z = Math.PI / 4;
    crackCylinder.position.set(0.08, 0.15, -0.12);
    bwe.userData.cabin.add(crackCylinder);
  }

  // === SOUTH SUDAN FLAG ON TOP OF EXCAVATOR ===
  // BWE chassis deck is at local y=5.5, scaled by 0.6 → world y = 0.08 + 3.3 = 3.38
  const bweTopY = 0.08 + 5.5 * 0.6; // ≈ 3.38
  const flagGroup = new THREE.Group();

  const flagPoleMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 3.0, 6),
    new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.3 })
  );
  flagPoleMesh.position.y = 1.5;
  flagGroup.add(flagPoleMesh);

  // South Sudan flag stripes (black top, red mid, green bottom)
  const flagStripeData = [
    { color: 0x000000, yOff: 0.55 },
    { color: 0xbb0000, yOff: 0.20 },
    { color: 0x009900, yOff: -0.15 }
  ];
  flagStripeData.forEach(({ color, yOff }) => {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.35),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide })
    );
    stripe.position.set(0.7, 3.0 + yOff, 0);
    stripe.rotation.y = 0;
    flagGroup.add(stripe);
  });

  // Blue triangle (left side of flag)
  const blueTriMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 1.05),
    new THREE.MeshStandardMaterial({ color: 0x0066cc, roughness: 0.7, side: THREE.DoubleSide })
  );
  blueTriMesh.position.set(0.19, 3.0 + 0.2, 0);
  flagGroup.add(blueTriMesh);

  // Yellow star
  const starMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.5, metalness: 0.2 })
  );
  starMesh.position.set(0.19, 3.2, 0.05);
  flagGroup.add(starMesh);

  flagGroup.position.set(5, bweTopY, 12);
  root.add(flagGroup);

  // === VILLAGER STANDING ON TOP OF EXCAVATOR ===
  const excavatorVillager = createNiloticHuman({ group: 'Dinka', role: 'carrier', direction: -1 });
  excavatorVillager.position.set(5, bweTopY + 0.05, 11.8);
  excavatorVillager.scale.setScalar(1.1);
  excavatorVillager.rotation.y = Math.PI;
  // Arms raised in victory/defiance
  if (excavatorVillager.userData.leftArm) excavatorVillager.userData.leftArm.rotation.x = -Math.PI / 2.2;
  if (excavatorVillager.userData.rightArm) excavatorVillager.userData.rightArm.rotation.x = -Math.PI / 2.2;
  excavatorVillager.userData.interactive = true;
  excavatorVillager.userData.dialogue = [
    "We stand on the machine that tried to erase us.",
    "This is our victory — hard won, never forgotten."
  ];
  excavatorVillager.userData.dialogueId = 'scene5-excavator-villager';
  root.add(excavatorVillager);

  root.add(bwe);

  // === GUARD POSTS (Watchtowers) ===
  const guardPosts = [];
  const guardPostPositions = [[-15, 0, 18], [15, 0, 18]];
  
  guardPostPositions.forEach(([px, py, pz], idx) => {
    const post = new THREE.Group();
    const cylinderMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8, metalness: 0.1 });
    
    // Four vertical cylinders
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2;
      const offset = 0.8;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.5, 6), cylinderMat);
      leg.position.set(Math.cos(angle) * offset, 1.75, Math.sin(angle) * offset);
      post.add(leg);
    }
    
    // Platform
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.3, 2),
      new THREE.MeshStandardMaterial({ color: 0x7a5f47, roughness: 0.8, metalness: 0.1 })
    );
    platform.position.y = 3.5;
    post.add(platform);
    
    // Flag pole
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6), cylinderMat);
    flagPole.position.set(0.7, 4.5, 0);
    post.add(flagPole);
    
    // Flag
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide })
    );
    flag.rotation.y = Math.PI / 2;
    flag.position.set(1.4, 4.5, 0);
    post.add(flag);
    
    // Guard on platform – reuse existing Nilotic human
    const guard = createNiloticHuman({
      group: idx === 0 ? 'Dinka' : 'Nuer',
      role: 'carrier',
      direction: idx === 0 ? 1 : -1
    });
    guard.position.set(0, 3.7, 0);   // above platform
    guard.scale.setScalar(1.25);
    guard.userData.interactive = true;
    guard.userData.dialogue = [
      "State security ensures the canal project.",
      "We guard the interests of the state."
    ];
    guard.userData.dialogueId = `scene5-guard-${idx}`;
    post.add(guard);
    
    post.position.set(px, py, pz);
    root.add(post);
    guardPosts.push(post);
  });

  // === SANDBAG WALLS ===
  const sandbagColor = 0x7a6a53;
  const sandbagMat = new THREE.MeshStandardMaterial({ color: sandbagColor, roughness: 0.9, metalness: 0 });
  
  // Resistance zone near (-10, 0, -5)
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      const sandbag = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 6), sandbagMat);
      sandbag.position.set(-10 - i * 0.7, j * 0.5, -5 + Math.random() * 0.8);
      root.add(sandbag);
    }
  }
  
  // Resistance zone near (15, 0, -5)
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      const sandbag = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 6), sandbagMat);
      sandbag.position.set(15 + i * 0.7, j * 0.5, -5 + Math.random() * 0.8);
      root.add(sandbag);
    }
  }

  // === RETREATING ENGINEERS (afraid, backing away from villagers) ===
  const engineers = [];
  const engineerPositions = [
    [0.5, 0.12, 4.5],
    [2.0, 0.1, 3.8],
    [-1.2, 0.11, 5.0]
  ];

  engineerPositions.forEach(([px, py, pz], idx) => {
    const engineer = createRefinedEngineer({ hasPapers: idx === 0 });
    engineer.position.set(px, py, pz);
    engineer.scale.setScalar(1.3);
    // Face away from villagers (retreating toward viewer)
    engineer.rotation.y = Math.PI;
    // Fear pose: arms slightly raised, torso bent back
    if (engineer.userData.leftLeg) {
      engineer.userData.leftLeg.rotation.x = idx % 2 === 0 ? 0.3 : -0.3;
    }
    if (engineer.userData.rightLeg) {
      engineer.userData.rightLeg.rotation.x = idx % 2 === 0 ? -0.3 : 0.3;
    }
    engineer.userData.interactive = true;
    engineer.userData.dialogue = [
      "The engineers who built this—some of us did not believe in it.",
      "But the orders came from above. We had no choice but to comply."
    ];
    engineer.userData.dialogueId = `scene5-engineer-${idx}`;
    engineer.userData.retreatBaseZ = pz;
    root.add(engineer);
    engineers.push(engineer);
  });

  // === GUARD BEHIND ENGINEERS (with rifle) ===
  const guardBehind = createNiloticHuman({
    group: 'Nuer',
    role: 'carrier',
    direction: -1
  });
  guardBehind.position.set(2.25, 0, 9.8);
  guardBehind.scale.setScalar(1.4);
  
  // Rifle prop
  const rifleBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.86, metalness: 0.08 })
  );
  rifleBarrel.rotation.z = Math.PI / 2;
  rifleBarrel.position.set(0.3, 1.0, 0.3);
  guardBehind.add(rifleBarrel);
  
  const rifleStock = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x3a2f1f, roughness: 0.8, metalness: 0.1 })
  );
  rifleStock.position.set(0.15, 1.0, 0.6);
  guardBehind.add(rifleStock);
  
  guardBehind.userData.interactive = true;
  guardBehind.userData.dialogue = ["They will not escape.", "Order and security must prevail."];
  guardBehind.userData.dialogueId = 'scene5-guard-behind';
  root.add(guardBehind);

  // === SPLA RUNNERS (mid-stride poses) ===
  const runners = [];
  const runnerPositions = [[-2, 0, 14], [6, 0, 13]];
  
  runnerPositions.forEach(([px, py, pz], idx) => {
    const runner = createNiloticHuman({
      group: idx === 0 ? 'Dinka' : 'Nuer',
      role: 'fisher',
      direction: 1
    });
    runner.position.set(px, py, pz);
    runner.scale.setScalar(1.25);
    
    // Mid-stride pose
    if (runner.userData) {
      if (runner.userData.leftLeg) runner.userData.leftLeg.rotation.x = 0.8;
      if (runner.userData.rightLeg) runner.userData.rightLeg.rotation.x = -1.2;
    }
    
    // Rifle prop
    const rifle = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.86, metalness: 0.08 })
    );
    rifle.rotation.x = Math.PI / 4;
    rifle.position.set(-0.2, 1.1, 0.2);
    runner.add(rifle);
    
    runner.userData.interactive = true;
    runner.userData.dialogue = [
      "We run because we must. We fight because there is no other choice.",
      "This is our land, our water. We will not surrender it."
    ];
    runner.userData.dialogueId = `scene5-runner-${idx}`;
    root.add(runner);
    runners.push(runner);
    
    // Motion trail - suspended rock
    const rockTrail = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.2),
      new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 0.8, metalness: 0.1, transparent: true, opacity: 0.6 })
    );
    rockTrail.position.set(px - 0.5, py + 0.3, pz - 0.5);
    root.add(rockTrail);
  });

  // === FLAG HOLDER ON BWE ===
  const flagHolder = createNiloticHuman({
    group: 'Dinka',
    role: 'carrier'
  });
  flagHolder.position.set(5, 3.8, 12);
  flagHolder.scale.setScalar(1.1);
  
  // South Sudan flag with arms raised
  if (flagHolder.userData) {
    if (flagHolder.userData.leftArm) flagHolder.userData.leftArm.rotation.x = -Math.PI / 2.5;
    if (flagHolder.userData.rightArm) flagHolder.userData.rightArm.rotation.x = -Math.PI / 2.5;
  }
  
  // South Sudan flag: black, red, green with blue triangle and yellow star
  const flagPart1 = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide })
  );
  flagPart1.position.set(-0.3, 1.6, 0.4);
  flagPart1.rotation.y = Math.PI / 2;
  flagHolder.add(flagPart1);
  
  const flagPart2 = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.35),
    new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide })
  );
  flagPart2.position.set(-0.3, 1.3, 0.4);
  flagPart2.rotation.y = Math.PI / 2;
  flagHolder.add(flagPart2);
  
  const flagPart3 = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x00aa00, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide })
  );
  flagPart3.position.set(-0.3, 1.0, 0.4);
  flagPart3.rotation.y = Math.PI / 2;
  flagHolder.add(flagPart3);
  
  const blueTri = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x0000ff, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide })
  );
  blueTri.position.set(-0.35, 1.3, 0.4);
  blueTri.rotation.y = Math.PI / 2;
  flagHolder.add(blueTri);
  
  const star = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.6, metalness: 0.2 })
  );
  star.position.set(-0.32, 1.3, 0.4);
  flagHolder.add(star);
  
  flagHolder.userData.dialogue = [
    "This flag represents our hope for a free future.",
    "We raise it now, in defiance and in faith."
  ];
  flagHolder.userData.dialogueId = 'scene5-flag-holder';
  flagHolder.userData.interactive = true;
  root.add(flagHolder);

  // === ROCK THROWERS ON EXCAVATOR ===
  for (let i = 0; i < 2; i += 1) {
    const thrower = createNiloticHuman({
      group: i === 0 ? 'Dinka' : 'Nuer',
      role: 'fisher'
    });
    thrower.position.set(5 + i * 1.5, 2.5, 12 + i * 0.8);
    thrower.scale.setScalar(1.0);
    
    // Arm raised
    if (thrower.userData) {
      if (thrower.userData.rightArm) thrower.userData.rightArm.rotation.x = -Math.PI / 1.8;
    }
    
    // Rock floating near hand
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.25),
      new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.85, metalness: 0.1 })
    );
    rock.position.set(5.5 + i * 1.5, 2.8, 12.3 + i * 0.8);
    root.add(rock);
    
    thrower.userData.dialogue = [
      "We throw with all our strength.",
      "Every rock, a voice of resistance."
    ];
    thrower.userData.dialogueId = `scene5-rock-thrower-${i}`;
    thrower.userData.interactive = true;
    root.add(thrower);
  }

  // === SPEAR-ARMED VILLAGER CROWD (facing engineers) ===
  const crowd = [];
  // Front line: spear holders pointing at engineers
  const spearVillagerConfigs = [
    { x: -6, z: 8, group: 'Dinka' },
    { x: -3, z: 7.5, group: 'Nuer' },
    { x: 0, z: 7, group: 'Dinka' },
    { x: 3, z: 7.5, group: 'Nuer' },
    { x: 6, z: 8, group: 'Dinka' }
  ];

  spearVillagerConfigs.forEach(({ x, z, group }, idx) => {
    const villager = createNiloticHuman({ group, role: 'carrier', direction: -1 });
    villager.position.set(x, 0.12, z);
    villager.scale.setScalar(1.4);
    // Face toward engineers (negative z direction)
    villager.rotation.y = Math.PI;

    // Attach spear pointed toward engineers
    const spear = createSpear();
    spear.rotation.x = -Math.PI / 2 + 0.3; // Tip angled toward engineers
    spear.rotation.z = (idx % 2 === 0 ? -0.15 : 0.15);
    spear.position.set(0.35, 1.2, -0.2);
    villager.add(spear);

    // Threat stance: right arm extended forward holding spear
    if (villager.userData.rightArm) villager.userData.rightArm.rotation.x = -0.9;
    if (villager.userData.leftArm) villager.userData.leftArm.rotation.x = -0.5;

    villager.userData.interactive = true;
    villager.userData.dialogue = [
      "This is our land and our water. No machine will take it.",
      "We stand together — Dinka, Nuer, united against this injustice."
    ];
    villager.userData.dialogueId = `scene5-spear-villager-${idx}`;
    villager.userData.baseY = villager.position.y;
    root.add(villager);
    crowd.push(villager);
  });

  // Back line: rock throwers (on ground, raising arms)
  const rockThrowerVillagers = [
    { x: -8, z: 9.5, group: 'Nuer' },
    { x: 8, z: 9.5, group: 'Dinka' },
    { x: -2, z: 10, group: 'Nuer' },
    { x: 4, z: 10, group: 'Dinka' }
  ];

  rockThrowerVillagers.forEach(({ x, z, group }, idx) => {
    const thrower = createNiloticHuman({ group, role: 'fisher', direction: -1 });
    thrower.position.set(x, 0.12, z);
    thrower.scale.setScalar(1.3);
    thrower.rotation.y = Math.PI;
    // Throwing arm raised
    if (thrower.userData.rightArm) thrower.userData.rightArm.rotation.x = -Math.PI / 1.4;
    if (thrower.userData.leftArm) thrower.userData.leftArm.rotation.x = -0.3;

    thrower.userData.interactive = true;
    thrower.userData.dialogue = [
      "Every rock thrown carries a generation of anger.",
      "They drained our wetland. Now we reclaim our dignity."
    ];
    thrower.userData.dialogueId = `scene5-ground-thrower-${idx}`;
    thrower.userData.baseY = thrower.position.y;
    root.add(thrower);
    crowd.push(thrower);
  });

  // === ANIMATED FLYING ROCKS (arc trajectory toward engineers/excavator) ===
  const flyingRocks = [];
  const rockTargets = [
    { startX: -7, startZ: 9, endX: 0.5, endZ: 4.5, height: 4.5 },  // toward engineer 0
    { startX: 4, startZ: 10, endX: 2.0, endZ: 3.8, height: 4.0 },   // toward engineer 1
    { startX: -2, startZ: 10, endX: 5, endZ: 12, height: 5.5 },      // toward excavator
    { startX: 8, startZ: 9.5, endX: 4, endZ: 12, height: 4.8 }       // toward excavator
  ];

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.85, metalness: 0.1 });
  rockTargets.forEach(({ startX, startZ, endX, endZ, height }, idx) => {
    const rockMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22), rockMat);
    rockMesh.castShadow = true;
    // Start position
    rockMesh.position.set(startX, 1.8, startZ);
    root.add(rockMesh);
    flyingRocks.push({
      mesh: rockMesh,
      startX, startZ,
      endX, endZ,
      arcHeight: height,
      t: (idx / rockTargets.length),  // stagger start times
      speed: 0.28 + idx * 0.04
    });
  });

  // === DESTROYED EQUIPMENT (scattered crates) ===
  for (let i = 0; i < 5; i += 1) {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x7a6a5a, roughness: 0.8, metalness: 0.05 })
    );
    crate.position.set(3 + (Math.random() - 0.5) * 8, 0.3, 10 + (Math.random() - 0.5) * 4);
    crate.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
    crate.userData.interactive = true;
    crate.userData.dialogue = [
      "Construction didn't stop when locals protested.",
      "The machines kept working, indifferent to human suffering."
    ];
    crate.userData.dialogueId = `scene5-crate-${i}`;
    root.add(crate);
  }

  // === BARRIER (invisible plane) ===
  const barrier = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 0.1),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  barrier.rotation.x = -Math.PI / 2;
  barrier.position.set(0, 0.01, 9.5);
  barrier.userData.interactive = true;
  barrier.userData.dialogue = [
    "Access is restricted.",
    "The canal was protected as a state project, limiting local control."
  ];
  barrier.userData.dialogueId = 'scene5-barrier';
  root.add(barrier);

  // === SCATTERED ROCKS (ground level) ===
  for (let i = 0; i < 8; i += 1) {
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.35),
      new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.85, metalness: 0.1 })
    );
    rock.position.set(2 + (Math.random() - 0.5) * 12, 0.3, 10 + (Math.random() - 0.5) * 6);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rock.userData.interactive = true;
    rock.userData.dialogue = [
      "They used whatever they had.",
      "Resistance was not professional—it was survival."
    ];
    rock.userData.dialogueId = `scene5-rock-${i}`;
    root.add(rock);
  }

  // === POLLUTED TREES (dead/sickly appearance at scene edges) ===
  const pollutedTreeSeeds = [
    { x: -18, z: -5 }, { x: 16, z: -8 }, { x: -22, z: 15 },
    { x: 20, z: 18 }, { x: -12, z: 20 }, { x: 14, z: -16 },
    { x: -8, z: -14 }, { x: 22, z: 4 }
  ];
  pollutedTreeSeeds.forEach(({ x, z }) => {
    const tree = createVillageTree({ ghostTree: true });
    tree.scale.setScalar(0.48);
    const ty = -0.1 + Math.sin(x * 0.12) * 0.25 + Math.cos(z * 0.1) * 0.2;
    tree.position.set(x, ty, z);
    root.add(tree);
  });

  // === MUDDY WATER PUDDLES ===
  const puddleSeeds = [
    { x: -4, z: 6 }, { x: 7, z: 5 }, { x: -9, z: 2 },
    { x: 3, z: 2.5 }, { x: 10, z: 7 }, { x: -6, z: 14 }
  ];
  puddleSeeds.forEach(({ x, z }) => {
    const radius = 0.6 + Math.random() * 0.8;
    const puddle = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 20),
      new THREE.MeshStandardMaterial({
        color: 0x3a2e24,
        roughness: 0.6,
        metalness: 0.1,
        transparent: true,
        opacity: 0.78
      })
    );
    puddle.rotation.x = -Math.PI / 2;
    const ty = -0.1 + Math.sin(x * 0.12) * 0.25 + Math.cos(z * 0.1) * 0.2;
    puddle.position.set(x, ty + 0.02, z);
    root.add(puddle);
  });

  // === VILLAGE HOUSES (background, consistent with other scenes) ===
  const houseConfigs = [
    { x: -20, z: -10, rot: 0.3 },
    { x: -17, z: -16, rot: -0.5 },
    { x: 18, z: -12, rot: 1.1 },
    { x: 22, z: -18, rot: -0.2 },
    { x: -14, z: 22, rot: 0.8 }
  ];
  houseConfigs.forEach(({ x, z, rot }) => {
    const hut = createCircularHut({ wallRadius: 1.8, wallHeight: 1.8, roofHeight: 2.0, fenceCount: 8 });
    hut.scale.setScalar(0.55);
    const ty = -0.1 + Math.sin(x * 0.12) * 0.25 + Math.cos(z * 0.1) * 0.2;
    hut.position.set(x, ty, z);
    hut.rotation.y = rot;
    root.add(hut);
  });

  // === LIGHTING ===
  const directionalLight = new THREE.DirectionalLight(0xbbaf8a, 0.6);
  directionalLight.position.set(20, 20, 15);
  directionalLight.castShadow = true;
  root.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(0x706050, 0.4);
  root.add(ambientLight);

  // === FOG (overcast, not sunny) ===
  if (scene) {
    scene.fog = new THREE.Fog(0x9b8a72, 8, 55);
  }

  return {
    root,
    crowd,
    engineers,
    flyingRocks,
    rocks: [],
    flags: [],
    dust: null,
    rockThrowers: [],
    throwingRocks: []
  };
}

// ============================================================================
// SCENE 6: The Broken Sponge (Scene 5 - Microclimate Collapse)
// ============================================================================

function buildScene6System() {
  const root = new THREE.Group();

  // === DEGRADED TERRAIN ===
  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120, 80, 80),
    new THREE.MeshStandardMaterial({
      color: 0xa68860,
      roughness: 0.95,
      metalness: 0.02
    })
  );
  const terrainPos = terrain.geometry.attributes.position;
  for (let i = 0; i < terrainPos.count; i += 1) {
    const x = terrainPos.getX(i);
    const z = terrainPos.getY(i);
    // Eroded, cracked appearance
    const erosion = Math.sin(x * 0.18 + z * 0.15) * 0.3 + Math.cos(z * 0.12 - x * 0.08) * 0.25;
    const cracks = Math.sin(x * 0.45) * 0.08 + Math.sin(z * 0.35) * 0.06;
    terrainPos.setZ(i, -0.15 + erosion + cracks);
  }
  terrainPos.needsUpdate = true;
  terrain.geometry.computeVertexNormals();
  terrain.rotation.x = -Math.PI / 2;
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  root.add(terrain);

  // === FRAGMENTED WATER POOLS ===
  // Pool 1: Shrinking main wetland (center)
  const pool1 = new THREE.Mesh(
    new THREE.CircleGeometry(18, 32),
    new THREE.MeshStandardMaterial({
      color: 0x6B8FC7,
      roughness: 0.3,
      metalness: 0.2
    })
  );
  pool1.rotation.x = -Math.PI / 2;
  pool1.position.set(0, 0.05, -5);
  pool1.receiveShadow = true;
  root.add(pool1);

  // Pool 2: Stagnant water (left)
  const pool2 = new THREE.Mesh(
    new THREE.CircleGeometry(8, 24),
    new THREE.MeshStandardMaterial({
      color: 0x5a7a9f,
      roughness: 0.6,
      metalness: 0.05
    })
  );
  pool2.rotation.x = -Math.PI / 2;
  pool2.position.set(-25, 0.02, 10);
  pool2.receiveShadow = true;
  root.add(pool2);

  // Pool 3: Disconnected pool (right)
  const pool3 = new THREE.Mesh(
    new THREE.CircleGeometry(6, 20),
    new THREE.MeshStandardMaterial({
      color: 0x4a6a7f,
      roughness: 0.7,
      metalness: 0.01
    })
  );
  pool3.rotation.x = -Math.PI / 2;
  pool3.position.set(28, 0.02, -15);
  pool3.receiveShadow = true;
  root.add(pool3);

  // === DEAD VEGETATION PATCHES ===
  const deadVegMat = new THREE.MeshStandardMaterial({
    color: 0x7a6a4a,
    roughness: 0.92,
    metalness: 0
  });

  // Patch 1: Dead reeds left
  const deadPatch1 = new THREE.Mesh(
    new THREE.PlaneGeometry(35, 45),
    deadVegMat
  );
  deadPatch1.rotation.x = -Math.PI / 2;
  deadPatch1.position.set(-35, 0.04, 25);
  deadPatch1.receiveShadow = true;
  root.add(deadPatch1);

  // Patch 2: Dead vegetation right
  const deadPatch2 = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 40),
    deadVegMat
  );
  deadPatch2.rotation.x = -Math.PI / 2;
  deadPatch2.position.set(40, 0.04, -20);
  deadPatch2.receiveShadow = true;
  root.add(deadPatch2);

  // === EVAPORATION PARTICLES ===
  const particleCount = 200;
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  
  for (let i = 0; i < particleCount; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 80;
    positions[i * 3 + 1] = Math.random() * 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    
    velocities[i * 3] = (Math.random() - 0.5) * 0.08;
    velocities[i * 3 + 1] = 0.05 + Math.random() * 0.04;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMaterial = new THREE.PointsMaterial({
    color: 0xd4c9b8,
    size: 0.08,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    sizeAttenuation: true
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  root.add(particles);

  // Store velocities for animation
  root.userData.evaporationVelocities = velocities;
  root.userData.evaporationParticles = particles;
  root.userData.evaporationCycleTime = 0;

  // === CRACKED SOIL VISUALIZATION ===
  for (let i = 0; i < 15; i += 1) {
    const crack = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3((Math.random() - 0.5) * 100, 0.08, (Math.random() - 0.5) * 100),
        new THREE.Vector3((Math.random() - 0.5) * 100, 0.08, (Math.random() - 0.5) * 100)
      ]),
      new THREE.LineBasicMaterial({ color: 0x8a7a5a, linewidth: 2, transparent: true, opacity: 0.5 })
    );
    root.add(crack);
  }

  // === STRUGGLING HERDER WITH CATTLE ===
  const herder = createNiloticHuman({
    group: 'Dinka',
    role: 'carrier',
    direction: 1
  });
  herder.position.set(35, 0, -25);
  herder.scale.setScalar(1.3);
  
  // Pose: searching/walking
  if (herder.userData) {
    if (herder.userData.leftLeg) herder.userData.leftLeg.rotation.x = 0.6;
    if (herder.userData.rightLeg) herder.userData.rightLeg.rotation.x = -0.4;
    if (herder.userData.leftArm) herder.userData.leftArm.rotation.x = 0.3;
    if (herder.userData.rightArm) herder.userData.rightArm.rotation.x = -0.2;
  }
  
  herder.userData.interactive = true;
  herder.userData.dialogue = [
    "The wetland shrinks every season now.",
    "My cattle have less to drink, less grazing land. What will become of us?"
  ];
  herder.userData.dialogueId = 'scene6-herder';
  herder.userData.baseY = herder.position.y;
  root.add(herder);

  // === SPARSE REMAINING CATTLE ===
  for (let i = 0; i < 3; i += 1) {
    const cow = createNiloticHuman({
      group: 'Nuer',
      role: 'fisher',
      direction: -1
    });
    cow.scale.setScalar(0.8);
    cow.position.set(32 + i * 4, 0, -30 + Math.random() * 5);
    
    // Slouched posture - exhausted
    if (cow.userData) {
      if (cow.userData.leftLeg) cow.userData.leftLeg.rotation.x = 0.2;
      if (cow.userData.rightLeg) cow.userData.rightLeg.rotation.x = -0.2;
    }
    
    cow.userData.interactive = true;
    cow.userData.dialogue = [
      "The dry season lasts longer now.",
      "We are starving."
    ];
    cow.userData.dialogueId = `scene6-cow-${i}`;
    root.add(cow);
  }

  // === ENVIRONMENTAL MARKERS ===
  // Temperature gauge (visual indicator)
  const thermometer = new THREE.Group();
  const thermometerBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 2.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xc0504d, roughness: 0.4, metalness: 0.3 })
  );
  thermometer.add(thermometerBase);
  thermometer.position.set(-40, 0, 25);
  thermometer.userData.interactive = true;
  thermometer.userData.dialogue = [
    "30°C - A 2-4°C rise from before canal construction.",
    "The microclimate has shifted, drying out the region."
  ];
  thermometer.userData.dialogueId = 'scene6-temperature';
  root.add(thermometer);

  // Humidity gauge
  const humidityMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x70ad47, roughness: 0.5, metalness: 0.2 })
  );
  humidityMarker.position.set(45, 1.5, 20);
  humidityMarker.userData.interactive = true;
  humidityMarker.userData.dialogue = [
    "Humidity: 62% - down 15-20% from seasonal peaks.",
    "The sponge no longer holds water. It releases it all at once."
  ];
  humidityMarker.userData.dialogueId = 'scene6-humidity';
  root.add(humidityMarker);

  // === LIGHTING ===
  const sunLight = new THREE.DirectionalLight(0xf5d99b, 0.8);
  sunLight.position.set(35, 30, 25);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.left = -80;
  sunLight.shadow.camera.right = 80;
  sunLight.shadow.camera.top = 80;
  sunLight.shadow.camera.bottom = -80;
  root.add(sunLight);

  const ambientLight = new THREE.AmbientLight(0xb8a88a, 0.5);
  root.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xd4a574, 0x8a7355, 0.45);
  root.add(hemiLight);

  // === FOG (Hot, hazy atmosphere) ===
  if (scene) {
    scene.fog = new THREE.Fog(0xc9b8a0, 12, 80);
  }

  return {
    root,
    herder,
    pools: [pool1, pool2, pool3],
    particles,
    evaporationActive: true
  };
}

function applyScene3Environment() {
  scene3Runtime = buildScene4System();
  scene.add(scene3Runtime.root);
  sceneObjects['scene4-root'] = scene3Runtime.root;
  scene.fog = new THREE.Fog(0x9b8a72, 10, 60);
}

function updateScene4(deltaSeconds, elapsedTime) {
  if (!scene3Runtime) {
    return;
  }

  const cycleDurationSeconds = 58;
  const stressProgress = (elapsedTime % cycleDurationSeconds) / cycleDurationSeconds;

  if (Array.isArray(scene3Runtime.characters)) {
    scene3Runtime.characters.forEach((character, idx) => {
      if (!character?.position) {
        return;
      }
      if (!Number.isFinite(character.userData?.scene4BaseY)) {
        character.userData.scene4BaseY = character.position.y;
      }
      const baseY = character.userData.scene4BaseY;
      character.rotation.y += Math.sin(elapsedTime * 0.5 + idx * 0.3) * 0.002;
      character.position.y = baseY + Math.sin(elapsedTime * 1.2 + idx * 0.4) * 0.005;
    });
  }

  if (
    Array.isArray(scene3Runtime.vegetationPatches)
    && Array.isArray(scene3Runtime.vegetationStateDefs)
    && scene3Runtime.vegetationStateDefs.length === 4
  ) {
    scene3Runtime.vegetationPatches.forEach((patchData, idx) => {
      const localOffset = patchData.patch?.userData?.stateBias || 0;
      const nearWater = patchData.patch?.userData?.nearWaterFactor || 0;
      const localStress = clamp(
        stressProgress + localOffset + Math.sin(elapsedTime * 0.11 + idx * 0.8) * 0.04,
        0,
        1
      );
      const blend = getFourStateBlend(localStress);
      const from = scene3Runtime.vegetationStateDefs[blend.index];
      const to = scene3Runtime.vegetationStateDefs[blend.nextIndex];

      const density = lerp(from.density, to.density, blend.t);
      const grassHeight = lerp(from.grassHeight, to.grassHeight, blend.t);
      const grassLean = lerp(from.grassLean, to.grassLean, blend.t);
      const bareOpacity = lerp(from.bareOpacity, to.bareOpacity, blend.t);
      const moistOpacity = lerp(from.moistOpacity, to.moistOpacity, blend.t);
      const cropHeight = lerp(from.cropHeight, to.cropHeight, blend.t);
      const cropLean = lerp(from.cropLean, to.cropLean, blend.t);
      const cropPresence = lerp(from.cropPresence, to.cropPresence, blend.t);

      const grassColor = new THREE.Color(from.grassColor).lerp(new THREE.Color(to.grassColor), blend.t);
      const soilColor = new THREE.Color(from.soilColor).lerp(new THREE.Color(to.soilColor), blend.t);

      if (patchData.moistDisk?.material) {
        patchData.moistDisk.material.opacity = moistOpacity * (1 - nearWater * 0.35);
        patchData.moistDisk.material.color.copy(soilColor);
      }
      if (patchData.barePatch?.material) {
        patchData.barePatch.material.opacity = bareOpacity + nearWater * 0.08;
        patchData.barePatch.material.color.copy(soilColor);
      }

      patchData.blades.forEach((blade) => {
        if (!blade?.material) {
          return;
        }
        const baseHeight = blade.userData?.baseHeight || 0.45;
        const resilience = blade.userData?.resilience || 0;
        const bendPhase = blade.userData?.bendPhase || 0;
        const survives = density - resilience * 0.75 > patchData.dryThreshold - nearWater * 0.1;
        blade.visible = survives;
        if (!survives) {
          return;
        }
        blade.scale.y = Math.max(0.22, grassHeight * (0.85 + resilience * 0.25));
        blade.position.y = (baseHeight * blade.scale.y) * 0.5;
        blade.rotation.z = grassLean * (0.28 + resilience * 0.24) + Math.sin(elapsedTime * 0.7 + bendPhase) * 0.08;
        blade.material.color.copy(grassColor);
      });

      if (patchData.crop) {
        patchData.crop.visible = cropPresence > 0.1;
        if (patchData.crop.visible) {
          patchData.crop.scale.y = cropHeight;
          patchData.crop.rotation.z = cropLean * (0.35 + nearWater * 0.2);
          if (patchData.stem?.material) {
            patchData.stem.material.color.copy(soilColor);
          }
          if (patchData.wiltHead?.material) {
            patchData.wiltHead.material.color.copy(
              grassColor.clone().lerp(new THREE.Color(0x8f8879), clamp(localStress * 0.8, 0, 1))
            );
          }
          patchData.sideShoots.forEach((shoot, shootIdx) => {
            if (!shoot?.material) {
              return;
            }
            shoot.visible = cropPresence > (0.2 + shootIdx * 0.12);
            shoot.material.color.copy(soilColor);
          });
        }
      }
    });
  }

  if (Array.isArray(scene3Runtime.weakCows)) {
    scene3Runtime.weakCows.forEach((cow, idx) => {
      if (!cow?.position) {
        return;
      }
      cow.position.x += Math.cos(elapsedTime * 0.3 + idx) * 0.02 * deltaSeconds;
      cow.position.z += Math.sin(elapsedTime * 0.2 + idx) * 0.02 * deltaSeconds;
    });
  }

  if (
    Array.isArray(scene3Runtime.waterBodies)
    && Array.isArray(scene3Runtime.waterStateDefs)
    && scene3Runtime.waterStateDefs.length === 4
  ) {
    scene3Runtime.waterBodies.forEach((body, idx) => {
      if (!body?.pool?.material || !body.mudRim?.material || !body.surfaceFilm?.material) {
        return;
      }

      const localStress = clamp(
        stressProgress + (body.stateBias || 0) + Math.sin(elapsedTime * 0.09 + idx * 0.65) * 0.04,
        0,
        1
      );
      const blend = getFourStateBlend(localStress);
      const from = scene3Runtime.waterStateDefs[blend.index];
      const to = scene3Runtime.waterStateDefs[blend.nextIndex];

      const waterColor = new THREE.Color(from.color).lerp(new THREE.Color(to.color), blend.t);
      const roughness = lerp(from.roughness, to.roughness, blend.t);
      const metalness = lerp(from.metalness, to.metalness, blend.t);
      const opacity = lerp(from.opacity, to.opacity, blend.t);
      const ripple = lerp(from.ripple, to.ripple, blend.t);
      const film = lerp(from.film, to.film, blend.t);
      const debris = lerp(from.debris, to.debris, blend.t);
      const algae = lerp(from.algae, to.algae, blend.t);
      const rim = lerp(from.rim, to.rim, blend.t);
      const waterlogged = lerp(from.waterlogged, to.waterlogged, blend.t);

      body.pool.material.color.copy(waterColor);
      body.pool.material.roughness = roughness;
      body.pool.material.metalness = metalness;
      body.pool.material.opacity = opacity + Math.sin(elapsedTime * 2.1 + idx * 0.7) * ripple * 0.15;

      const rippleScaleX = 1 + Math.sin(elapsedTime * 1.8 + idx * 0.6) * ripple;
      const rippleScaleY = 1 + Math.cos(elapsedTime * 1.5 + idx * 0.5) * ripple * 0.8;
      body.pool.scale.set(rippleScaleX, rippleScaleY, 1);

      body.surfaceFilm.material.opacity = film;
      body.surfaceFilm.material.color.copy(
        waterColor.clone().lerp(new THREE.Color(0x8f9588), clamp(localStress * 0.9, 0, 1))
      );

      body.mudRim.material.opacity = rim;
      body.mudRim.material.color.copy(new THREE.Color(0x5f503d).lerp(new THREE.Color(0x4b4338), localStress));

      body.waterloggedZone.material.opacity = waterlogged;
      body.debrisPieces.forEach((piece, pieceIdx) => {
        if (!piece?.material) {
          return;
        }
        piece.material.opacity = debris * (0.45 + ((pieceIdx % 3) * 0.15));
      });

      body.algaeMaterials.forEach((mat, matIdx) => {
        mat.opacity = algae * (0.35 + (matIdx % 2) * 0.2);
      });

      body.edgeGrass.forEach((blade) => {
        if (!blade?.material) {
          return;
        }
        const surviveThreshold = 0.25 + localStress * 0.65;
        const resilience = blade.userData?.resilience || 0;
        blade.visible = resilience > surviveThreshold;
        if (!blade.visible) {
          return;
        }
        const baseHeight = blade.userData?.baseHeight || 0.3;
        const baseGroundY = blade.userData?.baseGroundY || blade.position.y;
        blade.scale.y = lerp(1, 0.42, localStress);
        blade.position.y = baseGroundY + (baseHeight * blade.scale.y) * 0.5;
        blade.material.color.copy(
          new THREE.Color(0x6f7751).lerp(new THREE.Color(0x8e866d), clamp(localStress * 0.8, 0, 1))
        );
      });
    });
  }

  if (Array.isArray(scene3Runtime.muddyFootprints)) {
    scene3Runtime.muddyFootprints.forEach((footprint, idx) => {
      if (!footprint?.material) {
        return;
      }
      const pulse = Math.sin(elapsedTime * 0.7 + idx * 0.4) * 0.015;
      footprint.material.opacity = 0.06 + clamp(stressProgress * 0.12, 0, 0.12) + pulse;
    });
  }

  if (Array.isArray(scene3Runtime.snailClusters)) {
    scene3Runtime.snailClusters.forEach((cluster, idx) => {
      if (!cluster) {
        return;
      }
      const baseY = Number.isFinite(cluster.userData?.baseY)
        ? cluster.userData.baseY
        : cluster.position.y;
      cluster.position.y = baseY + Math.sin(elapsedTime * 1.7 + idx * 0.4) * 0.012;
    });
  }

  if (Array.isArray(scene3Runtime.deadFish)) {
    scene3Runtime.deadFish.forEach((fish, idx) => {
      if (!fish?.position) {
        return;
      }
      const baseY = Number.isFinite(fish.userData?.flopBaseY) ? fish.userData.flopBaseY : fish.position.y;
      const seed = fish.userData?.flopSeed || 0;
      const pollutionBias = fish.userData?.pollutionBias || 0.5;
      const contamination = clamp(stressProgress + pollutionBias - 0.55, 0, 1);
      fish.visible = contamination > 0.08;
      fish.position.y = baseY + Math.sin(elapsedTime * 0.35 + seed + idx * 0.2) * 0.002;
      fish.rotation.x = (fish.userData?.flopBaseRotX || 0) + Math.sin(elapsedTime * 0.35 + seed) * 0.004;
      fish.rotation.z = (fish.userData?.flopBaseRotZ || fish.rotation.z) + Math.sin(elapsedTime * 0.22 + seed) * 0.003;
    });
  }
}

function updateScene5(deltaSeconds, elapsedTime) {
  if (!scene4Runtime) return;

  // Gently sway the South Sudan flag
  if (Array.isArray(scene4Runtime.flags)) {
    scene4Runtime.flags.forEach((flag, idx) => {
      if (flag.position) {
        flag.position.x += Math.sin(elapsedTime * 2 + idx * 0.5) * 0.001;
        flag.position.z += Math.cos(elapsedTime * 1.7 + idx * 0.5) * 0.001;
      }
    });
  }

  // Subtle crowd bob
  if (Array.isArray(scene4Runtime.crowd)) {
    scene4Runtime.crowd.forEach((person) => {
      if (!person.userData.baseY) person.userData.baseY = person.position.y;
      person.position.y = person.userData.baseY + Math.sin(elapsedTime * 2.5 + person.id) * 0.005;
    });
  }

  // Rotate suspended rocks slowly
  if (Array.isArray(scene4Runtime.rocks)) {
    scene4Runtime.rocks.forEach(rock => {
      rock.rotation.y += deltaSeconds * 0.2;
      rock.rotation.x += deltaSeconds * 0.15;
    });
  }

  // Animate dust near excavator
  if (scene4Runtime.dust) {
    const pos = scene4Runtime.dust.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] += deltaSeconds * 0.3;
      if (pos[i + 1] > 6) pos[i + 1] = 2.5;
    }
    scene4Runtime.dust.geometry.attributes.position.needsUpdate = true;
  }
}

function updateScene6(deltaSeconds, elapsedTime) {
  if (!scene5Runtime) return;

  // Animate evaporation particles (rising moisture)
  if (scene5Runtime.evaporationParticles && scene5Runtime.evaporationVelocities) {
    const positions = scene5Runtime.evaporationParticles.geometry.attributes.position.array;
    const velocities = scene5Runtime.evaporationVelocities;
    const particleCount = velocities.length / 3;

    for (let i = 0; i < particleCount; i += 1) {
      const idx = i * 3;
      
      // Update position
      positions[idx] += velocities[idx] * deltaSeconds * 8;
      positions[idx + 1] += velocities[idx + 1] * deltaSeconds * 8;
      positions[idx + 2] += velocities[idx + 2] * deltaSeconds * 8;

      // Reset particles when they reach top
      if (positions[idx + 1] > 3) {
        positions[idx] = (Math.random() - 0.5) * 80;
        positions[idx + 1] = 0.1;
        positions[idx + 2] = (Math.random() - 0.5) * 80;
      }
    }

    scene5Runtime.evaporationParticles.geometry.attributes.position.needsUpdate = true;
  }

  // Subtle herder walking animation
  if (scene5Runtime.herder && scene5Runtime.herder.userData) {
    scene5Runtime.herder.userData.baseY = scene5Runtime.herder.userData.baseY || scene5Runtime.herder.position.y;
    scene5Runtime.herder.position.y = scene5Runtime.herder.userData.baseY + Math.sin(elapsedTime * 3) * 0.02;
  }
}

function clearScene3Environment() {
  if (!scene3Runtime) {
    return;
  }

  scene.remove(scene3Runtime.root);
  disposeObject3D(scene3Runtime.root);
  delete sceneObjects['scene4-root'];
  scene.fog = scene3Runtime.previousFog || new THREE.FogExp2(0xd7e7ef, 0.005);
  scene3Runtime = null;
}

function clearScene2Environment() {
  if (!scene2Runtime) {
    return;
  }

  scene.remove(scene2Runtime.root);
  disposeObject3D(scene2Runtime.root);
  scene.fog = scene2Runtime.previousFog || new THREE.FogExp2(0xd7e7ef, 0.005);
  scene2Runtime = null;
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

  const usingExternalContext = !!(externalThreeContext?.scene && externalThreeContext?.camera && externalThreeContext?.renderer);

  if (usingExternalContext) {
    scene = externalThreeContext.scene;
    camera = externalThreeContext.camera;
    renderer = externalThreeContext.renderer;
    canvas = externalThreeContext.canvas || renderer.domElement;
    scene.background = new THREE.Color(0x1a2a3a);
    scene.fog = new THREE.FogExp2(0xd7e7ef, 0.005);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
  } else {
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
  }

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
  scene0Controls.enabled = true;
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

  if (renderer?.domElement) {
    renderer.domElement.addEventListener('pointerdown', handleScenePointerDown);
    renderer.domElement.addEventListener('pointermove', handleScenePointerMove);
    renderer.domElement.addEventListener('pointerleave', handleScenePointerLeave);
  }

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
  } else if (currentSceneIndex === 2 && scene2Runtime?.crowdManager) {
    scene2Runtime.crowdManager.update(elapsedTime);
  } else if (currentSceneIndex === 3 && scene3Runtime) {
    updateScene4(deltaSeconds, elapsedTime);
  } else if (currentSceneIndex === 4 && scene4Runtime) {
    updateScene5(deltaSeconds, elapsedTime);
  } else if (currentSceneIndex === 5 && scene5Runtime) {
    updateScene6(deltaSeconds, elapsedTime);
  }

  updateWeatherEffects(deltaSeconds, elapsedTime);

  if (scene0Controls && !isTransitioning) {
    scene0Controls.update();
  }

  renderer.render(scene, camera);
}

function getDialogueTargetFromPointerEvent(event) {
  const searchRoots = [];
  if (currentSceneIndex === 2 && scene2Runtime?.root) {
    searchRoots.push(scene2Runtime.root);
  }
  if (currentSceneIndex === 3 && scene3Runtime?.root) {
    searchRoots.push(scene3Runtime.root);
  }
  if (currentSceneIndex === 4 && scene4Runtime?.root) {
    searchRoots.push(scene4Runtime.root);
  }
  if (currentSceneIndex === 5 && scene5Runtime?.root) {
    searchRoots.push(scene5Runtime.root);
  }

  if (!scene || !camera || !renderer?.domElement || searchRoots.length < 1) {
    return null;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  const pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const pointerY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

  sceneClickPointer.set(pointerX, pointerY);
  sceneClickRaycaster.setFromCamera(sceneClickPointer, camera);

  for (const root of searchRoots) {
    const hits = sceneClickRaycaster.intersectObjects(root.children, true);
    for (let i = 0; i < hits.length; i += 1) {
      let target = hits[i].object;
      while (target && !Array.isArray(target.userData?.dialogue)) {
        target = target.parent;
      }

      if (target && Array.isArray(target.userData.dialogue)) {
        return target;
      }
    }
  }

  return null;
}

function handleScenePointerDown(event) {
  const target = getDialogueTargetFromPointerEvent(event);
  if (target) {
    selectPersonWithDialogue(target.userData.dialogueId || target.uuid, target.userData.dialogue.join('\n'));
    setHoveredPerson(target.userData.dialogueId || target.uuid);
  }
}

function handleScenePointerMove(event) {
  const target = getDialogueTargetFromPointerEvent(event);
  hoveredDialogueTarget = target;

  if (renderer?.domElement) {
    renderer.domElement.style.cursor = target ? 'pointer' : 'default';
  }

  setHoveredPerson(target ? (target.userData.dialogueId || target.uuid) : null);
}

function handleScenePointerLeave() {
  hoveredDialogueTarget = null;
  if (renderer?.domElement) {
    renderer.domElement.style.cursor = 'default';
  }
  setHoveredPerson(null);
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

  if (scene2Runtime && sceneData.id !== 2) {
    clearScene2Environment();
  }

  if (scene3Runtime && sceneData.id !== 3) {
    clearScene3Environment();
  }

  if (scene4Runtime && sceneData.id !== 4) {
    scene.remove(scene4Runtime.root);
    disposeObject3D(scene4Runtime.root);
    scene4Runtime = null;
  }

  if (scene5Runtime && sceneData.id !== 5) {
    scene.remove(scene5Runtime.root);
    disposeObject3D(scene5Runtime.root);
    scene5Runtime = null;
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

  if (incomingSceneIndex === 2 && !scene2Runtime) {
    applyScene2Environment();
  }

  if (incomingSceneIndex === 3 && !scene3Runtime) {
    applyScene3Environment();
  }

  currentSceneIndex = incomingSceneIndex;

  // Set camera position and target
  let { pos, target } = sceneData.camera;
  if (incomingSceneIndex === 2) {
    // Human-height viewpoint inside the protest crowd, looking toward the military line.
    pos = [-5.4, 1.7, -4.0];
    target = [-4.0, 1.55, -19.6];
  } else if (incomingSceneIndex === 3) {
    pos = [-20, 12, -30];
    target = [0, 2, 0];
  } else if (incomingSceneIndex === 4) {
    pos = [-25, 14, -35];
    target = [0, 2, 5];
  } else if (incomingSceneIndex === 5) {
    pos = [40, 35, 50];
    target = [5, 0, 5];
  }
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
      // Scene 2, Scene 3, Scene 4, and Scene 5 use fully custom runtime environments.
      // Skip base terrain/water props there to avoid duplicate planes and placeholder blocks.
      if ((incomingSceneIndex === 2 || incomingSceneIndex === 3 || incomingSceneIndex === 4 || incomingSceneIndex === 5) && (objDef.type === 'terrain' || objDef.type === 'water' || objDef.type === 'props')) {
        return;
      }

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
    } else if (incomingSceneIndex === 4) {
      scene4Runtime = buildScene5System();
      scene.add(scene4Runtime.root);
      sceneObjects['scene4-root'] = scene4Runtime.root;
    } else if (incomingSceneIndex === 5) {
      scene5Runtime = buildScene6System();
      scene.add(scene5Runtime.root);
      sceneObjects['scene5-root'] = scene5Runtime.root;
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
        } else if (currentSceneIndex === 2) {
          scene0Controls.minDistance = 2.2;
          scene0Controls.maxDistance = 12;
          scene0Controls.target.set(-4.0, 1.55, -19.6);
        } else if (currentSceneIndex === 3) {
          scene0Controls.minDistance = 8;
          scene0Controls.maxDistance = 50;
          scene0Controls.target.set(0, 2, 0);
        } else if (currentSceneIndex === 4) {
          scene0Controls.minDistance = 5;
          scene0Controls.maxDistance = 55;
          scene0Controls.target.set(0, 2, 5);
        } else if (currentSceneIndex === 5) {
          scene0Controls.minDistance = 20;
          scene0Controls.maxDistance = 80;
          scene0Controls.target.set(5, 0, 5);
        } else {
          scene0Controls.minDistance = 6;
          scene0Controls.maxDistance = 90;
          scene0Controls.target.copy(endTarget);
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
  if (renderer?.domElement) {
    renderer.domElement.removeEventListener('pointerdown', handleScenePointerDown);
    renderer.domElement.removeEventListener('pointermove', handleScenePointerMove);
    renderer.domElement.removeEventListener('pointerleave', handleScenePointerLeave);
    renderer.domElement.style.cursor = 'default';
  }
  hoveredDialogueTarget = null;
  setHoveredPerson(null);
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