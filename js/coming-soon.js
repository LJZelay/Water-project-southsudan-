import * as THREE from 'three';

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

// --- 3D SETUP ---
const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaebad0);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 45);

const ambient = new THREE.AmbientLight(0xffffff, 0.85);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(10, 20, 15);
sun.castShadow = true;
scene.add(sun);

// Ground
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 150),
    new THREE.MeshStandardMaterial({ color: 0x5a7a40, roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -8; 
floor.receiveShadow = true;
scene.add(floor);

// Water
const water = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 250),
    new THREE.MeshStandardMaterial({ color: 0x3d5a73, roughness: 0.1, transparent: true, opacity: 0.7 })
);
water.rotation.x = -Math.PI / 2;
water.position.set(0, -9, -80);
scene.add(water);

// --- CATTLE ---
function createCow() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.8), new THREE.MeshStandardMaterial({ color: 0xefeee8 }));
    body.position.y = 0.9;
    group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.5), new THREE.MeshStandardMaterial({ color: 0xefeee8 }));
    head.position.set(1.0, 1.2, 0);
    group.add(head);
    return group;
}

const cattle = [];
for (let i = 0; i < 15; i++) {
    const cow = createCow();
    cow.position.set(Math.random() * 100 - 50, -8, Math.random() * 40 - 20);
    cow.rotation.y = Math.random() * Math.PI * 2;
    cow.userData = { speed: 0.01 + Math.random() * 0.03 };
    scene.add(cow);
    cattle.push(cow);
}

function animate(time) {
    requestAnimationFrame(animate);
    const t = time * 0.001;
    
    // Cattle movement
    cattle.forEach(cow => {
        cow.position.x += Math.cos(cow.rotation.y) * cow.userData.speed;
        cow.position.z -= Math.sin(cow.rotation.y) * cow.userData.speed;
        if (Math.abs(cow.position.x) > 50 || Math.abs(cow.position.z) > 30) {
            cow.rotation.y += Math.PI;
        }
        cow.position.y = -8 + Math.abs(Math.sin(t * 4)) * 0.04;
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

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
