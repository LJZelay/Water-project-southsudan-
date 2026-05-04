import * as THREE from 'three';

function handleGetLearning() {
    const ui = document.getElementById('ui-overlay');
    ui.classList.add('fade-out');
    document.getElementById('three-canvas').style.filter = 'blur(15px) grayscale(1)';
    
    setTimeout(() => {
        window.location.href = '/coming-soon.html';
    }, 1000);
}

const startJourneyBtn = document.getElementById('start-journey');
if (startJourneyBtn) {
    startJourneyBtn.addEventListener('click', handleGetLearning);
}

// --- THREE.JS SCENE SETUP ---
const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaebad0);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 32); 

const ambient = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.position.set(10, 20, 10);
sun.castShadow = true;
scene.add(sun);

// --- TERRAIN ---
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 100),
    new THREE.MeshStandardMaterial({ color: 0x5a7a40, roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.z = 10;
floor.receiveShadow = true;
scene.add(floor);

// Water Background
const waterGeom = new THREE.PlaneGeometry(400, 200, 32, 32);
const waterMat = new THREE.MeshStandardMaterial({ 
    color: 0x3d5a73, 
    roughness: 0.1, 
    metalness: 0.3,
    transparent: true,
    opacity: 0.8
});
const water = new THREE.Mesh(waterGeom, waterMat);
water.rotation.x = -Math.PI / 2;
water.position.set(0, -0.2, -40);
scene.add(water);

// --- CHARACTERS ---
function createPolishedHero(type) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a1b0a, roughness: 0.4 });
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xbc9b6a });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 3.2, 16), bodyMat);
    torso.position.y = 1.6;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 24), bodyMat);
    head.position.y = 3.6;
    group.add(head);

    const hat = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.8, 16), hatMat);
    hat.position.y = 4.1;
    group.add(hat);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.4, 8), bodyMat);
    if (type === 'farmer') {
        arm.position.set(0.9, 2.8, 0);
        arm.rotation.z = -Math.PI / 3.2;
    } else {
        arm.position.set(-0.9, 2.8, 0);
        arm.rotation.z = Math.PI / 3.2;
    }
    group.add(arm);

    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 2.2, 8), bodyMat);
    legL.position.set(-0.4, 0, 0);
    group.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.4;
    group.add(legR);

    if (type === 'fisher') {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 7, 8), new THREE.MeshStandardMaterial({ color: 0x3d2d21 }));
        rod.position.set(-1.4, 4.0, 0);
        rod.rotation.z = Math.PI / 4.5;
        group.add(rod);
    }

    group.userData = { clickable: true, type: type };
    return group;
}

const farmer = createPolishedHero('farmer');
farmer.position.set(-10, 1.1, 0); // Positioned away from center button
scene.add(farmer);

const fisher = createHero('fisher');
function createHero(type) { return createPolishedHero(type); } // Alias for consistency
const fisherObj = createHero('fisher');
fisherObj.position.set(10, 1.1, 0); // Positioned away from center button
scene.add(fisherObj);

// --- CATTLE ---
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
    [[-0.6, 0.5, 0.35], [-0.6, 0.5, -0.35], [0.6, 0.5, 0.35], [0.6, 0.5, -0.35]].forEach(pos => {
        const leg = new THREE.Mesh(legGeom, bodyMat);
        leg.position.set(...pos);
        group.add(leg);
    });
    return group;
}

const cattle = [];
const cattleStartPos = [
    [-14, 0, 4], [-16, 0, -5], // Left cluster
    [14, 0, 4], [16, 0, -5],   // Right cluster
    [-12, 0, -8], [12, 0, -8]  // Mid clusters
];

cattleStartPos.forEach((pos, i) => {
    const cow = createCow(i % 2 === 0 ? 0xf0f0f0 : 0x7a5a3a);
    cow.position.set(...pos);
    cow.rotation.y = Math.random() * Math.PI * 2;
    cow.scale.setScalar(0.9 + Math.random() * 0.2);
    cow.userData = { speed: 0.015 + Math.random() * 0.02, angle: cow.rotation.y };
    scene.add(cow);
    cattle.push(cow);
});

// --- RAYCASTER & INTERACTION ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('mousedown', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && !obj.userData.clickable) { obj = obj.parent; }
        
        if (obj && obj.userData.type === 'farmer') {
            showFarmerDialogue();
        }
    }
});

function showFarmerDialogue() {
    const bubble = document.getElementById('farmer-speech');
    const vector = new THREE.Vector3();
    farmer.getWorldPosition(vector);
    vector.y += 5.5; 
    vector.project(camera);
    
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (vector.y * -0.5 + 0.5) * window.innerHeight;
    
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
    bubble.style.display = 'block';
    bubble.style.transform = 'translate(-50%, -100%)';

    setTimeout(() => { bubble.style.display = 'none'; }, 2000);
}

// --- ANIMATION LOOP ---
function animate(time) {
    requestAnimationFrame(animate);
    const t = time * 0.001;

    // Heroes breathing
    farmer.position.y = 1.1 + Math.sin(t * 1.5) * 0.1;
    fisherObj.position.y = 1.1 + Math.sin(t * 1.5 + 1) * 0.1;

    // Cattle walking within bounds
    cattle.forEach((cow) => {
        cow.position.x += Math.cos(cow.userData.angle) * cow.userData.speed;
        cow.position.z -= Math.sin(cow.userData.angle) * cow.userData.speed;
        
        // Boundary check (Fence logic)
        const limitX = 25, limitZ = 15;
        if (Math.abs(cow.position.x) > limitX || Math.abs(cow.position.z) > limitZ) {
            cow.userData.angle += Math.PI; // Turn back
            cow.rotation.y = cow.userData.angle;
        }
        // Head bob
        cow.rotation.x = Math.sin(t * 3) * 0.05;
    });

    // Shimmering Water
    const pos = water.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        pos.setZ(i, Math.sin(t * 0.5 + i * 0.3) * 0.08);
    }
    pos.needsUpdate = true;
    
    renderer.render(scene, camera);
}
animate(0);

// --- RESIZE ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
