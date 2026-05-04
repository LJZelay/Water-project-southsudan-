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
      <p>Before it was labeled as “waste” or targeted for extraction, the Sudd was a living ,breathing system that was one of the most complex wetlands on Earth, where water, land, animals, and people existed in constant relationship. From an anthropological viewpoint, it was not an empty or undeveloped space, but a highly organized ecological civilization. The seasonal flooding of the Nile shaped everything: when people moved, where cattle grazed, when fish were caught, and how communities gathered. What might appear chaotic from the outside was, in reality, a deeply structured rhythm in which required a precision, memory, and collective knowledge to navigate. The Sudd was known to regulate climate which prevented extreme flooding, and sustained biodiversity, but more importantly, it sustained ways of life that had evolved in harmony with its variability rather than in opposition to it.</p>
      <p>In this region, There was two tribal groups in which were the Dinka and Nuer people, that  viewed their environment as their identity itself. Their societies were built around cattle, water, and movement, forming what anthropologists describe as a transhumant system: a cyclical migration between seasonal lands. During the wet season, families lived on higher ground, cultivating crops and maintaining villages; as waters receded, they moved with their herds into the floodplains, where fresh grasses and fishing grounds emerged. Cattle were usually seen as social, spiritual, and cultural anchors. They defined relationships, marriage (through bridewealth), names, songs, and even personal identity. They had Knowledge of the land where to find clean water, when grasses would regenerate, how to avoid disease and this knowledge was passed down through generations, forming a sophisticated system of ecological intelligence that allowed communities to survive in a landscape outsiders often misunderstood.</p>
      <p>Culturally, life in the Sudd emphasized interdependence rather than control. There was no rigid separation between people and nature; instead, there was a shared system of survival where mobility, cooperation, and adaptability were essential. The Nuer, for example, organized themselves through flexible social structures rather than centralized authority, relying on kinship, shared responsibility, and mutual aid. Water was not seen as a resource to be owned or redirected, but as something to live with, respect, and respond to. Fishing grounds, grazing routes, and seasonal camps were governed through social agreements and deep familiarity with the land. In this world, value was not measured by accumulation or extraction, but by balance between herds and pasture, between floods and drought, between people and the environment that sustained them.</p>
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
      <p>To those outside it looked nothing like intelligence; it looked like inefficiency. To the colonial engineers and remote governments who conceived it, the Sudd was not a living system; it was an error. In 1904, British engineer Sir William Garstin stared at the vast wetland and saw not life but a "loss" of millions of cubic meters of water "wasted" to evaporation instead of traveling north, to feed the fields and the empire. That perception never died. It merely transformed. The Egypt and Sudan that emerged from colonialism took that belief to an entirely new level in 1959 with the Nile Waters Agreement dividing the river between them  and with the people of the Sudd excluded from the decision  which made it clear that the only way to "recover" that water for the fields and the economy of the north was to cut a straight line through the swamp and drain away the Sudd, transforming it from a shifting, breathing wetland ecosystem into an exploitable, controllable machine.</p>
      <p>And the plans got bigger, and more urgent, and more forceful. In the 1950s the Jonglei Canal Investigation Team (JIT) was dispatched - not to investigate whether the canal should exist, but rather to investigate how it might work, and what they found should have shut the project down. Their comprehensive report warned of the disaster to come, calculating that 36 percent of dry-season grazing lands would disappear - annihilating cattle populations, without which countless societies survived; that hundreds of thousands would be forced from their homes, losing access to water and the traditional routes for moving herds; and that fish populations, critical to survival, would collapse as the vital flood regime that kept the soils fertile broke. Put simply, their conclusion was: drain the water, drain the system. Despite the team's assertion that the project was "unacceptable", political pressure and economic forces buried their findings, and the development moved forward.</p>
      <p>By the 1970s the canal was power, and construction began in 1978 on the 1978 plan, with massive machines chewing their way through the earth that was backed by the governments of Sudan and Egypt, with the help of engineering firms and with the unquestionable logic of the north dictating that more water equaled more profit, more power, and more development, at least on paper. In the Sudd, however, it was an invasion, a straight line imposed on a system that was never straight, a decision made with no consultation, no understanding, and no concern. As the machines forged ahead, so too did the outrage, the resistance, and the beginning of a conflict that proved: this was never just about water.</p>
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
      <p>The people who understood the land best weren’t the first to rise, it was the students. In 1974, word of the Jonglei Canal spread across southern Sudan not as a development project, but as a quiet theft. Rumors moved faster than official statements: Egyptian control, land loss, forced displacement. For young people in cities like Juba, this wasn’t abstract policy—it was personal. Many of them came from Dinka and Nuer communities where they knew exactly what the canal would destroy. What began as conversations in classrooms and dorms turned into something sharper: awareness, then anger, then action. They weren’t just reacting but they were also connecting dots. A government making decisions without consultation. Agreements signed without the South. A pattern that looked less like development and more like exploitation.</p>
      <p>When the protests erupted, they were loud, visible, and impossible to ignore. Students marched through the streets demanding answers, accountability, and above all—recognition. Their message was clear: this land is not empty, and this water is not yours to take. They weren’t armed; they carried signs, voices, and the weight of what they knew was coming. But the response from the state was immediate and violent. Police and security forces moved in to shut it down. Shots were fired. Among those killed was a student often remembered as William Pancol—a name that became a symbol among the local community, not just of loss, but of awakening. Schools were closed. Leaders were arrested or exiled. And just like that, a peaceful movement was reframed as disorder, erased through official narratives that cleared the state of wrongdoing. The message from power was just as clear as the students’: dissent would not be tolerated.</p>
      <p>But something irreversible had already happened. The protests didn’t stop the canal but also  changed how people saw it, and how they saw their government. Students began to understand that decisions about their land were being shaped by political deals, economic interests, and external pressures that did not include them. Trust cracked. The idea of the state as protector started to collapse, replaced by a growing sense that it was a participant in extraction—if not a collaborator. For many, this moment became a turning point. Some of the same energy that filled the streets in 1974 would later feed into larger resistance movements in the 1980s. And even today, that legacy hasn’t disappeared. Student voices, community activists, and movements like “Save the Sudd” continue to question, resist, and expose. Because what those students discovered wasn’t just about a canal—it was about power, silence, and the cost of being ignored. So if you hear that there was a civil war, it was never a civil war but instead a resistant movement against the governement who want profit over people. </p>
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
      <p>As the canal cut deeper into the land, something else began to spread. There was signs of a quiet, invisible, and far more persistent than any machine: disease. Long before the first outbreak, the warnings were already there. Scientists working alongside the Jonglei Canal Investigation Team had identified exactly what would happen if the water system was disturbed. They documented snail species called Biomphalaria, Bulinus known carriers of schistosomiasis, along with parasites affecting both humans and cattle. Their conclusion wasn’t vague: altering the Sudd’s natural flow would create stagnant, slow-moving water—perfect breeding grounds for parasites and disease vectors. But just like the warnings about grazing land and migration, these findings were pushed aside. Why? Because public health didn’t fit the economic equation. The priority was “recovering water,” not protecting bodies.</p>
      <p>From a scientific perspective, the chain reaction is brutally clear. The Sudd’s natural system depends on moving, fluctuating water that needed flooding, drying, circulating. When that flow is disrupted, water gets trapped. It becomes warm, still, oxygen-poor. In these conditions, snail populations explode. These snails release parasitic larvae that penetrate human skin, leading to schistosomiasis that is a disease that damages organs, weakens the immune system, and, over time, can be fatal. At the same time, stagnant pools and invasive plants like water hyacinth create ideal habitats for mosquitoes, increasing malaria transmission. Additionally, Livestock suffered too that led to parasitic flukes spread through contaminated water, weakening cattle, reducing milk production, and causing death. This isn’t random, it’s ecological imbalance turned into a biological crisis. When you change water, you change life and disease is often the first thing to adapt.</p>
      <p>The public health consequences ripple outward fast. Communities that once relied on clean seasonal water now face contamination. Fishing declines, removing a major protein source, while disease increases malnutrition and vulnerability. In recent years, outbreaks like cholera in regions such as Bor and Malakal have been linked to unsafe water conditions connected to disrupted systems. Exact numbers are hard to track but partly because of conflict, displacement, and weak health infrastructure was a key  pattern that is undeniable that caused  rising disease, declining health, and increasing pressure on already fragile communities. Cattle losses, while less formally counted, are deeply felt because each loss is not just economic, but social and cultural. People adapt the only ways they can: avoiding certain waters, boiling what they can, relying on traditional knowledge, moving when possible. However, mobility itself is now restricted by the very canal that caused the problem.</p>
      <p>So why were these warnings ignored? Because acknowledging them would have meant admitting that the entire project was flawed. Politically and economically, the canal promised power: more water for northern agriculture, stronger control over the Nile, alignment with state-building goals. Public health risks were treated as “secondary effects” problems to manage later, or simply absorb. It’s a familiar pattern: when development is driven by extraction, the costs are externalized onto the most vulnerable. Governments, both then and now, have struggled to respond effectively. Limited resources, ongoing instability, and competing priorities mean that healthcare systems remain underfunded and reactive rather than preventative. What could have been avoided became normalized. And in the end, the disease wasn’t just biological—it was systemic: a failure to listen, a failure to protect, and a failure to see that disrupting an ecosystem doesn’t just change the land—it changes who lives, who suffers, and who is left to deal with the consequences.</p>
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
      <p>The halt of The Excavator Falls phase of the Jonglei Canal project was not a simple engineering pause, it became a turning point where infrastructure, rebellion, and ecological politics collided. The stoppage was largely driven by an armed resistance from the SPLA (Sudan People’s Liberation Army), which began targeting canal infrastructure between 1983 and 1984. According to the research archive, fighters sabotaged generators, disrupted excavation machinery, and ultimately forced the withdrawal of the French consortium CCI that had been operating the massive bucket-wheel excavator. This machine which an obvious symbol of industrial extraction, was effectively neutralized. The halt was also reinforced by earlier waves of resistance, especially the 1974 student protests in Juba, which helped frame the canal as a political and ecological violation rather than a neutral development project. These movements coalesced into a broader rejection of the state’s “hydraulic mission,” which treated the Sudd wetlands as wasted water rather than a living system.</p>
      <p>Politically, the halt created clear winners and losers. The Sudanese central government in Khartoum and downstream Egyptian interests were heavily disadvantaged, since the canal was designed to increase downstream Nile water availability for irrigation schemes like the Gezira project. Its suspension undermined long-standing economic promises tied to agricultural expansion and national water security narratives. At the same time, the SPLA and Southern communities gained symbolic and strategic momentum. Their manifesto (1983) framed the canal as part of a broader system of “cheap extraction of surplus” by an “oppressive minority clique,” tying infrastructure directly to political domination and economic inequality. This framing helped unify fragmented resistance groups under a shared cause: stopping environmental extraction that also meant social displacement. The manifesto effectively turned the canal into a symbol of sovereignty, land rights, and ecological survival rather than just a construction site.</p>
      <p>After the halt, the consequences were mixed and deeply unstable. On one hand, construction abandonment left behind a partially excavated 260-kilometer trench, which still blocks migration routes for cattle and wildlife, creating long-term ecological fragmentation. Flood dynamics also worsened in later decades because the partial canal disrupted natural sheet flow without providing a completed drainage system, contributing to severe flooding events in the 2020s. On the political side, the government saw the halt as sabotage and escalation of rebellion, leading to increased militarization in the region. Reports in the archive also point to hostage-taking, intimidation, and localized kidnapping incidents tied to the conflict around infrastructure sites, reflecting how the canal became part of broader civil war dynamics rather than an isolated project. Economically, both the state’s “promised prosperity” from increased Nile flow and the expectation of agricultural expansion collapsed. What replaced it was uncertainty: lost investment, abandoned machinery, and fractured development narratives. Yet for many local communities, the halt also meant avoiding a far greater ecological breakdown—preserving portions of the Sudd’s flood cycle, grazing systems, and fisheries that would have been severely disrupted by full canal completion. In that sense, the stoppage became both a political rupture and a form of unintended ecological protection, even as the unfinished infrastructure continues to shape life and conflict today.</p>
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
