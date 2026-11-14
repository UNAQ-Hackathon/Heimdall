/**
 * Data layer for Heimdall — backed by real processed NASA PSI combustion records
 * (`data/processed/psi-investigations.json`) and deterministic ranking (`ranking.js`).
 * Fully deterministic; zero invented numbers.
 */
import { SCENARIOS, resolveScenarioKey } from '../context/scenarios.js';
import {
  enrichInvestigationForUI,
  processedInvestigations,
  rankLocalInvestigations,
} from './ranking.js';

// ─── Investigations (Real Processed PSI Dataset) ────────────────────

export const INVESTIGATIONS = processedInvestigations.map((inv) =>
  enrichInvestigationForUI(inv)
);

// ─── Earth Spin-Off Applications ────────────────────────────────────

export const EARTH_APPLICATIONS = [
  {
    id: 'water-mist',
    title: 'Water Mist & Inert Gas Suppression',
    code: 'PSI // FLEX & FLEX-2',
    category: 'CIR / MDCA',
    taxonomy: 'DROPLET EXTINCTION & CO₂ / HELIUM DILUTION // ENCLOSED FACILITIES',
    description:
      'Droplet combustion and CO₂ / helium inert-gas dilution studies from FLEX and FLEX-2 in the CIR Multi-user Droplet Combustion Apparatus (MDCA) inform clean-agent and fine water-mist fire suppression systems.',
    stats: [
      { label: 'Facility', value: 'CIR / MDCA', color: 'cyan' },
      { label: 'Suppressants', value: 'CO₂ & He Dilution', color: 'green' },
    ],
    standard: 'NFPA 750 / Clean-Agent Enclosure Safety',
  },
  {
    id: 'smoke-detection',
    title: 'Multi-Criteria Smoke & Dust Detection',
    code: 'PSI // SAME, SAME-R & DAFT',
    category: 'ISS MSG',
    taxonomy: 'SMOKE AEROSOL SIZING & DUST DISCRIMINATION // HABITATS & MINES',
    description:
      'Smoke particle size distribution measurements from SAME and SAME-R in the MSG—and cabin dust characterization in DAFT and DAFT-2 using the SAME Pegasor instrument—enable false-alarm-immune fire detectors.',
    stats: [
      { label: 'Instrument', value: 'SAME Pegasor', color: 'amber' },
      { label: 'Application', value: 'Dust Discrimination', color: 'green' },
    ],
    standard: 'Spacecraft ECLSS & Industrial Particulate Sensing',
  },
  {
    id: 'material-screening',
    title: 'Material Flammability & Low-Emission Burners',
    code: 'PSI // BASS, SAFFIRE & ACME',
    category: 'MSG / CYGNUS / CIR',
    taxonomy: 'SOLID FLAMMABILITY & ELECTRIC-FIELD FLAME CONTROL // FIRE SAFETY',
    description:
      'Solid-fuel flame spread tests in BASS/BASS-II (MSG with SPICE flow duct) and Saffire-I/II/III (Cygnus), together with the 6 ACME gas-flame experiments in CIR (including E-FIELD Flames and BRE), refine material screening and clean industrial burners.',
    stats: [
      { label: 'ACME Scope', value: '6 Gas Experiments', color: 'rose' },
      { label: 'Max Tested O₂', value: '85% O₂ (CFI-G)', color: 'green' },
    ],
    standard: 'NASA-STD-6001B / Terrestrial Fire Codes',
  },
];

// ─── Compare Matrix Data (Verified PSI Hardware & Regimes) ──────────

export const COMPARISON_MATRIX = {
  headers: [
    'Study & Hardware',
    'Oxygen Conc. (% O₂)',
    'Ambient Pressure',
    'Fuel & Geometry',
    'Key PSI Scope & Findings',
  ],
  studies: [
    {
      id: 'saffire-iii',
      name: 'Saffire-III',
      tags: ['LARGE SLAB'],
      testbed: 'Saffire flow duct in Cygnus OA-5 spacecraft',
      orbit: 'Uncrewed Cygnus cargo vehicle post-ISS departure',
      o2Range: '21.0% O₂',
      o2Note: 'Cygnus cabin air baseline',
      pressure: '14.7 psi (1 atm)',
      pressureNote: 'Pressurized cargo cabin',
      fuel: 'Solid: SIBAL composite sheet',
      fuelNote: '75% cotton / 25% fiberglass, 0.4 m × 1.0 m panel',
      fuelTags: ['Solid Fuel'],
      behavior:
        'Large-scale concurrent flame spread tested at 0.20 m/s and 0.30 m/s forced air flow.',
      behaviorNote: 'Forced axial flow duct',
    },
    {
      id: 'bass-ii',
      name: 'BASS-II',
      tags: ['TEXTILES', 'RODS'],
      testbed: 'ISS MSG with SPICE flow duct',
      orbit: 'ISS Microgravity Science Glovebox',
      o2Range: '13.5% → 30.0% O₂ (nominal 21%)',
      o2Note: 'Controlled O₂/N₂ flow in SPICE duct',
      pressure: '14.7 psi (1 atm)',
      pressureNote: 'ISS cabin pressure',
      fuel: 'Solid: PMMA slabs/rods, SIBAL & Nomex',
      fuelNote: 'Flat sheets, rods, and spacecraft fabrics',
      fuelTags: ['Solid Fuel'],
      behavior:
        'Forced ventilation (0.0 to 0.50 m/s) lowers limiting oxygen index compared to 1g upward burning in low-speed flows.',
      behaviorNote: 'MSG + SPICE flow duct',
    },
    {
      id: 'flex-2',
      name: 'FLEX-2',
      tags: ['DROPLET'],
      testbed: 'CIR / Multi-user Droplet Combustion Apparatus (MDCA)',
      orbit: 'ISS Combustion Integrated Rack (CIR)',
      o2Range: '15.0% → 30.0% O₂',
      o2Note: 'O₂/N₂/CO₂/He mixtures in CIR chamber',
      pressure: '14.7 psi nominal (0.5 – 3.0 atm)',
      pressureNote: 'Sealed CIR chamber',
      fuel: 'Liquid droplet: n-heptane, n-octane, n-decane, methanol',
      fuelNote: '1.5 – 4.0 mm isolated/tethered spherical droplets',
      fuelTags: ['Liquid Droplet'],
      behavior:
        'Demonstrated radiative extinction of hot flames followed by second-stage low-temperature cool-flame burning.',
      behaviorNote: 'CIR / MDCA apparatus',
    },
    {
      id: 'acme-cfi-g',
      name: 'CFI-G (ACME)',
      tags: ['GAS FLAME', 'HIGH O₂'],
      testbed: 'CIR / ACME (Advanced Combustion via Microgravity Experiments)',
      orbit: 'ISS Combustion Integrated Rack (1 of 6 ACME gas experiments)',
      o2Range: '21.0% → 85.0% O₂',
      o2Note: 'Highest O₂ in PSI (up to 85% O₂ from burner)',
      pressure: '14.7 psi',
      pressureNote: 'CIR chamber',
      fuel: 'Gas: n-butane and methane mixtures',
      fuelNote: 'Porous spherical gas burner',
      fuelTags: ['Gas Fuel'],
      behavior:
        'Mapped non-premixed gaseous cool-flame and hot-flame boundaries at oxygen concentrations up to 85% O₂.',
      behaviorNote: 'Highest-O₂ PSI dataset',
    },
    {
      id: 'acme-e-field',
      name: 'E-FIELD Flames (ACME)',
      tags: ['GAS FLAME', 'PARTIAL-G PROXY'],
      testbed: 'CIR / ACME with high-voltage electrode mesh',
      orbit: 'ISS Combustion Integrated Rack (1 of 6 ACME gas experiments)',
      o2Range: '21.0% O₂',
      o2Note: 'CIR chamber air',
      pressure: '14.7 psi',
      pressureNote: 'CIR chamber',
      fuel: 'Gas: Methane and ethylene diffusion flames',
      fuelNote: 'Circular coflow/jet gas burner',
      fuelTags: ['Gas Fuel'],
      behavior:
        'Ion-driven wind from electric fields acts as an adjustable body-force proxy for partial gravity (lunar/Martian convection).',
      behaviorNote: 'Partial-gravity proxy',
    },
  ],
};

// ─── Cross-findings (insights from comparing studies) ───────────────

export const CROSS_FINDINGS = [
  {
    title: 'Partial-Gravity Bounds (0g ↔ 1g)',
    text: 'PSI contains no direct lunar (0.165g) or Martian (0.38g) flight data. Habitat fire risk must be presented as a bounded range between microgravity and 1g, with E-FIELD Flames (ACME) serving as an electrostatic body-force proxy.',
  },
  {
    title: 'High-Oxygen Habitat & Suit Regimes',
    text: 'Lunar/Martian habitats (≥30% O₂, ≤10.2 psi) and spacesuits (100% O₂, 4.3 psi) increase flammability. BRE and Flame Design cover ~30–50% O₂, while CFI-G provides the highest O₂ tests in PSI (up to 85% O₂ from the burner).',
  },
  {
    title: 'Hardware & Fuel Taxonomy Across PSI',
    text: 'ACME comprises 6 gas-flame studies in CIR; FLEX, FLEX-2, and CFI burn liquid droplets in CIR/MDCA; BASS, BASS-II, SPICE, and SLICE use the MSG with the SPICE flow duct; SAME/SAME-R and DAFT/DAFT-2 characterize smoke and cabin dust.',
  },
];

// ─── Flame 3D Comparison Data (Qualitative / Illustrative) ──────────

export const FLAME_COMPARISON = {
  zeroG: {
    label: 'Microgravity Flame // ~0g (Illustrative)',
    isoLabel: 'DIFFUSION-BOUND',
    cameraId: 'ISS MICRO-G // ILLUSTRATIVE',
    regime: 'Molecular Diffusion Dominated (No Buoyancy)',
    flowRegime: 'DIFFUSIVE / LOW-FLOW',
    buoyancy: '~0 m/s²',
    sootRadiation: 'Low / Soot-Free Blue',
    quenchingZone: 'Spherical',
    emission: 'CH* / OH* Chemiluminescence (Illustrative)',
    symRatio: '~1 : 1 Spherical',
    peakCoreTemp: 'Lower Bound',
    peakLabel: 'Radiative Quench Limit',
    quenchRadius: 'Spherical',
    quenchLabel: 'Diffusion Envelope',
    spectralMode: 'Blue Spherical',
    spectralLabel: 'Micro-g Morphology',
    description:
      'In microgravity, the absence of buoyant convection restricts oxygen transport to molecular diffusion (and cabin ventilation). Flames form a dim blue spherical shape — shown here as a qualitative illustration.',
  },
  oneG: {
    label: 'Earth Gravity Flame // 1g (Illustrative)',
    isoLabel: 'BUOYANCY-BOUND',
    cameraId: 'EARTH 1G // ILLUSTRATIVE',
    regime: 'Buoyant Natural Convection Driven',
    flowRegime: 'BUOYANT CONVECTIVE',
    buoyancy: '9.81 m/s² (1g)',
    sootRadiation: 'Incandescent Soot Plume',
    upwardDraft: 'Buoyant Plume',
    emission: 'Continuous Soot Incandescence (Illustrative)',
    aspectRatio: 'Elongated Teardrop',
    peakCoreTemp: '1g Baseline',
    peakLabel: 'Buoyant Entrainment',
    flameHeightStat: 'Teardrop',
    flameHeightLabel: 'Upward Plume',
    aspectRatioStat: 'Elongated',
    aspectRatioLabel: 'Buoyancy Driven',
    description:
      'In 1g on Earth, heated combustion gases rise rapidly due to buoyancy, entraining fresh oxidizer at the base and stretching the flame into a yellow-orange teardrop plume — shown here as a qualitative illustration.',
  },
  controls: {
    oxygenConcentration: { value: 30, min: 10, max: 100, unit: '% O₂', label: 'Oxygen Concentration' },
    forcedVentilation: { value: 0.1, min: 0, max: 0.6, step: 0.01, unit: 'm/s', label: 'Forced Ventilation (Airflow)' },
    gravity: { value: 0, options: ['Micro-g (~0g)', 'Scenario (0.165g / 0.38g)', '1g (Earth)'], label: 'Gravity Regime' },
  },
};

// ─── Solar System Planets (for 3D scene) ────────────────────────────

export const PLANETS = [
  { name: 'Sol',      model: '/models/planetas/Sol.glb',      color: '#fbbf24', size: 2.2,  distance: 0,    au: '0.00 AU', orbitSpeed: 0,      initialAngle: 0 },
  { name: 'Mercury',  model: '/models/planetas/Mercurio.glb', color: '#9ca3af', size: 0.28, distance: 4.5,  au: '0.39 AU', orbitSpeed: 0.016,  initialAngle: 0.8 },
  { name: 'Venus',    model: '/models/planetas/Venus.glb',    color: '#f59e0b', size: 0.65, distance: 7.2,  au: '0.72 AU', orbitSpeed: 0.010,  initialAngle: 2.4 },
  { name: 'Earth',    model: '/models/planetas/Tierra.glb',   color: '#3b82f6', size: 0.70, distance: 10.2, au: '1.00 AU', orbitSpeed: 0.007,  initialAngle: 4.1 },
  { name: 'Moon',     model: '/models/planetas/Luna.glb',     color: '#d1d5db', size: 0.19, distance: 1.35, au: '384,400 km', orbitSpeed: 0.045, initialAngle: 1.2, parent: 'Earth' },
  { name: 'Mars',     model: '/models/planetas/Marte.glb',    color: '#ef4444', size: 0.40, distance: 18.2, au: '1.52 AU', orbitSpeed: 0.0045, initialAngle: 5.5 },
  { name: 'Jupiter',  model: '/models/planetas/Jupiter.glb',  color: '#d97706', size: 1.55, distance: 26.5, au: '5.20 AU', orbitSpeed: 0.0018, initialAngle: 1.7 },
  { name: 'Saturn',   model: '/models/planetas/Saturno.glb',  color: '#eab308', size: 1.85, distance: 36.5, au: '9.54 AU', orbitSpeed: 0.0010, initialAngle: 3.6 },
  { name: 'Uranus',   model: '/models/planetas/Urano.glb',    color: '#67e8f9', size: 0.96, distance: 48.0, au: '19.19 AU', orbitSpeed: 0.0005, initialAngle: 0.4 },
  { name: 'Neptune',  model: '/models/planetas/Neptuno.glb',  color: '#6366f1', size: 0.92, distance: 60.0, au: '30.07 AU', orbitSpeed: 0.0003, initialAngle: 4.9 },
];

// ─── Deterministic Ranking Engine (mirrors api/src/services/ranking.service.js) ──

export function rankInvestigations(scenarioOrKey, weights = {}, categoryFilter = 'all') {
  const scenarioObj =
    typeof scenarioOrKey === 'string'
      ? SCENARIOS[resolveScenarioKey(scenarioOrKey)] ?? SCENARIOS.moon
      : scenarioOrKey ?? SCENARIOS.moon;

  const ranked = rankLocalInvestigations(
    { ...scenarioObj, category: categoryFilter },
    weights
  );

  return ranked.map((r) => r.investigation);
}

// ─── Chat Initial History ───────────────────────────────────────────

export const CHAT_HISTORY = [
  {
    role: 'user',
    text: '"Which PSI studies apply to a ≥30% O₂, ≤10.2 psi lunar habitat?"',
  },
  {
    role: 'ai',
    text: 'Because PSI contains no direct partial-gravity (0.165g) combustion data, lunar habitat fire risk is bounded between **microgravity** and **1g** baselines. **BRE** and **Flame Design** (ACME in CIR) and **FLEX-2** (CIR/MDCA) tested elevated oxygen up to 30–50% O₂, **CFI-G** (ACME) reached up to 85% O₂ from the burner, and **E-FIELD Flames** (ACME) serves as an experimental body-force proxy for partial gravity.',
    citations: [
      { label: 'BRE', studyId: 'acme-bre' },
      { label: 'E-FIELD Flames', studyId: 'acme-e-field' },
      { label: 'CFI-G', studyId: 'acme-cfi-g' },
    ],
  },
];

export const api = {
  listInvestigations: async () => ({
    data: INVESTIGATIONS,
    total: INVESTIGATIONS.length,
  }),
  getInvestigation: async (id) => {
    const inv = INVESTIGATIONS.find((i) => i.id === id || i.psiId === id);
    if (!inv) throw new Error(`Investigation "${id}" not found`);
    return inv;
  },
  rank: async (scenarioKey, weights, category = 'all') => ({
    data: rankInvestigations(scenarioKey, weights, category),
  }),
  getComparisonMatrix: async () => COMPARISON_MATRIX,
  getEarthApplications: async () => EARTH_APPLICATIONS,
  getCrossFindings: async () => CROSS_FINDINGS,
};
