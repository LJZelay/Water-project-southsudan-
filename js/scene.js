import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { featureTier } from "./utils.js";

export function createScene(containerId = "three-container") {
  const container = document.getElementById(containerId);
  const tier = featureTier();

  if (tier === "tier-c") {
    container.innerHTML = "<div class=\"scene-fallback\"><p>3D mode unavailable. Scroll narrative remains active.</p></div>";
    return { update: () => {}, setSite: () => {}, destroy: () => {} };
  }

  const renderer = new THREE.WebGLRenderer({ antialias: tier === "tier-a", alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier === "tier-a" ? 1.7 : 1.2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x123548, 1);
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x17384a, 30, 95);

  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 240);
  camera.position.set(-10, 15, 34);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableRotate = tier === "tier-a";
  controls.enableDamping = true;
  controls.enabled = false;

  const ambient = new THREE.AmbientLight(0xe8f6ff, 0.72);
  const sun = new THREE.DirectionalLight(0xfff4d4, 1.0);
  sun.position.set(18, 24, 10);
  scene.add(ambient, sun);

  const terrainGeo = new THREE.PlaneGeometry(58, 42, 46, 34);
  const p = terrainGeo.attributes.position;
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const y = p.getY(i);
    const n = Math.sin(x * 0.16) * 0.9 + Math.cos(y * 0.19) * 0.7 + Math.sin((x + y) * 0.11) * 0.5;
    p.setZ(i, n);
  }
  terrainGeo.computeVertexNormals();

  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({ color: 0x4b8b57, roughness: 0.95, metalness: 0.02 })
  );
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -2.4;
  scene.add(terrain);

  const riverMaterial = new THREE.MeshStandardMaterial({ color: 0x2e91c7, transparent: true, opacity: 0.86 });
  const riverA = new THREE.Mesh(new THREE.PlaneGeometry(26, 4), riverMaterial);
  riverA.rotation.x = -Math.PI / 2;
  riverA.rotation.z = 0.18;
  riverA.position.set(-9, -1.6, -4);
  scene.add(riverA);

  const riverB = new THREE.Mesh(new THREE.PlaneGeometry(22, 3.5), riverMaterial.clone());
  riverB.rotation.x = -Math.PI / 2;
  riverB.rotation.z = -0.34;
  riverB.position.set(12, -1.56, 6);
  scene.add(riverB);

  const routeLine = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 0.65),
    new THREE.MeshBasicMaterial({ color: 0x63c5ff, transparent: true, opacity: 0 })
  );
  routeLine.rotation.x = -Math.PI / 2;
  routeLine.rotation.z = -0.2;
  routeLine.position.set(1, -1.45, 0);
  scene.add(routeLine);

  const routeFlags = new THREE.Group();
  for (let i = 0; i < 12; i += 1) {
    const flag = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.8, 5),
      new THREE.MeshStandardMaterial({ color: 0xf08d43 })
    );
    flag.position.set(-12 + i * 2.2, -1.1, -1 + Math.sin(i * 0.7) * 1.1);
    routeFlags.add(flag);
  }
  routeFlags.visible = false;
  scene.add(routeFlags);

  const siteMaterialA = new THREE.MeshStandardMaterial({ color: 0x6dd7a4, emissive: 0x0c281d, emissiveIntensity: 0.5 });
  const siteMaterialB = new THREE.MeshStandardMaterial({ color: 0x75bdf0, emissive: 0x12263d, emissiveIntensity: 0.3 });
  const siteA = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.8, 14), siteMaterialA);
  siteA.position.set(-7.4, -0.65, 1.8);
  const siteB = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.8, 14), siteMaterialB);
  siteB.position.set(8.1, -0.65, -1.6);
  siteA.visible = false;
  siteB.visible = false;
  scene.add(siteA, siteB);

  const constructionGroup = new THREE.Group();
  const trench = new THREE.Mesh(
    new THREE.BoxGeometry(24, 0.45, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x3b2a1f })
  );
  trench.rotation.y = -0.2;
  trench.position.set(2, -1.3, -0.5);
  constructionGroup.add(trench);

  const equipmentColor = new THREE.MeshStandardMaterial({ color: 0xd88a3b, roughness: 0.65 });
  for (let i = 0; i < 5; i += 1) {
    const machine = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.7), equipmentColor);
    machine.position.set(-8 + i * 4, -1, 2.2 + (i % 2 ? 0.9 : -0.7));
    constructionGroup.add(machine);
  }
  constructionGroup.visible = false;
  scene.add(constructionGroup);

  const dustClouds = new THREE.Group();
  for (let i = 0; i < 14; i += 1) {
    const dust = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xa58b6d, transparent: true, opacity: 0.35 })
    );
    dust.position.set(-8 + i * 1.4, -0.3, -0.2 + Math.sin(i) * 0.8);
    dustClouds.add(dust);
  }
  dustClouds.visible = false;
  scene.add(dustClouds);

  const ecoGroup = new THREE.Group();
  for (let i = 0; i < 5; i += 1) {
    const buffer = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x5cd47a, transparent: true, opacity: 0.65 })
    );
    buffer.rotation.x = -Math.PI / 2;
    buffer.position.set(-7 + i * 3.7, -1.35, 4.5 + (i % 2 ? 0.9 : -0.9));
    ecoGroup.add(buffer);

    const crossing = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.12, 8, 14),
      new THREE.MeshStandardMaterial({ color: 0x9fe8a6 })
    );
    crossing.rotation.x = Math.PI / 2;
    crossing.position.set(buffer.position.x, -0.8, buffer.position.z + 0.6);
    ecoGroup.add(crossing);
  }
  ecoGroup.visible = false;
  scene.add(ecoGroup);

  const economicGroup = new THREE.Group();
  const lockSystem = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 1.2, 2.8),
    new THREE.MeshStandardMaterial({ color: 0x8b8f96 })
  );
  lockSystem.position.set(10, -0.7, -6);
  economicGroup.add(lockSystem);

  for (let i = 0; i < 8; i += 1) {
    const warehouse = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.1, 1.5),
      new THREE.MeshStandardMaterial({ color: 0xb3a36e })
    );
    warehouse.position.set(3 + i * 1.8, -0.95, 8 + (i % 2 ? 1 : -1));
    economicGroup.add(warehouse);
  }

  const trucks = [];
  for (let i = 0; i < 6; i += 1) {
    const truck = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.4, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x2f2f2f })
    );
    truck.position.set(-8 + i * 2.8, -1.05, 10.5);
    trucks.push(truck);
    economicGroup.add(truck);
  }
  economicGroup.visible = false;
  scene.add(economicGroup);

  const floodOverlay = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 26),
    new THREE.MeshStandardMaterial({ color: 0x3e7ddf, transparent: true, opacity: 0 })
  );
  floodOverlay.rotation.x = -Math.PI / 2;
  floodOverlay.position.set(0, -1.15, 0);
  scene.add(floodOverlay);

  const bridgesGroup = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 0.3, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xcdc6aa })
    );
    bridge.rotation.y = -0.2;
    bridge.position.set(-9 + i * 6.4, -0.68, -0.5 + (i % 2 ? 3.2 : -3.1));
    bridgesGroup.add(bridge);
  }
  bridgesGroup.visible = false;
  scene.add(bridgesGroup);

  const cameraPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-18, 17, 36),
    new THREE.Vector3(-12, 14, 30),
    new THREE.Vector3(-4, 11, 22),
    new THREE.Vector3(7, 10, 18),
    new THREE.Vector3(12, 9, 14),
    new THREE.Vector3(8, 10, 16),
    new THREE.Vector3(-2, 12, 24),
    new THREE.Vector3(-20, 19, 40)
  ]);

  let targetProgress = 0;
  let currentProgress = 0;
  let activeStop = 0;
  let selectedSite = "A";
  let interactionUntil = 0;
  let frameId = null;

  const markInteraction = () => {
    if (tier !== "tier-a") {
      return;
    }
    interactionUntil = performance.now() + 1600;
  };

  renderer.domElement.addEventListener("pointerdown", markInteraction);
  renderer.domElement.addEventListener("wheel", markInteraction, { passive: true });

  const applyStopState = (stop) => {
    routeLine.material.opacity = stop >= 1 ? 0.8 : 0;
    routeFlags.visible = stop >= 2;
    constructionGroup.visible = stop >= 2;
    dustClouds.visible = stop === 2;
    ecoGroup.visible = stop >= 3;
    economicGroup.visible = stop >= 4;
    bridgesGroup.visible = stop >= 6;
    siteA.visible = stop >= 2;
    siteB.visible = stop >= 2;

    const aActive = selectedSite === "A";
    siteMaterialA.emissiveIntensity += ((aActive ? 0.95 : 0.35) - siteMaterialA.emissiveIntensity) * 0.12;
    siteMaterialB.emissiveIntensity += ((aActive ? 0.35 : 0.95) - siteMaterialB.emissiveIntensity) * 0.12;
    siteA.scale.y += ((aActive ? 1.3 : 1) - siteA.scale.y) * 0.14;
    siteB.scale.y += ((aActive ? 1 : 1.3) - siteB.scale.y) * 0.14;

    const floodTarget = stop >= 5 ? 0.28 : 0;
    floodOverlay.material.opacity += (floodTarget - floodOverlay.material.opacity) * 0.08;

    if (stop >= 6) {
      sun.color.lerp(new THREE.Color(0xffcb87), 0.06);
      scene.fog.color.lerp(new THREE.Color(0x5e5346), 0.06);
      terrain.material.color.lerp(new THREE.Color(0x6b8f52), 0.06);
    } else if (stop >= 5) {
      sun.color.lerp(new THREE.Color(0xfcd29b), 0.05);
      scene.fog.color.lerp(new THREE.Color(0x526378), 0.05);
      terrain.material.color.lerp(new THREE.Color(0x7a8659), 0.05);
    } else {
      sun.color.lerp(new THREE.Color(0xfff4d4), 0.05);
      scene.fog.color.lerp(new THREE.Color(0x17384a), 0.05);
      terrain.material.color.lerp(new THREE.Color(0x4b8b57), 0.05);
    }
  };

  const animate = () => {
    frameId = window.requestAnimationFrame(animate);

    currentProgress += (targetProgress - currentProgress) * 0.08;
    const pNorm = Math.min(Math.max(currentProgress, 0), 0.999);

    const interactive = performance.now() < interactionUntil;
    controls.enabled = interactive;

    if (!interactive) {
      const point = cameraPath.getPointAt(pNorm);
      camera.position.lerp(point, 0.18);
      camera.lookAt(0, -1.1, 0);
    }

    trucks.forEach((truck, idx) => {
      truck.position.x = -8 + ((performance.now() * 0.0015 + idx * 1.2) % 18);
    });

    dustClouds.children.forEach((dust, idx) => {
      dust.position.y = -0.3 + Math.sin(performance.now() * 0.002 + idx) * 0.22;
    });

    applyStopState(activeStop);

    if (interactive) {
      controls.update();
    }

    renderer.render(scene, camera);
  };

  const onResize = () => {
    const { clientWidth, clientHeight } = container;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight);
  };

  window.addEventListener("resize", onResize);
  animate();

  return {
    update(progress, stopIndex) {
      targetProgress = progress;
      activeStop = stopIndex;
    },
    setSite(siteKey) {
      selectedSite = siteKey === "B" ? "B" : "A";
    },
    destroy() {
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", markInteraction);
      renderer.domElement.removeEventListener("wheel", markInteraction);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      controls.dispose();
      renderer.dispose();
      container.innerHTML = "";
    }
  };
}
