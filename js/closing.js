import * as THREE from 'three';

const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaec3d6);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 34);

const ambient = new THREE.AmbientLight(0xffffff, 0.92);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff5d0, 1.55);
sun.position.set(10, 22, 12);
sun.castShadow = true;
scene.add(sun);

const glow = new THREE.PointLight(0xf0c36b, 1.2, 120);
glow.position.set(0, 18, 10);
scene.add(glow);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(220, 120),
  new THREE.MeshStandardMaterial({ color: 0x5f7d49, roughness: 0.95 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.z = 12;
floor.receiveShadow = true;
scene.add(floor);

const water = new THREE.Mesh(
  new THREE.PlaneGeometry(420, 200, 32, 32),
  new THREE.MeshStandardMaterial({
    color: 0x31536e,
    roughness: 0.12,
    metalness: 0.2,
    transparent: true,
    opacity: 0.82
  })
);
water.rotation.x = -Math.PI / 2;
water.position.set(0, -0.25, -42);
scene.add(water);

function createVictoryHero(type, waveDirection = 1) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a1b0a, roughness: 0.38 });
  const hatMat = new THREE.MeshStandardMaterial({ color: type === 'fisher' ? 0x99b7c9 : 0xbc9b6a });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.45, 3.2, 16), bodyMat);
  torso.position.y = 1.6;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 24), bodyMat);
  head.position.y = 3.62;
  group.add(head);

  const hat = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.8, 16), hatMat);
  hat.position.y = 4.12;
  group.add(hat);

  const wavingArm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.4, 8), bodyMat);
  wavingArm.position.set(0.9 * waveDirection, 2.8, 0);
  wavingArm.rotation.z = waveDirection > 0 ? -Math.PI / 2.9 : Math.PI / 2.9;
  group.add(wavingArm);

  const supportArm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.1, 8), bodyMat);
  supportArm.position.set(-0.86 * waveDirection, 2.6, 0);
  supportArm.rotation.z = waveDirection > 0 ? Math.PI / 5.8 : -Math.PI / 5.8;
  group.add(supportArm);

  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 2.2, 8), bodyMat);
  legL.position.set(-0.4, 0, 0);
  group.add(legL);

  const legR = legL.clone();
  legR.position.x = 0.4;
  group.add(legR);

  group.userData = {
    wavingArm,
    waveDirection,
    bobOffset: Math.random() * Math.PI * 2,
    type
  };

  return group;
}

function createCow(color = 0xefeee8) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xd2c4a7 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.85), bodyMat);
  body.position.y = 1.0;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.55), bodyMat);
  head.position.set(1.1, 1.3, 0);
  group.add(head);

  const hornL = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 16, Math.PI), hornMat);
  hornL.position.set(1.1, 1.7, 0.25);
  hornL.rotation.z = Math.PI / 2;
  group.add(hornL);

  const hornR = hornL.clone();
  hornR.position.z = -0.25;
  group.add(hornR);

  const legGeom = new THREE.CylinderGeometry(0.12, 0.12, 1.0, 8);
  [[-0.6, 0.5, 0.35], [-0.6, 0.5, -0.35], [0.6, 0.5, 0.35], [0.6, 0.5, -0.35]].forEach((pos) => {
    const leg = new THREE.Mesh(legGeom, bodyMat);
    leg.position.set(...pos);
    group.add(leg);
  });

  return group;
}

const heroes = [
  createVictoryHero('farmer', 1),
  createVictoryHero('fisher', -1),
  createVictoryHero('farmer', 1),
  createVictoryHero('fisher', -1)
];

heroes[0].position.set(-18, 1.1, 2);
heroes[1].position.set(-6, 1.1, 10);
heroes[2].position.set(6, 1.1, 10);
heroes[3].position.set(18, 1.1, 2);
heroes[0].rotation.y = Math.PI / 12;
heroes[1].rotation.y = -Math.PI / 18;
heroes[2].rotation.y = Math.PI / 18;
heroes[3].rotation.y = -Math.PI / 12;
heroes.forEach((hero) => scene.add(hero));

const cattle = [];
const cattleStartPos = [
  [-14, 0, 4], [-16, 0, -5],
  [14, 0, 4], [16, 0, -5],
  [-12, 0, -8], [12, 0, -8]
];

cattleStartPos.forEach((pos, index) => {
  const cow = createCow(index % 2 === 0 ? 0xf0f0f0 : 0x7a5a3a);
  cow.position.set(...pos);
  cow.rotation.y = Math.random() * Math.PI * 2;
  cow.scale.setScalar(0.9 + Math.random() * 0.2);
  cow.userData = {
    speed: 0.012 + Math.random() * 0.016,
    angle: cow.rotation.y,
    bobOffset: Math.random() * Math.PI * 2
  };
  scene.add(cow);
  cattle.push(cow);
});

const confetti = [];
const confettiColors = [0xf0c36b, 0x6ce08f, 0xffffff, 0x99b7c9];
for (let i = 0; i < 42; i += 1) {
  const piece = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.08, 0.25),
    new THREE.MeshStandardMaterial({ color: confettiColors[i % confettiColors.length], roughness: 0.5 })
  );
  piece.position.set((Math.random() - 0.5) * 80, 5 + Math.random() * 18, -10 + Math.random() * 20);
  piece.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  piece.userData = {
    driftX: (Math.random() - 0.5) * 0.08,
    driftY: 0.16 + Math.random() * 0.22,
    driftZ: (Math.random() - 0.5) * 0.03,
    spin: (Math.random() - 0.5) * 0.08,
    baseHeight: 5 + Math.random() * 18
  };
  scene.add(piece);
  confetti.push(piece);
}

const bubble = document.getElementById('ending-speech');
const heroFocus = heroes[1];

function showDialogue() {
  if (!bubble || !heroFocus) {
    return;
  }

  const vector = new THREE.Vector3();
  heroFocus.getWorldPosition(vector);
  vector.y += 5.7;
  vector.project(camera);

  const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
  const y = (vector.y * -0.5 + 0.5) * window.innerHeight;

  bubble.style.left = `${x}px`;
  bubble.style.top = `${y}px`;
  bubble.style.transform = 'translate(-50%, -100%)';
  bubble.style.display = 'block';
}

window.setTimeout(showDialogue, 900);

function animate(time) {
  requestAnimationFrame(animate);
  const t = time * 0.001;

  heroes.forEach((hero, index) => {
    const waveArm = hero.userData.wavingArm;
    const baseWave = hero.userData.waveDirection > 0 ? -Math.PI / 2.9 : Math.PI / 2.9;

    hero.position.y = 1.1 + Math.sin(t * 1.7 + hero.userData.bobOffset) * 0.08;
    hero.rotation.y += Math.sin(t * 0.7 + index) * 0.0005;

    if (waveArm) {
      waveArm.rotation.z = baseWave + Math.sin(t * 4.8 + hero.userData.bobOffset) * 0.28;
    }
  });

  cattle.forEach((cow, index) => {
    cow.position.x += Math.cos(cow.userData.angle) * cow.userData.speed;
    cow.position.z -= Math.sin(cow.userData.angle) * cow.userData.speed;
    cow.position.y = Math.abs(Math.sin(t * 3.4 + cow.userData.bobOffset)) * 0.05;
    cow.rotation.x = Math.sin(t * 3.2 + index) * 0.045;

    const limitX = 25;
    const limitZ = 15;
    if (Math.abs(cow.position.x) > limitX || Math.abs(cow.position.z) > limitZ) {
      cow.userData.angle += Math.PI;
      cow.rotation.y = cow.userData.angle;
    }
  });

  confetti.forEach((piece, index) => {
    piece.position.x += piece.userData.driftX;
    piece.position.y -= piece.userData.driftY * 0.04;
    piece.position.z += piece.userData.driftZ;
    piece.rotation.x += piece.userData.spin;
    piece.rotation.y += piece.userData.spin * 0.8;
    piece.rotation.z += piece.userData.spin * 1.2;

    if (piece.position.y < -1.5) {
      piece.position.x = (Math.random() - 0.5) * 80;
      piece.position.y = piece.userData.baseHeight + (index % 4);
      piece.position.z = -12 + Math.random() * 24;
    }
  });

  const pos = water.geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    pos.setZ(i, Math.sin(t * 0.55 + i * 0.3) * 0.09);
  }
  pos.needsUpdate = true;

  renderer.render(scene, camera);
}

animate(0);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
