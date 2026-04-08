(function () {
  'use strict';

  if (window.__jongleiAppBooted) {
    return;
  }

  var scenes = [
    {
      title: 'The Sudd Before the Blade',
      shortLabel: 'The Sudd – A Living System',
      textContent: '<p>The Sudd functioned as a living wetland system supporting local livelihoods and biodiversity.</p><p>This baseline matters because all canal impacts are measured against this original ecological balance.</p>',
      metrics: { temperature: '22°C', humidity: '85%', evaporation: '4.2 mm/day', disease: 'Low' }
    },
    {
      title: 'The Colonial Gaze: "Waste" as a Weapon',
      shortLabel: 'Colonial Vision of Progress',
      textContent: '<p>Colonial planning reframed wetlands as wasted water and promoted extraction-focused engineering.</p><p>Local ecological and social knowledge was sidelined in favor of downstream priorities.</p>',
      metrics: { temperature: '24°C', humidity: '82%', evaporation: '5.1 mm/day', disease: 'Low' }
    },
    {
      title: 'The Students\' Blood – 1974',
      shortLabel: 'Protest & Repression',
      textContent: '<p>Student protests transformed canal politics from a technical policy debate into lived resistance.</p><p>State violence intensified mistrust of imposed development.</p>',
      metrics: { temperature: '26°C', humidity: '78%', evaporation: '5.8 mm/day', disease: 'Moderate' }
    },
    {
      title: 'The Snail\'s Warning',
      shortLabel: 'Disease & Ignored Science',
      textContent: '<p>Health warnings linked canal disturbance to disease spread through altered water habitats.</p><p>Evidence was known, but political momentum kept the project moving.</p>',
      metrics: { temperature: '27°C', humidity: '80%', evaporation: '6.1 mm/day', disease: 'High' }
    },
    {
      title: 'The Excavator Falls',
      shortLabel: 'Armed Halt',
      textContent: '<p>Escalating conflict eventually halted the machinery and stopped construction.</p><p>The canal became a symbol of extraction, conflict, and resistance.</p>',
      metrics: { temperature: '28°C', humidity: '76%', evaporation: '6.3 mm/day', disease: 'High' }
    },
    {
      title: 'The Broken Sponge',
      shortLabel: 'Ecological Breakdown',
      textContent: '<p>Wetland sponge functions were disrupted, reducing resilience to climate and flood extremes.</p><p>Local systems that buffered shocks were weakened over time.</p>',
      metrics: { temperature: '30°C', humidity: '69%', evaporation: '7.0 mm/day', disease: 'High' }
    },
    {
      title: 'The Ditch That Still Bleeds',
      shortLabel: 'Unfinished Legacy',
      textContent: '<p>The canal corridor still shapes vulnerabilities including flood damage and disease risk.</p><p>Infrastructure legacies can persist long after projects stop.</p>',
      metrics: { temperature: '31°C', humidity: '66%', evaporation: '7.4 mm/day', disease: 'Very High' }
    },
    {
      title: 'Will We Listen?',
      shortLabel: 'Future Water Justice',
      textContent: '<p>The closing question asks whether planning can center local knowledge and justice.</p><p>Future water policy must include ecology, health, and community agency from the start.</p>',
      metrics: { temperature: '29°C', humidity: '72%', evaporation: '6.8 mm/day', disease: 'Moderate' }
    }
  ];

  var currentSceneIndex = 0;
  var isPanelOpen = false;
  var dragStartY = 0;
  var dragStartX = 0;
  var three = {
    scene: null,
    camera: null,
    renderer: null,
    objects: [],
    raf: 0
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function updateScene(index) {
    currentSceneIndex = Math.max(0, Math.min(index, scenes.length - 1));
    var scene = scenes[currentSceneIndex];

    var progressText = byId('progress-text');
    var progressFill = document.querySelector('.progress-fill');
    var title = byId('scene-title');
    var labelTitle = byId('label-title');
    var textContent = byId('text-content');

    if (progressText) {
      progressText.textContent = (currentSceneIndex + 1) + ' of ' + scenes.length;
    }
    if (progressFill) {
      progressFill.style.width = (((currentSceneIndex + 1) / scenes.length) * 100) + '%';
    }
    if (title) {
      title.textContent = scene.title;
    }
    if (labelTitle) {
      labelTitle.textContent = scene.shortLabel;
    }
    if (textContent) {
      textContent.innerHTML = scene.textContent;
    }

    setMetric('metric-temperature', scene.metrics.temperature);
    setMetric('metric-humidity', scene.metrics.humidity);
    setMetric('metric-evaporation', scene.metrics.evaporation);
    setMetric('metric-disease', scene.metrics.disease);
    setMetric('metric-temperature-full', scene.metrics.temperature);
    setMetric('metric-humidity-full', scene.metrics.humidity);
    setMetric('metric-evaporation-full', scene.metrics.evaporation);

    var prev = byId('nav-prev');
    var next = byId('nav-next');
    if (prev) {
      prev.disabled = currentSceneIndex <= 0;
    }
    if (next) {
      next.disabled = currentSceneIndex >= scenes.length - 1;
    }

    closePanel();

    renderPlaceholder3D(currentSceneIndex);
  }

  function clearObjects() {
    if (!three.scene) {
      return;
    }
    while (three.objects.length) {
      var obj = three.objects.pop();
      three.scene.remove(obj);
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        obj.material.dispose();
      }
    }
  }

  function addMesh(geometry, material, x, y, z, rx) {
    var mesh = new window.THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    if (typeof rx === 'number') {
      mesh.rotation.x = rx;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    three.scene.add(mesh);
    three.objects.push(mesh);
    return mesh;
  }

  function renderPlaceholder3D(sceneIndex) {
    if (!three.scene) {
      return;
    }

    clearObjects();

    var T = window.THREE;
    var groundColor = [0x7f6a4a, 0x7a6848, 0x746345, 0x6e5d42, 0x68573d, 0x6f6448, 0x746b55, 0x6e7659][sceneIndex] || 0x7f6a4a;
    var waterColor = [0x4a90e2, 0x4686d4, 0x427dc8, 0x3c74bd, 0x3569ae, 0x2f5f9f, 0x2a5892, 0x3a83c1][sceneIndex] || 0x4a90e2;

    addMesh(new T.PlaneGeometry(220, 220), new T.MeshStandardMaterial({ color: groundColor, roughness: 0.9 }), 0, 0, 0, -Math.PI / 2);
    var water = addMesh(new T.PlaneGeometry(70, 120), new T.MeshStandardMaterial({ color: waterColor, roughness: 0.3, metalness: 0.2 }), 0, 0.15, -10, -Math.PI / 2);
    water.userData = { wave: true };

    // Scene-specific simple placeholders
    if (sceneIndex === 0) {
      addMesh(new T.CylinderGeometry(1, 1, 5, 12), new T.MeshStandardMaterial({ color: 0xd4b08a }), -20, 2.5, 20);
      addMesh(new T.CylinderGeometry(1, 1, 5, 12), new T.MeshStandardMaterial({ color: 0xd4b08a }), -14, 2.5, 18);
      addMesh(new T.BoxGeometry(4, 2, 2), new T.MeshStandardMaterial({ color: 0x8d6e63 }), -30, 1, -6);
    } else if (sceneIndex === 1) {
      addMesh(new T.BoxGeometry(5, 4, 5), new T.MeshStandardMaterial({ color: 0x9b8f79 }), 35, 2, -35);
      addMesh(new T.BoxGeometry(90, 0.6, 1.2), new T.MeshStandardMaterial({ color: 0xff6f61 }), 0, 0.5, 0);
    } else if (sceneIndex === 2) {
      for (var i = 0; i < 4; i++) {
        addMesh(new T.CylinderGeometry(1, 1, 4, 10), new T.MeshStandardMaterial({ color: 0xcfb08a }), -30 + i * 5, 2, 14 + i * 2);
      }
      addMesh(new T.BoxGeometry(6, 2.5, 0.6), new T.MeshStandardMaterial({ color: 0xb84d4d }), -20, 4.5, 20);
    } else if (sceneIndex === 3) {
      addMesh(new T.SphereGeometry(3, 18, 18), new T.MeshStandardMaterial({ color: 0x88c8ff }), 0, 3, 0);
      addMesh(new T.CylinderGeometry(1, 1, 4, 10), new T.MeshStandardMaterial({ color: 0xd4b08a }), 32, 2, 26);
    } else if (sceneIndex === 4) {
      addMesh(new T.BoxGeometry(10, 6, 8), new T.MeshStandardMaterial({ color: 0x777777 }), -25, 3, -30);
      addMesh(new T.BoxGeometry(4, 7, 4), new T.MeshStandardMaterial({ color: 0x666666 }), 18, 3.5, 22);
    } else if (sceneIndex === 5) {
      addMesh(new T.PlaneGeometry(28, 50), new T.MeshStandardMaterial({ color: 0x6b8fc7 }), 0, 0.2, 14, -Math.PI / 2);
      addMesh(new T.SphereGeometry(2.2, 14, 14), new T.MeshStandardMaterial({ color: 0x9fd6ff }), 0, 4, 0);
    } else if (sceneIndex === 6) {
      addMesh(new T.BoxGeometry(90, 0.6, 30), new T.MeshStandardMaterial({ color: 0x5a4a3a }), 0, 0.25, 0);
      addMesh(new T.CylinderGeometry(1, 1, 4, 10), new T.MeshStandardMaterial({ color: 0xd4b08a }), 45, 2, 30);
    } else {
      addMesh(new T.ConeGeometry(3, 9, 12), new T.MeshStandardMaterial({ color: 0x7ba82f }), -20, 4.5, -20);
      addMesh(new T.ConeGeometry(3, 9, 12), new T.MeshStandardMaterial({ color: 0x7ba82f }), 20, 4.5, -24);
      addMesh(new T.BoxGeometry(6, 6, 6), new T.MeshStandardMaterial({ color: 0x5a9bb4 }), 0, 3, 0);
    }
  }

  function animate3D() {
    if (!three.renderer || !three.scene || !three.camera) {
      return;
    }

    for (var i = 0; i < three.objects.length; i++) {
      var obj = three.objects[i];
      if (obj.userData && obj.userData.wave) {
        obj.rotation.z += 0.0007;
      }
    }

    three.renderer.render(three.scene, three.camera);
    three.raf = window.requestAnimationFrame(animate3D);
  }

  function initThreeFallback() {
    if (!window.THREE) {
      return false;
    }

    var canvas = byId('three-canvas');
    if (!canvas) {
      return false;
    }

    var T = window.THREE;
    three.scene = new T.Scene();
    three.scene.background = new T.Color(0x14253a);

    var w = Math.max(window.innerWidth - 80, 320);
    var h = Math.max(window.innerHeight - 80, 320);
    three.camera = new T.PerspectiveCamera(70, w / h, 0.1, 1000);
    three.camera.position.set(0, 55, 85);
    three.camera.lookAt(0, 0, 0);

    three.renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    three.renderer.setSize(w, h);
    three.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    var dir = new T.DirectionalLight(0xffffff, 0.85);
    dir.position.set(40, 90, 40);
    three.scene.add(dir);
    three.scene.add(new T.AmbientLight(0xffffff, 0.45));

    window.addEventListener('resize', function () {
      if (!three.renderer || !three.camera) {
        return;
      }
      var rw = Math.max(window.innerWidth - 80, 320);
      var rh = Math.max(window.innerHeight - 80, 320);
      three.camera.aspect = rw / rh;
      three.camera.updateProjectionMatrix();
      three.renderer.setSize(rw, rh);
    });

    animate3D();
    return true;
  }

  function setMetric(id, value) {
    var el = byId(id);
    if (el) {
      el.textContent = value;
    }
  }

  function openPanel() {
    var panel = byId('text-panel');
    var label = byId('scene-label');
    if (panel) {
      panel.classList.add('open');
    }
    if (label) {
      label.classList.add('hidden');
    }
    isPanelOpen = true;
  }

  function closePanel() {
    var panel = byId('text-panel');
    var label = byId('scene-label');
    if (panel) {
      panel.classList.remove('open');
    }
    if (label) {
      label.classList.remove('hidden');
    }
    isPanelOpen = false;
  }

  function openMetrics() {
    var widget = byId('metrics-widget');
    var compact = byId('metrics-compact');
    var expanded = byId('metrics-expanded');
    var toggle = byId('metrics-toggle');

    if (widget) {
      widget.classList.add('open');
    }
    if (compact) {
      compact.style.display = 'none';
    }
    if (expanded) {
      expanded.style.display = 'flex';
    }
    if (toggle) {
      toggle.setAttribute('aria-pressed', 'true');
    }
  }

  function closeMetrics() {
    var widget = byId('metrics-widget');
    var compact = byId('metrics-compact');
    var expanded = byId('metrics-expanded');
    var toggle = byId('metrics-toggle');

    if (widget) {
      widget.classList.remove('open');
    }
    if (compact) {
      compact.style.display = 'flex';
    }
    if (expanded) {
      expanded.style.display = 'none';
    }
    if (toggle) {
      toggle.setAttribute('aria-pressed', 'false');
    }
  }

  function toggleMetrics() {
    var widget = byId('metrics-widget');
    if (!widget) {
      return;
    }
    if (widget.classList.contains('open')) {
      closeMetrics();
    } else {
      openMetrics();
    }
  }

  function onDragStart(e) {
    var p = e.touches ? e.touches[0] : e;
    dragStartY = p.clientY;
    dragStartX = p.clientX;
  }

  function onDragMove(e) {
    if (!dragStartY || isPanelOpen) {
      return;
    }
    var p = e.touches ? e.touches[0] : e;
    var dy = dragStartY - p.clientY;
    var dx = Math.abs(dragStartX - p.clientX);
    if (dy > 40 && dx < 60) {
      openPanel();
    }
  }

  function onDragEnd() {
    dragStartY = 0;
    dragStartX = 0;
  }

  function attachPress(el, fn) {
    if (!el) {
      return;
    }
    el.addEventListener('click', function (e) {
      if (e) {
        e.preventDefault();
      }
      fn();
    });
    el.addEventListener('touchend', function (e) {
      if (e) {
        e.preventDefault();
      }
      fn();
    }, { passive: false });
  }

  function init() {
    initThreeFallback();

    attachPress(byId('nav-prev'), function () { updateScene(currentSceneIndex - 1); });
    attachPress(byId('nav-next'), function () { updateScene(currentSceneIndex + 1); });
    attachPress(byId('scene-label'), openPanel);
    attachPress(byId('close-panel'), closePanel);
    attachPress(byId('metrics-toggle'), toggleMetrics);
    attachPress(byId('metrics-widget'), function () {
      var closeBtn = byId('metrics-close');
      if (document.activeElement === closeBtn) {
        return;
      }
      toggleMetrics();
    });
    attachPress(byId('metrics-close'), closeMetrics);

    var viewport = document.querySelector('.main-viewport');
    if (viewport) {
      viewport.addEventListener('mousedown', onDragStart, { passive: true });
      viewport.addEventListener('mousemove', onDragMove, { passive: true });
      viewport.addEventListener('mouseup', onDragEnd, { passive: true });
      viewport.addEventListener('touchstart', onDragStart, { passive: true });
      viewport.addEventListener('touchmove', onDragMove, { passive: true });
      viewport.addEventListener('touchend', onDragEnd, { passive: true });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') {
        updateScene(currentSceneIndex - 1);
      } else if (e.key === 'ArrowRight') {
        updateScene(currentSceneIndex + 1);
      }
    });

    document.addEventListener('click', function (e) {
      var widget = byId('metrics-widget');
      var toggle = byId('metrics-toggle');
      if (widget && widget.classList.contains('open') && !widget.contains(e.target) && toggle && !toggle.contains(e.target)) {
        closeMetrics();
      }
    });

    updateScene(0);

    window.__jongleiAppBooted = true;

    var warning = byId('compat-warning');
    if (warning) {
      warning.style.display = 'none';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
