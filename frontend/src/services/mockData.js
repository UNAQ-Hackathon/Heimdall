/**
 * Mock data layer for Heimdall — based on real NASA PSI combustion experiments.
 * All data is structured to mirror the future API response shapes.
 */

// ─── Investigations (PSI Experiments) ───────────────────────────────

export const INVESTIGATIONS = [
  {
    id: 'saffire-iii',
    name: 'Saffire-III',
    facility: 'Orbital Cygnus',
    category: 'prevention',
    subtitle: 'Large-Scale Microgravity Flammability & Oxygen Limits',
    description: 'Axial forced convection flow duct combustion inside uncrewed Cygnus OA-5 Pressurized Cargo Module.',
    fuelGeometry: 'PMMA Solid Sheet',
    fuelDetail: '0.4 × 1.0 m, thick structural composite panel',
    oxygenRange: '21.0% → 34.0% O₂',
    ambientPressure: '10.2 psi (70.0 kPa)',
    ambientLabel: 'Sub-ambient exploration standard',
    flowVelocity: '0.05 to 0.20 m/s',
    criticalBehavior: 'Low-velocity concurrent flame spread with non-linear oxygen acceleration kinetics. L_inf: 0.24 m/s forced airflow.',
    tags: ['Structural Composite'],
    orbit: 'ISS alt 405 km LEO / POD1-OBSERVATIONS',
    runsArchived: 9,
    verified: true,
    verifiedLabel: 'VERIFIED FLIGHT DATA (NASA GLENN RC)',
    missionDuration: '+142:08:14',
    vehicle: 'Cygnus OA-5 Mission',
    archiveCode: 'EXP-SAFFIRE-03',
    flightLog: 'NASA-CR-2017-SAFFIRE3',
    calibrationProtocol: 'GRC-MICRO-FLAME-04',
    scores: {
      overall: 94,
      geometry: 32,
      o2Conc: 38,
      flowVel: 24,
      quenchLimit: 6,
    },
    aiSummary: {
      student: 'This experiment burned large plastic sheets inside an empty cargo spacecraft to learn how fires grow in space. Results show fires spread faster when there is more oxygen.',
      engineer: 'PMMA burn rate accelerates under 28–34% O₂ bounding envelope precisely aligns with Lunar ECLSS spec.',
    },
    aiInsight: 'Upward combustion transition occurs at 28.4% O₂; flame front velocity increases non-linearly with concurrent ventilation, exhibiting lower soot quenching than 1g models predict.',
    synthesis: {
      missionObjective: 'Investigate flame spread limits and mass consumption on practical-thickness PMMA slabs inside Cygnus cargo vehicle after ISS unberthing.',
      fuelAndGeometry: 'Polymethyl Methacrylate (PMMA), 50mm thick, 0.4 × 1.0 m sheet mounted along axial flow tunnel with nichrome ignition wire.',
      testConditions: 'O₂: 21% → 34% | Total P: 78 kPa (10.2 psi) | Forced Flow: 0.05 to 0.20 m/s.',
      telemetryArray: '6 calibrated radiometers, 24 thermocouple arrays (Type K), high-speed dual-spectrum UV/IR, static pressure taps.',
    },
    confidence: 96,
    timeSeries: generateTimeSeries(300, 18, 45, [
      { time: 78, label: 'Phase 2: Flashover', color: '#fb923c' },
      { time: 195, label: 'Radiant Heat Peak', color: '#fb7185' },
    ]),
    flammabilityMap: generateFlammabilityMap(),
  },
  {
    id: 'bass-ii',
    name: 'BASS-II',
    facility: 'ISS MSG Glovebox',
    category: 'suppression',
    subtitle: 'Solid Fuel Extinction & Flame Quenching',
    description: 'Validated extinction limits for Nomex and Kapton textiles in quiescent low-convection habitable cabins.',
    fuelGeometry: 'Nomex / Kapton Fabrics',
    fuelDetail: 'Thin textiles & cylindrical wire insulation',
    oxygenRange: '56.0% → 21.0% O₂',
    ambientPressure: '14.7 psi (101.3 kPa)',
    ambientLabel: 'Sea-level ISS atmosphere',
    flowVelocity: 'Quiescent / Natural convection',
    criticalBehavior: 'Radiative flame extinction limits with critical forced ventilation threshold at O2G min.',
    tags: ['Textiles / Rods'],
    orbit: 'ORBIT: CISEAR HABITAT INTERIOR',
    runsArchived: 42,
    verified: true,
    verifiedLabel: 'ISS VERIFIED',
    scores: {
      overall: 88,
      quenchLimit: 48,
      pressureFit: 36,
      gSens: 18,
    },
    aiSummary: {
      student: 'Scientists tested how easily common spacecraft fabrics catch fire and go out in zero gravity, helping design safer cabin materials.',
      engineer: 'Validated extinction limits for Nomex and Kapton textiles in quiescent low-convection habitable cabins.',
    },
  },
  {
    id: 'acme',
    name: 'ACME',
    facility: 'CIRT Chamber',
    category: 'detection',
    subtitle: 'Gas Flame Diffusion & Soot Dynamics',
    description: 'Soot-free spherical flame behavior models provide baseline bounds for oxygen-enriched lunar modules.',
    fuelGeometry: 'Alkane / Heptane Droplets',
    fuelDetail: '1.5 – 3.0 mm spherical free suspension',
    oxygenRange: '15.0% → 40.0% O₂',
    ambientPressure: '14.7 psi',
    ambientLabel: 'High-pressure quenching spectrum',
    flowVelocity: '(1.0 - 3.0 atl)',
    criticalBehavior: 'Cool flame molecular transport kinetics & persistent quasi-steady spherical symmetry.',
    tags: ['Pure Liquid Fuel'],
    orbit: 'ISOLATED MICRO-VOLUME CHAMBERS',
    runsArchived: 18,
    verified: true,
    scores: {
      overall: 81,
      diffusion: 45,
      atmoBlend: 22,
      convect: 14,
    },
    aiSummary: {
      student: 'Tiny fuel droplets were burned to study perfectly round flames that only form in zero gravity, teaching us about fire chemistry.',
      engineer: 'Soot-free spherical flame behavior models provide baseline bounds for oxygen-enriched lunar modules.',
    },
  },
  {
    id: 'flex-2',
    name: 'FLEX-2',
    facility: 'Droplet Array',
    category: 'prevention',
    subtitle: 'Multi-Laser Droplet Combustion Chamber (MDC)',
    description: 'Droplet flame dynamics and extinction limits in reduced gravity environments.',
    fuelGeometry: 'Alkane / Heptane Droplets',
    fuelDetail: '1.5 – 3.0 mm spherical free suspension',
    oxygenRange: '18.0% → 30.0% O₂',
    ambientPressure: '14.7 psi',
    ambientLabel: 'Multi-volume balance (N₂/Cb)',
    flowVelocity: '/ ms diluent)',
    criticalBehavior: 'Cool flame molecular transport kinetics & persistent quasi-steady spherical symmetry.',
    tags: ['Pure Liquid Fuel'],
    orbit: 'ISOLATED MICRO-VOLUME CHAMBERS',
    runsArchived: 24,
    verified: true,
    scores: {
      overall: 76,
      geometry: 28,
      o2Conc: 22,
      flowVel: 18,
      quenchLimit: 8,
    },
    aiSummary: {
      student: 'This experiment used lasers to precisely position tiny fuel drops in space, showing how they burn very differently from Earth.',
      engineer: 'Droplet combustion dynamics reveal critical second-stage cool-flame behavior with extended residence times in reduced convection environments.',
    },
  },
  {
    id: 'same',
    name: 'SAME',
    facility: 'MSG Module',
    category: 'detection',
    subtitle: 'Smoke Aerosol Measurement Experiment',
    description: 'Characterization of smoke particle size distributions from spacecraft-relevant materials in microgravity.',
    fuelGeometry: 'Wire insulation / Kapton',
    fuelDetail: 'Standard ISS cable insulation samples',
    oxygenRange: '21.0% O₂',
    ambientPressure: '14.7 psi (101.3 kPa)',
    ambientLabel: 'ISS standard atmosphere',
    flowVelocity: 'Quiescent',
    criticalBehavior: 'Smoke particle distributions differ significantly from 1g baselines, with larger particle mean diameter.',
    tags: ['Smoke/Aerosol'],
    runsArchived: 15,
    verified: true,
    scores: {
      overall: 72,
      detection: 55,
      particleSize: 30,
      sensitivity: 15,
    },
    aiSummary: {
      student: 'By burning common spacecraft materials, scientists measured the smoke particles produced in zero gravity to improve fire alarms on future missions.',
      engineer: 'Microgravity smoke aerosol size distributions from spacecraft polymers inform next-gen particulate detector threshold calibration for ECLSS integration.',
    },
  },
];

// ─── Time Series Generator ──────────────────────────────────────────

function generateTimeSeries(points, minT, maxT, peaks) {
  const data = [];
  for (let i = 0; i < points; i++) {
    const t = (i / points) * 300; // 300 seconds
    let tc = minT + ((maxT - minT) * 0.3) + Math.sin(t / 30) * 5 + Math.random() * 3;
    let flux = 0.5 + Math.sin(t / 25) * 0.2 + Math.random() * 0.1;

    // Add peaks
    peaks.forEach(p => {
      const dist = Math.abs(t - p.time);
      if (dist < 20) {
        tc += (20 - dist) * 1.2;
        flux += (20 - dist) * 0.05;
      }
    });

    data.push({
      time: Math.round(t * 10) / 10,
      temperature: Math.round(tc * 10) / 10,
      radiantFlux: Math.round(flux * 1000) / 1000,
    });
  }
  return { data, peaks };
}

// ─── Flammability Map Generator ─────────────────────────────────────

function generateFlammabilityMap() {
  const data = [];
  for (let o2 = 15; o2 <= 40; o2 += 1) {
    for (let flow = 0; flow <= 0.4; flow += 0.02) {
      const flammable = o2 > 18 + flow * 20 && o2 < 38 - flow * 10;
      const boundary  = Math.abs(o2 - (18 + flow * 20)) < 2 || Math.abs(o2 - (38 - flow * 10)) < 2;
      data.push({
        o2: Math.round(o2 * 10) / 10,
        flow: Math.round(flow * 100) / 100,
        regime: flammable ? 'flammable' : 'non-flammable',
        boundary,
        nonPropThreshold: boundary ? o2 + (Math.random() - 0.5) * 2 : null,
        extinctionLimit: boundary ? flow + (Math.random() - 0.5) * 0.02 : null,
      });
    }
  }
  return data;
}

// ─── Earth Spin-Off Applications ────────────────────────────────────

export const EARTH_APPLICATIONS = [
  {
    id: 'water-mist',
    title: 'Water Mist Suppression',
    code: 'ESP // SPIN-758',
    category: 'NSF // SPIN-758',
    taxonomy: 'TERRESTRIAL MINI-HAZARD ENCLOSURES // MARINE ALTERNATIVES',
    description: 'Microdroplet kinetic insights derived from FLEX-2 & Saffire droplet evaporation inform ultra-fine water mist fire suppression systems for commercial data centers and historic maritime hulls without toxic fluorochemicals.',
    stats: [
      { label: 'Consumption', value: '-90% Water Volume', color: 'green' },
      { label: 'Impact', value: 'Zero Ozone Depletion', color: 'cyan' },
    ],
    standard: 'NFPA 750 / UL-Listed Terrestrial',
  },
  {
    id: 'smoke-detection',
    title: 'Early Smoke Detection',
    code: 'NSG // SPIN-429',
    category: 'NSG // SPIN-429',
    taxonomy: 'AIR-BORNE PARTICULATE DETECTION // MINING & TUNNELS',
    description: 'Diffusion-dominated soot agglomeration physics led to laser-particulate sensors capable of detecting pyrolysis gas aerosols up to 15 minutes before open ignition, deployed across subterranean transit and deep-shaft mines.',
    stats: [
      { label: 'Detection Horizon', value: '+15 Min Advance', color: 'amber' },
      { label: 'Accuracy', value: '99.2% False-Reject', color: 'green' },
    ],
    standard: 'NISSA Mining / Subsea Pipelines',
  },
  {
    id: 'firefighter-gear',
    title: 'Firefighter Protective Gear',
    code: 'SAT // SPIN-1071',
    category: 'SAT // SPIN-1071',
    taxonomy: 'HIGH-TEMP THERMAL INSULATION & COMPOSITES // STRUCTURAL FIREFIGHTING',
    description: 'Radiative heat-flux models and char-layer pyrolysis measurements from BASS-II flame spread over treated polyimide textiles directly optimized lighter, breathable multi-layer thermal protective suits for first responders.',
    stats: [
      { label: 'Thermal Emergency', value: '+60% Heat Flux', color: 'rose' },
      { label: 'Ergonomics', value: '-25% Suit Weight', color: 'green' },
    ],
    standard: 'NFPA 1971 Turnout / Municipal Code',
  },
];

// ─── Compare Matrix Data ────────────────────────────────────────────

export const COMPARISON_MATRIX = {
  headers: ['Study & Testbed', 'Oxygen Conc. (% O₂)', 'Ambient Pressure', 'Fuel & Geometry', 'Critical Regime Behavior'],
  studies: [
    {
      id: 'saffire-iii',
      name: 'Saffire-III',
      tags: ['LARGE SLAB'],
      testbed: 'Cygnus OA-5 Autonomous Pressurized Vessel',
      orbit: 'ISS alt 405 km LEO / POD1-OBSERVATIONS',
      o2Range: '21.0% → 34.0% O₂',
      o2Note: 'Lunar Habitat Boundary Region',
      pressure: '10.2 psi (70.0 kPa)',
      pressureNote: 'Sub-ambient exploration standard',
      fuel: 'PMMA Solid Sheet',
      fuelNote: '0.4 × 1.0 m, thick structural composite panel',
      fuelTags: ['Structural Composite'],
      behavior: 'Low-velocity concurrent flame spread with non-linear oxygen acceleration kinetics.',
      behaviorNote: 'L_inf: 0.24 m/s forced airflow',
    },
    {
      id: 'bass-ii',
      name: 'BASS-II',
      tags: ['TEXTILES', 'RODS'],
      testbed: 'ISS Microgravity Science Glovebox (MSG)',
      orbit: 'ORBIT: CISEAR HABITAT INTERIOR',
      o2Range: '56.0% → 21.0% O₂',
      o2Note: 'Domestic Cabin standard baseline',
      pressure: '14.7 psi (101.3 kPa)',
      pressureNote: 'Sea-level ISS atmosphere',
      fuel: 'Nomex / Kapton Fabrics',
      fuelNote: 'Thin textiles & cylindrical wire insulation',
      fuelTags: ['Multilayer'],
      behavior: 'Radiative flame extinction limits with critical forced ventilation threshold at O₂G min.',
      behaviorNote: 'Radiation loss governs self-quench',
    },
    {
      id: 'flex-2',
      name: 'FLEX-2',
      tags: ['DROPLET ARRAY'],
      testbed: 'Multi-Laser Droplet Combustion Chamber (MDC)',
      orbit: 'ISOLATED MICRO-VOLUME CHAMBERS',
      o2Range: '18.0% → 30.0% O₂',
      o2Note: 'Multi-volume balance (N₂ / Cb / ms diluent)',
      pressure: '14.7 → (1.0 - 3.0 atl)',
      pressureNote: 'High-pressure quenching spectrum',
      fuel: 'Alkane / Heptane Droplets',
      fuelNote: '1.5 – 3.0 mm spherical free suspension',
      fuelTags: ['Pure Liquid Fuel'],
      behavior: 'Cool flame molecular transport kinetics & persistent quasi-steady spherical symmetry.',
      behaviorNote: 'Second-stage low-temp burn',
    },
  ],
};

// ─── Cross-findings (insights from comparing studies) ───────────────

export const CROSS_FINDINGS = [
  {
    title: 'Stress Threshold Delta',
    text: 'Saffire-III tests show structural composite burn rate shifts exponentially above 28% O₂, shifting extinction limits observed in smaller BASS/II envelopes.',
  },
  {
    title: 'Pressure Quench Divergence',
    text: 'FLEX-2 elevated pressure runs (3 atm) accelerate soot precursor synthesis, whereas Saffire sub-ambient 10.2 psi suppresses secondary aerosol plumes.',
  },
  {
    title: 'Zero-Buoyancy Stagnation',
    text: 'Absence of buoyant convective lift creates thick diffusion boundaries, including low-temperature cool flame regimes not naturally sustainable in 1G.',
  },
];

// ─── Flame 3D Comparison Data ───────────────────────────────────────

export const FLAME_COMPARISON = {
  zeroG: {
    label: 'Microgravity Flame // 0g',
    isoLabel: 'ISO-DIFF',
    cameraId: 'ISS 0.0g // CH-01',
    regime: 'Quiescent Diffusion Dominated + Pure Radicals',
    flowRegime: 'DIFFUSIVE',
    buoyancy: '0.00 m/s²',
    sootRadiation: '~0.1%',
    quenchingZone: 'Spherical',
    radialExpansion: '17.7 mm',
    emission: 'CH+ Emission: 431.4 nm',
    symRatio: '1.00 : 1.00',
    peakCoreTemp: '643°C',
    peakLabel: 'Nominal Quench',
    quenchRadius: '17.7 mm',
    quenchLabel: 'Spherical Envelope',
    spectralMode: 'CH+ Chemilum',
    spectralLabel: 'Soot-Free Diffusion',
    description: 'In microgravity, the absence of buoyant convection restricts oxygen transport solely to molecular diffusion. This yields a completely symmetric, cooler, dim blue spherical flame with virtually zero soot formation and a prolonged residence time.',
  },
  oneG: {
    label: 'Earth Gravity Flame // 1g',
    isoLabel: 'BUOY-DYN',
    cameraId: 'STD 1.0g // CH-02',
    regime: 'Buoyant Convection Driven + Incandescent Soot',
    flowRegime: 'CONVECTIVE',
    buoyancy: '9.81 m/s²',
    sootRadiation: 'Elevated (High)',
    upwardDraft: '1.8 m/s',
    flameHeight: '25.5 mm',
    emission: 'Incandescence: Continuous',
    aspectRatio: '3.40 : 1.00',
    peakCoreTemp: '958°C',
    peakLabel: 'Soot Emission Max',
    flameHeightStat: '25.5 mm',
    flameHeightLabel: 'Teardrop Plume',
    aspectRatioStat: '3.4 : 1',
    aspectRatioLabel: 'Buoyancy Accelerated',
    description: 'In 1g, heated combustion gases rise rapidly due to buoyancy-induced convection, continuously entraining fresh oxidizer at the base. This stretches the reaction zone upward and heats unburnt soot particles to glowing yellow-orange incandescence.',
  },
  controls: {
    oxygenConcentration: { value: 30, min: 15, max: 40, unit: 'O₂', label: 'Oxygen Concentration' },
    forcedVentilation:   { value: 0.05, min: 0, max: 0.3, step: 0.01, unit: 'm/s', label: 'Forced Ventilation (Airflow)' },
    gravity:             { value: 0, options: ['0g ISS', '0.16g Moon', '0.38g Mars', '1g Earth'], label: 'Gravity Vector Field' },
  },
};

// ─── Solar System Planets (for 3D scene) ────────────────────────────

export const PLANETS = [
  { name: 'Sol',      model: '/models/planetas/Sol.glb',      color: '#fbbf24', size: 2.2,  distance: 0,    au: '0.00 AU', orbitSpeed: 0,      initialAngle: 0 },
  { name: 'Mercury',  model: '/models/planetas/Mercurio.glb', color: '#9ca3af', size: 0.28, distance: 4.6,  au: '0.39 AU', orbitSpeed: 0.016,  initialAngle: 0.8 },
  { name: 'Venus',    model: '/models/planetas/Venus.glb',    color: '#f59e0b', size: 0.65, distance: 7.4,  au: '0.72 AU', orbitSpeed: 0.010,  initialAngle: 2.4 },
  { name: 'Earth',    model: '/models/planetas/Tierra.glb',   color: '#3b82f6', size: 0.70, distance: 10.6, au: '1.00 AU', orbitSpeed: 0.007,  initialAngle: 4.1 },
  { name: 'Moon',     model: '/models/planetas/Luna.glb',     color: '#d1d5db', size: 0.19, distance: 1.35, au: '384,400 km', orbitSpeed: 0.045, initialAngle: 1.2, parent: 'Earth' },
  { name: 'Mars',     model: '/models/planetas/Marte.glb',    color: '#ef4444', size: 0.38, distance: 15.2, au: '1.52 AU', orbitSpeed: 0.0045, initialAngle: 5.5 },
  { name: 'Jupiter',  model: '/models/planetas/Jupiter.glb',  color: '#d97706', size: 1.55, distance: 26.5, au: '5.20 AU', orbitSpeed: 0.0018, initialAngle: 1.7 },
  { name: 'Saturn',   model: '/models/planetas/Saturno.glb',  color: '#eab308', size: 1.85, distance: 38.5, au: '9.54 AU', orbitSpeed: 0.0010, initialAngle: 3.6 },
  { name: 'Uranus',   model: '/models/planetas/Urano.glb',    color: '#67e8f9', size: 0.96, distance: 53.0, au: '19.19 AU', orbitSpeed: 0.0005, initialAngle: 0.4 },
  { name: 'Neptune',  model: '/models/planetas/Neptuno.glb',  color: '#6366f1', size: 0.92, distance: 68.0, au: '30.07 AU', orbitSpeed: 0.0003, initialAngle: 4.9 },
];

// ─── Ranking Engine (mock, mirrors api/ranking.service.js) ──────────

export function rankInvestigations(scenarioKey, weights, categoryFilter = 'all') {
  let items = [...INVESTIGATIONS];
  if (categoryFilter !== 'all') {
    items = items.filter(inv => inv.category === categoryFilter);
  }

  // Simulate weighted scoring per scenario
  return items
    .map(inv => {
      const base = inv.scores.overall;
      const scenarioBonus = scenarioKey === 'lunarBase' && inv.oxygenRange.includes('34') ? 4 : 0;
      const total = Math.min(99, base + scenarioBonus + Math.floor(Math.random() * 3));
      return { ...inv, matchScore: total };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

// ─── Chat Mock ──────────────────────────────────────────────────────

export const CHAT_HISTORY = [
  {
    role: 'user',
    text: '"Which studies apply to a 30% O₂ lunar habitat?"',
  },
  {
    role: 'ai',
    text: '**Saffire-III** provides the closest empirical upper-bound for flame spread over structural composites at elevated oxygen concentrations.',
    citations: [
      { label: 'Saffire-III', studyId: 'saffire-iii' },
    ],
  },
  {
    role: 'ai',
    text: '**BASS-II** establishes critical extinction airflows under partial atmospheric pressures.',
    citations: [
      { label: 'BASS-II', studyId: 'bass-ii' },
    ],
  },
];

// ─── API layer (mock-first, will swap to real fetch later) ──────────

const delay = (ms) => new Promise(r => setTimeout(r, ms));

export const api = {
  listInvestigations: async (params = {}) => {
    await delay(120);
    return { data: INVESTIGATIONS, total: INVESTIGATIONS.length };
  },

  getInvestigation: async (id) => {
    await delay(80);
    const inv = INVESTIGATIONS.find(i => i.id === id);
    if (!inv) throw new Error(`Investigation "${id}" not found`);
    return inv;
  },

  rank: async (scenarioKey, weights, category = 'all') => {
    await delay(150);
    return {
      data: rankInvestigations(scenarioKey, weights, category),
      model: 'NEURAL_COMBUSTION_v4.2',
      confidence: 98.4,
      datasetsQueried: 14,
      source: 'NASA PSI EST_MATCH: HIGH',
    };
  },

  ask: async (question) => {
    await delay(300);
    return {
      answer: `Based on the PSI database analysis, the query "${question}" maps to experiments with overlapping O₂ concentration ranges. Saffire-III and BASS-II provide the strongest empirical bounds for this scenario.`,
      citations: [
        { label: 'Saffire-III', studyId: 'saffire-iii' },
        { label: 'BASS-II', studyId: 'bass-ii' },
      ],
    };
  },

  getTimeSeries: async (studyId) => {
    await delay(100);
    const inv = INVESTIGATIONS.find(i => i.id === studyId);
    return inv?.timeSeries || generateTimeSeries(200, 18, 40, []);
  },

  getFlammabilityMap: async (studyId) => {
    await delay(100);
    const inv = INVESTIGATIONS.find(i => i.id === studyId);
    return inv?.flammabilityMap || generateFlammabilityMap();
  },

  getComparisonMatrix: async () => {
    await delay(100);
    return COMPARISON_MATRIX;
  },

  getEarthApplications: async () => {
    await delay(80);
    return EARTH_APPLICATIONS;
  },

  getCrossFindings: async () => {
    await delay(80);
    return CROSS_FINDINGS;
  },
};
