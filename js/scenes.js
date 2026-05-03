/**
 * scenes.js
 * Scene definitions for all 8 exhibition scenes
 */

export const scenes = [
  {
    id: 0,
    title: "The Sudd Before the Blade",
    shortLabel: "The Sudd – A Living System",
    hint: "▲ Drag up for the story of the wetland • pinch/scroll to zoom • ▶ Next: forced into a straight line",
    textContent: `
      <p><strong>The sudd before it got destroyed!</strong></p>
      <p>The Sudd is far more than a vast expanse of water and papyrus; it is the hydrological heart of East Africa. For centuries, this massive wetland has functioned as a biological "sponge," an ancient engine that absorbs the seasonal overflow of the White Nile only to release it slowly, sustaining one of the most complex pastoralist lifecycles on Earth. From an analytical perspective, the Sudd is a masterclass in resilient equilibrium. The Dinka, Nuer, and Shilluk peoples did not simply live near the marsh; they lived with its rhythm. Their entire social and economic fabric-centered on the movement of cattle-was an adaptive response to the seasonal "pulse" of the flood. This was not a primitive state of nature, but a highly sophisticated, non-linear system where human culture and ecological health were indistinguishable.</p>
      <p>However, to the eyes of 20th-century colonial and post-colonial planners, this vibrant complexity was seen as a pathology. Engineers viewed the Sudd as a "leaky pipe"-a site of wasted water that evaporated uselessly before it could reach the thirsty industrial centers of Egypt and Northern Sudan. This sets the stage for our audit: a clash between two fundamentally different logics. On one side, a living system based on cyclical harmony; on the other, an extraction-based logic that sought to "correct" the landscape by forcing it into a straight line.</p>
    `,
    camera: { pos: [0, 50, 80], target: [0, 0, 0] },
    scene0: {
      intro: {
        startBlur: 10,
        revealDurationMs: 900
      },
      water: {
        flowDirection: [0.82, 0.18],
        flowSpeed: 0.36,
        evaporationRate: 0.52
      },
      vegetation: {
        reedCount: 1600,
        barrierStrength: 0.72
      },
      life: {
        villagerCount: 16,
        shoebillCount: 2,
        adaptationDrift: 0.34
      },
      community: {
        grassPatchCount: 12,
        papyrusCount: 220,
        cowCount: 14,
        fisherCount: 6,
        dinkaHouseholdCount: 8,
        nuerCampCount: 1
      },
      pulse: {
        intervalMs: 9000
      }
    },
    objects: [
      { type: 'terrain', id: 'base-plain', geometry: 'plane', scale: [200, 200], position: [0, 0, 0], color: 0x8B7355 },
      { type: 'water', id: 'main-channel', geometry: 'plane', position: [0, 0.5, -30], scale: [40, 60], color: 0x4A90E2, animated: true },
      { type: 'vegetation', id: 'grass-area', geometry: 'plane', position: [-50, 0, 0], scale: [40, 80], color: 0x6BA82F },
      { type: 'character', name: 'herder-1', position: [-20, 0, 20], animation: 'idle' },
      { type: 'animal', name: 'cattle-herd', position: [-30, 0, -10], animation: 'grazing' }
    ],
    metrics: {
      temperature: "22°C",
      humidity: "85%",
      evaporation: "4.2 mm/day",
      disease: "Low"
    }
  },
  {
    id: 1,
    title: "The Colonial Gaze: \"Waste\" as a Weapon",
    shortLabel: "Colonial Vision of Progress",
    hint: "▲ Drag up to read analysis",
    textContent: `
      <p><strong>monster that destroyed it all</strong></p>
      <p>The arrival of the Bucket-Wheel Excavator (BWE)-a 2,300-ton French-built titan-marked the transition from ecological rhythm to industrial violence. This machine was the physical embodiment of a "top-down" strategic vision that prioritized distant capital over local sovereignty. As the BWE began to carve the Jonglei Canal, it wasn't just moving dirt; it was performing an act of extraction that threatened to bypass the Sudd entirely. The argument for the canal was built on a foundation of "modernization," yet the evidence suggests a much colder reality. By diverting the Nile's waters into a concrete channel, the project aimed to drain the very lifeblood of the Nilotic people, effectively "evicting" the indigenous communities from their ancestral grazing lands without a single shot being fired.</p>
      <p>This is where the adventure takes a forensic turn. We must analyze the canal not as a failed miracle of engineering, but as a weapon of spatial reorganization. The BWE represented a "geometry of extraction"-a straight line forced through a winding, organic world. As the machine churned forward, it created a rift in both the earth and the culture of the region, proving that infrastructure is never neutral. It is always an expression of power. In Scene 1, we audit the moment this power was first switched on, and the slow, irreversible violence it began to exert on the people who called the "Sponge" their home.</p>
    `,
    camera: { pos: [20, 15, 10], target: [0, 6, -15] },
    objects: [
      { type: 'terrain', id: 'base-plain', geometry: 'plane', scale: [200, 200], position: [0, 0, 0], color: 0x8B7355 },
      { type: 'water', id: 'main-channel', geometry: 'plane', puddle: true, position: [0, 0.5, -30], scale: [40, 60], color: 0x4A90E2 },
      { type: 'water', id: 'front-machine-puddle', geometry: 'plane', puddle: true, stretch: [3, 1, 1], position: [8, 0.92, -19.5], scale: [16, 12], color: 0x4A90E2 },
      { type: 'character', name: 'surveyor', position: [50, 0, -40], animation: 'standing', tag: 'colonial' },
      { type: 'props', name: 'theodolite', position: [50, 0, -38], scale: [2, 2, 2] }
    ],
    metrics: {
      temperature: "24°C",
      humidity: "82%",
      evaporation: "5.1 mm/day",
      disease: "Low"
    }
  },
  {
    id: 2,
    title: "The Students' Blood – 1974",
    shortLabel: "Protest & Repression",
    hint: "▲ Drag up to read analysis",
    textContent: `
      <p>In 1971, Sudan's Jafaar Nimeiry government began preliminary excavation on the canal. By 1974, students at the University of Juba organized a sit-in opposing the project. On July 20, 1974, police opened fire on protesting students, killing William Pancol and injuring dozens. The Sudd was no longer an abstract hydrological debate—it became a site of youth sacrifice and state violence.</p>
      <p>Pancol's death crystallized a generation's resistance. Interviews collected decades later reveal that survivors internalized the lesson: development schemes imposed by distant planners, backed by armed force, were incompatible with local agency. This radicalization laid groundwork for broader opposition when the SPLA (Sudan People's Liberation Army) emerged in 1983.</p>
      <p>This scene depicts the moment resistance became visible, visible, and personal.</p>
    `,
    camera: { pos: [-20, 40, 60], target: [-10, 0, 10] },
    objects: [
      { type: 'terrain', id: 'base-plain', geometry: 'plane', scale: [200, 200], position: [0, 0, 0], color: 0x8B7355 },
      { type: 'water', id: 'main-channel', geometry: 'plane', position: [0, 0.5, -30], scale: [40, 60], color: 0x4A90E2 },
      { type: 'character', name: 'student-1', position: [-40, 0, 20], animation: 'marching', tag: 'protester' },
      { type: 'character', name: 'student-2', position: [-35, 0, 25], animation: 'marching', tag: 'protester' },
      { type: 'character', name: 'student-3', position: [-45, 0, 15], animation: 'marching', tag: 'protester' },
      { type: 'props', name: 'banner-1', position: [-38, 2, 18], scale: [3, 2, 0.1], tag: 'protest-banner' }
    ],
    metrics: {
      temperature: "26°C",
      humidity: "78%",
      evaporation: "5.8 mm/day",
      disease: "Moderate"
    }
  },
  {
    id: 3,
    title: "The Snail's Warning",
    shortLabel: "Disease & Ignored Science",
    hint: "▲ Drag up to read analysis",
    textContent: `
      <p>In 1983–84, shortly after SPLA hostilities began, a disease survey led by Mohamed et al. documented a dramatic rise in schistosomiasis (bilharzia) tied to canal excavation. The parasite lives in freshwater snails; canal construction fragmented aquatic habitats and created ideal breeding grounds. Rates in some villages spiked from <5% to >60% in a single generation.</p>
      <p>Yet these findings were sidelined. Warnings from parasitologists, epidemiologists, and Dinka healers—who recognized the disease's link to canal construction—were eclipsed by war, geopolitical urgency, and institutional inertia. The canal project persisted even as disease burden escalated, illustrating how technocratic momentum can override health evidence.</p>
      <p>The snail becomes a symbol: small, invisible to engineers, but harbinger of ecological consequence ignored.</p>
    `,
    camera: { pos: [30, 40, 70], target: [10, 0, 0] },
    objects: [
      { type: 'terrain', id: 'base-plain', geometry: 'plane', scale: [200, 200], position: [0, 0, 0], color: 0x8B7355 },
      { type: 'water', id: 'fragmented-channels', geometry: 'plane', position: [-20, 0.5, -10], scale: [30, 40], color: 0x4A90E2 },
      { type: 'water', id: 'bracken-pools', geometry: 'plane', position: [20, 0.5, 10], scale: [20, 30], color: 0x7FA1E0 },
      { type: 'props', name: 'snail-colony-icon', position: [0, 1, 0], scale: [5, 2, 5], tag: 'disease-vector', animated: true },
      { type: 'character', name: 'healer', position: [40, 0, 30], animation: 'consulting' }
    ],
    metrics: {
      temperature: "28°C",
      humidity: "76%",
      evaporation: "6.2 mm/day",
      disease: "High"
    }
  },
  {
    id: 4,
    title: "The Excavator Falls",
    shortLabel: "Armed Resistance & Construction Halt",
    hint: "▲ Drag up to read analysis",
    textContent: `
      <p>From 1984 onwards, the SPLA targeted canal infrastructure. Heavy construction equipment was disabled, worksites attacked, and labor convoys ambushed. Construction halted in the war period with about 240-270 km of the planned 360 km excavated, leaving the scheme incomplete and politically radioactive. The SPLA framed the canal as a symbol of Khartoum's imposition and a threat to Dinka pastoralism. Dinka intellectuals articulated a political argument: the canal served distant elites (Egypt, irrigated schemes downstream) at the expense of local commons.</p>
      <p>The excavator falling—machinery silenced by guerrilla action—is not merely a tactical victory but a moment of vernacular resistance to externally imposed development. Local agency reasserted itself against the machinery of state power and capital.</p>
      <p>This scene honors the complexity of that resistance: not uniformly anti-progress, but anti-dispossession.</p>
    `,
    camera: { pos: [-50, 50, 80], target: [0, 0, -20] },
    objects: [
      { type: 'terrain', id: 'base-plain', geometry: 'plane', scale: [200, 200], position: [0, 0, 0], color: 0x8B7355 },
      { type: 'infrastructure', id: 'canal-trench', geometry: 'plane', position: [0, 0, 0], scale: [80, 120], color: 0x654321, animated: false },
      { type: 'props', name: 'excavator-1', position: [-30, 2, -40], scale: [8, 6, 10], tag: 'damaged', animated: false },
      { type: 'props', name: 'crane-1', position: [20, 3, 30], scale: [5, 8, 3], tag: 'abandoned' },
      { type: 'character', name: 'fighter-1', position: [-50, 0, 50], animation: 'standing', tag: 'spla' },
      { type: 'character', name: 'fighter-2', position: [-45, 0, 45], animation: 'standing', tag: 'spla' }
    ],
    metrics: {
      temperature: "25°C",
      humidity: "74%",
      evaporation: "5.5 mm/day",
      disease: "High"
    }
  },
  {
    id: 5,
    title: "The Ditch That Still Bleeds",
    shortLabel: "Legacy of Broken Promises",
    hint: "▲ Drag up to read analysis",
    textContent: `
      <p>Today, the incomplete canal remains an artifact of failed infrastructure and ecological rupture. The unfinished trench disrupts water flow patterns, creating stagnant zones that harbor disease vectors while failing to serve any intended irrigation function. Cholera outbreaks cluster near the trench; livestock hesitate to drink from unpredictable channels; migratory wildlife corridors remain fragmented.</p>
      <p>By the 2000s–2010s, civil society organizations, Dinka intellectuals, and international ecologists converged on a "Save the Sudd" advocacy movement. The argument: restore hydrological connectivity, rehabilitate vegetation, and enumerate the economic value of ecosystem services (floodwater retention, fisheries productivity, pastoral wealth support) that had been destroyed.</p>
      <p>The Sudd's slow recovery underscores what was sacrificed: not mere landscape, but a mode of economic and ecological practice refined across generations.</p>
    `,
    camera: { pos: [40, 45, 65], target: [10, 0, 10] },
    objects: [
      { type: 'terrain', id: 'scarred-landscape', geometry: 'plane', scale: [200, 200], position: [0, 0, 0], color: 0x9D8866 },
      { type: 'infrastructure', id: 'canal-scar', geometry: 'plane', position: [0, 0.1, 0], scale: [100, 150], color: 0x5A4A3A, animated: false },
      { type: 'water', id: 'stagnant-pools', geometry: 'plane', position: [-40, 0.5, -30], scale: [30, 40], color: 0x556E7A },
      { type: 'character', name: 'elder-reflecting', position: [60, 0, 40], animation: 'standing' },
      { type: 'props', name: 'advocacy-banner', position: [0, 3, -70], scale: [4, 2, 0.1], tag: 'save-sudd' }
    ],
    metrics: {
      temperature: "27°C",
      humidity: "68%",
      evaporation: "7.2 mm/day",
      disease: "High"
    }
  },
];

export function getScene(sceneIndex) {
  return scenes[Math.max(0, Math.min(sceneIndex, scenes.length - 1))];
}
