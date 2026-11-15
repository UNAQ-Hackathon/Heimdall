import flexData from '../data/flex-trials.json' with { type: 'json' };
import { CATALOG_HARDWARE_FILTERS } from './psi-catalog.js';

export const EARTH_BASELINE = Object.freeze({
  o2Pct: 21.0,
  pressurePsi: 14.7,
  pressureMmhg: 760.0,
  flowVelocity: 0.0,
});

export const OXYGEN_REGIME_FILTERS = [
  { id: 'all', label: 'All O₂' },
  { id: 'hypoxic', label: 'Hypoxic (≤18%)' },
  { id: 'nominal', label: 'Nominal (19–22%)' },
  { id: 'enriched', label: 'Enriched (23–35%)' },
  { id: 'hyperoxic', label: 'Hyperoxic (>35%)' },
];

export const FLEX_FUEL_FILTERS = [
  { id: 'all', label: 'All Fuels' },
  { id: 'Methanol', label: 'Methanol' },
  { id: 'Heptane', label: 'Heptane' },
];

export const FLEX_MIX_FILTERS = [
  { id: 'all', label: 'All Gas Mixes' },
  { id: 'O₂/N₂', label: 'O₂ / N₂' },
  { id: 'CO₂', label: 'CO₂ Dilution' },
  { id: 'He', label: 'He Dilution' },
];

export const TELEMETRY_CHANNELS = [
  { id: 'o2', label: 'O₂ %', unit: '%' },
  { id: 'pressure', label: 'Chamber Pressure', unit: 'psi' },
  { id: 'secondary', label: 'Diameter / Flow', unit: 'mm · m/s' },
  { id: 'diluent', label: 'Inert Diluent (CO₂/He)', unit: '%' },
];

export function isDropletTelemetryStudy(study) {
  if (!study) return false;
  if (study.fuelType === 'droplet') return true;
  const code = String(study.acronym ?? study.psiId ?? study.id ?? '').toLowerCase();
  return /\bflex\b|flex-2|\bcfi\b/.test(code);
}

export function getAllFlexRuns() {
  const trials = Array.isArray(flexData?.trials) ? flexData.trials : [];
  return trials.map((t, index) => ({
    index: index + 1,
    runId: t.id,
    date: t.group,
    fuel: t.fuel,
    mix: t.mix,
    pressureMmhg: Number(t.p),
    pressurePsi: Number((Number(t.p) * 0.0193368).toFixed(2)),
    o2Pct: Number((Number(t.o2) * 100).toFixed(1)),
    n2Pct: Number((Number(t.n2) * 100).toFixed(1)),
    co2Pct: Number((Number(t.co2) * 100).toFixed(1)),
    hePct: Number((Number(t.he) * 100).toFixed(1)),
    diameterMm: Number(t.d),
    flowVelocity: null,
    gravity: 'microgravity',
    source: 'NASA PSI FLEX Archive',
  }));
}

export function getFlexSupportRanges() {
  return flexData?.soporte ?? {};
}

export function normalizeMongoExperiments(experiments = []) {
  return experiments.map((exp, index) => {
    const pressureKpa = exp.pressureKpa != null ? Number(exp.pressureKpa) : null;
    const pressurePsi =
      pressureKpa != null && Number.isFinite(pressureKpa)
        ? Number((pressureKpa * 0.145038).toFixed(2))
        : null;
    const pressureMmhg =
      pressureKpa != null && Number.isFinite(pressureKpa)
        ? Number((pressureKpa * 7.50062).toFixed(1))
        : null;
    const o2Pct = exp.o2Percent != null ? Number(exp.o2Percent) : null;
    const co2Pct = exp.co2Percent != null ? Number(exp.co2Percent) : 0;
    const hePct = exp.hePercent != null ? Number(exp.hePercent) : 0;
    const n2Pct =
      o2Pct != null
        ? Number(Math.max(0, 100 - o2Pct - co2Pct - hePct).toFixed(1))
        : null;

    return {
      index: index + 1,
      runId: exp.runId ?? `EXP-${index + 1}`,
      date: exp.date ?? exp.investigationSlug ?? 'MongoDB Record',
      fuel: exp.fuel?.material ?? exp.fuel?.family ?? 'Reported fuel',
      mix: co2Pct > 0 ? 'CO₂' : hePct > 0 ? 'He' : 'O₂/N₂',
      pressureMmhg,
      pressurePsi,
      o2Pct,
      n2Pct,
      co2Pct,
      hePct,
      diameterMm: exp.diameterMm != null ? Number(exp.diameterMm) : null,
      flowVelocity: exp.flowVelocityMs != null ? Number(exp.flowVelocityMs) : null,
      gravity: exp.gravity?.regime ?? 'microgravity',
      source: 'MongoDB Experiments',
    };
  });
}

function getStudyOxygenPeak(inv) {
  const c = inv?.conditions ?? {};
  const vals = [c.oxygenMaxPct, c.oxygenPct, c.oxygenMinPct].filter((v) =>
    Number.isFinite(v)
  );
  return vals.length ? Math.max(...vals) : null;
}

function getStudyOxygenLow(inv) {
  const c = inv?.conditions ?? {};
  const vals = [c.oxygenMinPct, c.oxygenPct, c.oxygenMaxPct].filter((v) =>
    Number.isFinite(v)
  );
  return vals.length ? Math.min(...vals) : null;
}

function matchesOxygenRegime(inv, regime) {
  if (!regime || regime === 'all') return true;
  const lo = getStudyOxygenLow(inv);
  const hi = getStudyOxygenPeak(inv);
  if (lo == null || hi == null) return false;
  if (regime === 'hypoxic') return lo <= 18;
  if (regime === 'nominal') return lo <= 22 && hi >= 19;
  if (regime === 'enriched') return hi >= 23 && lo <= 35;
  if (regime === 'hyperoxic') return hi > 35;
  return true;
}

export function filterTelemetryStudies(
  studies = [],
  { query = '', category = 'all', fuelType = 'all', hardware = 'all', oxygenRegime = 'all' } = {}
) {
  const q = String(query ?? '').trim().toLowerCase();
  const hwFilter =
    CATALOG_HARDWARE_FILTERS.find((item) => item.id === hardware) ?? CATALOG_HARDWARE_FILTERS[0];

  return studies.filter((inv) => {
    if (category && category !== 'all' && inv.category !== category) return false;
    if (fuelType && fuelType !== 'all' && inv.fuelType !== fuelType) return false;
    if (!hwFilter.match(String(inv.hardware ?? ''))) return false;
    if (!matchesOxygenRegime(inv, oxygenRegime)) return false;

    if (!q) return true;
    const haystack = [
      inv.id,
      inv.psiId,
      inv.acronym,
      inv.title,
      inv.objective,
      inv.fuel,
      inv.hardware,
      ...(Array.isArray(inv.sensors) ? inv.sensors : []),
      ...(Array.isArray(inv.variables) ? inv.variables : []),
      ...(Array.isArray(inv.tags) ? inv.tags : []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function filterTelemetryRuns(
  runs = [],
  { fuel = 'all', mix = 'all', o2Min = 0, o2Max = 100, query = '' } = {}
) {
  const q = String(query ?? '').trim().toLowerCase();
  return runs.filter((run) => {
    if (fuel && fuel !== 'all' && String(run.fuel).toLowerCase() !== fuel.toLowerCase()) {
      return false;
    }
    if (mix && mix !== 'all' && run.mix !== mix) return false;
    if (run.o2Pct != null && (run.o2Pct < o2Min || run.o2Pct > o2Max)) return false;
    if (!q) return true;
    return [run.runId, run.date, run.fuel, run.mix]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
}

const LIVERY_PRESETS = {
  hyperoxic: {
    id: 'hyperoxic',
    liveryName: 'HYPEROXIC CRIMSON',
    primary: '#fb7185',
    secondary: '#f59e0b',
    accent: '#f43f5e',
    glow: 'rgba(251, 113, 133, 0.22)',
    tint: 'rgba(251, 113, 133, 0.08)',
    border: 'rgba(251, 113, 133, 0.42)',
    badgeBg: 'rgba(251, 113, 133, 0.14)',
    badgeText: '#fecdd3',
  },
  co2: {
    id: 'co2',
    liveryName: 'CO₂ SUPPRESSION EMERALD',
    primary: '#34d399',
    secondary: '#2dd4bf',
    accent: '#10b981',
    glow: 'rgba(52, 211, 153, 0.22)',
    tint: 'rgba(52, 211, 153, 0.08)',
    border: 'rgba(52, 211, 153, 0.42)',
    badgeBg: 'rgba(52, 211, 153, 0.14)',
    badgeText: '#a7f3d0',
  },
  helium: {
    id: 'helium',
    liveryName: 'HELIUM PLASMA VIOLET',
    primary: '#a78bfa',
    secondary: '#38bdf8',
    accent: '#c084fc',
    glow: 'rgba(167, 139, 250, 0.22)',
    tint: 'rgba(167, 139, 250, 0.08)',
    border: 'rgba(167, 139, 250, 0.42)',
    badgeBg: 'rgba(167, 139, 250, 0.14)',
    badgeText: '#ddd6fe',
  },
  enriched: {
    id: 'enriched',
    liveryName: 'ENRICHED O₂ AMBER',
    primary: '#f59e0b',
    secondary: '#fb923c',
    accent: '#fbbf24',
    glow: 'rgba(245, 158, 11, 0.22)',
    tint: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.42)',
    badgeBg: 'rgba(245, 158, 11, 0.14)',
    badgeText: '#fde68a',
  },
  efield: {
    id: 'efield',
    liveryName: 'ION-PROXY VIOLET',
    primary: '#a78bfa',
    secondary: '#22d3ee',
    accent: '#818cf8',
    glow: 'rgba(167, 139, 250, 0.22)',
    tint: 'rgba(167, 139, 250, 0.08)',
    border: 'rgba(167, 139, 250, 0.42)',
    badgeBg: 'rgba(167, 139, 250, 0.14)',
    badgeText: '#ddd6fe',
  },
  detection: {
    id: 'detection',
    liveryName: 'AEROSOL SIGNAL GOLD',
    primary: '#fbbf24',
    secondary: '#fb923c',
    accent: '#f59e0b',
    glow: 'rgba(251, 191, 36, 0.20)',
    tint: 'rgba(251, 191, 36, 0.07)',
    border: 'rgba(251, 191, 36, 0.40)',
    badgeBg: 'rgba(251, 191, 36, 0.14)',
    badgeText: '#fef08a',
  },
  suppression: {
    id: 'suppression',
    liveryName: 'SUPPRESSION EMERALD',
    primary: '#34d399',
    secondary: '#38bdf8',
    accent: '#10b981',
    glow: 'rgba(52, 211, 153, 0.20)',
    tint: 'rgba(52, 211, 153, 0.07)',
    border: 'rgba(52, 211, 153, 0.40)',
    badgeBg: 'rgba(52, 211, 153, 0.14)',
    badgeText: '#a7f3d0',
  },
  prevention: {
    id: 'prevention',
    liveryName: 'ORBITAL TELEMETRY CYAN',
    primary: '#38bdf8',
    secondary: '#4f8ef7',
    accent: '#22d3ee',
    glow: 'rgba(56, 189, 248, 0.20)',
    tint: 'rgba(56, 189, 248, 0.07)',
    border: 'rgba(56, 189, 248, 0.40)',
    badgeBg: 'rgba(56, 189, 248, 0.14)',
    badgeText: '#bae6fd',
  },
};

/**
 * Derives a dynamic F1 pit-wall UI color palette from the fetched data
 * (active run composition, oxygen envelope, tags, and safety pillar).
 */
export function deriveTelemetryTheme({
  study = null,
  activeRun = null,
  filteredRuns = [],
  filteredStudies = [],
} = {}) {
  const effectiveO2 =
    activeRun?.o2Pct ??
    getStudyOxygenPeak(study) ??
    (filteredStudies.length
      ? Math.max(...filteredStudies.map(getStudyOxygenPeak).filter((v) => v != null), 21)
      : 21);

  const hasCo2Run =
    (activeRun?.co2Pct ?? 0) > 0 ||
    activeRun?.mix === 'CO₂' ||
    (!activeRun &&
      filteredRuns.length > 0 &&
      filteredRuns.every((r) => r.mix === 'CO₂'));

  const hasHeRun =
    (activeRun?.hePct ?? 0) > 0 ||
    activeRun?.mix === 'He' ||
    (!activeRun &&
      filteredRuns.length > 0 &&
      filteredRuns.every((r) => r.mix === 'He'));

  let preset = LIVERY_PRESETS.prevention;
  let liveryReason = 'Prevention pillar · Nominal O₂ telemetry';

  if (effectiveO2 >= 35) {
    preset = LIVERY_PRESETS.hyperoxic;
    liveryReason = `Hyperoxic envelope (${effectiveO2}% O₂)`;
  } else if (hasCo2Run) {
    preset = LIVERY_PRESETS.co2;
    liveryReason = activeRun
      ? `Active CO₂ diluent (${activeRun.co2Pct}% CO₂)`
      : 'Filtered CO₂ suppression runs';
  } else if (hasHeRun) {
    preset = LIVERY_PRESETS.helium;
    liveryReason = activeRun
      ? `Active He diluent (${activeRun.hePct}% He)`
      : 'Filtered Helium dilution runs';
  } else if (effectiveO2 >= 25) {
    preset = LIVERY_PRESETS.enriched;
    liveryReason = `Enriched O₂ regime (${effectiveO2}% O₂)`;
  } else if (study?.tags?.includes('partial-gravity-proxy')) {
    preset = LIVERY_PRESETS.efield;
    liveryReason = 'Electric-field partial-g body-force proxy';
  } else if (study?.category === 'detection') {
    preset = LIVERY_PRESETS.detection;
    liveryReason = 'Detection pillar · Aerosol & smoke telemetry';
  } else if (study?.category === 'suppression') {
    preset = LIVERY_PRESETS.suppression;
    liveryReason = 'Suppression pillar · Extinction & dilution';
  } else if (study?.category === 'prevention') {
    preset = LIVERY_PRESETS.prevention;
    liveryReason = 'Prevention pillar · Flammability bounds';
  }

  return {
    ...preset,
    liveryReason,
    channels: {
      o2: preset.primary,
      pressure: preset.secondary,
      flow: '#22d3ee',
      diluent: hasHeRun ? '#c084fc' : '#34d399',
      thermal: effectiveO2 >= 35 ? '#fb7185' : preset.primary,
      flux: '#fb923c',
    },
    cssVars: {
      '--tel-primary': preset.primary,
      '--tel-secondary': preset.secondary,
      '--tel-accent': preset.accent,
      '--tel-glow': preset.glow,
      '--tel-tint': preset.tint,
      '--tel-border': preset.border,
      '--tel-badge-bg': preset.badgeBg,
      '--tel-badge-text': preset.badgeText,
    },
  };
}

export function buildStudyEnvelopeSeries(studies = [], activeStudyId = null) {
  return studies.map((inv, idx) => {
    const c = inv.conditions ?? {};
    const o2Min = c.oxygenMinPct ?? c.oxygenPct ?? null;
    const o2Nom = c.oxygenPct ?? c.oxygenMaxPct ?? c.oxygenMinPct ?? null;
    const o2Max = c.oxygenMaxPct ?? c.oxygenPct ?? null;
    return {
      index: idx + 1,
      id: inv.id,
      acronym: inv.acronym ?? inv.name,
      category: inv.category,
      fuelType: inv.fuelType,
      o2Min,
      o2Nom,
      o2Max,
      pressurePsi: c.pressurePsi ?? null,
      flowVelocity: c.flowVelocity ?? null,
      sensorCount: inv.sensors?.length ?? 0,
      isActive: inv.id === activeStudyId,
    };
  });
}

export function computeTelemetryKPIs({ study, runs = [], activeRun = null }) {
  const cond = study?.conditions ?? {};
  const o2Value = activeRun?.o2Pct ?? cond.oxygenPct ?? null;
  const o2Min = runs.length
    ? Math.min(...runs.map((r) => r.o2Pct).filter((v) => v != null))
    : (cond.oxygenMinPct ?? cond.oxygenPct ?? null);
  const o2Max = runs.length
    ? Math.max(...runs.map((r) => r.o2Pct).filter((v) => v != null))
    : (cond.oxygenMaxPct ?? cond.oxygenPct ?? null);

  const pressurePsi = activeRun?.pressurePsi ?? cond.pressurePsi ?? null;
  const pressureMmhg =
    activeRun?.pressureMmhg ??
    (cond.pressurePsi != null ? Number((cond.pressurePsi * 51.7149).toFixed(1)) : null);

  const o2DeltaEarth =
    o2Value != null ? Number((o2Value - EARTH_BASELINE.o2Pct).toFixed(1)) : null;
  const pressureDeltaEarth =
    pressurePsi != null
      ? Number((pressurePsi - EARTH_BASELINE.pressurePsi).toFixed(2))
      : null;

  return {
    o2Value,
    o2Min,
    o2Max,
    pressurePsi,
    pressureMmhg,
    flowVelocity: activeRun?.flowVelocity ?? cond.flowVelocity ?? null,
    diameterMm: activeRun?.diameterMm ?? null,
    co2Pct: activeRun?.co2Pct ?? 0,
    hePct: activeRun?.hePct ?? 0,
    n2Pct: activeRun?.n2Pct ?? (o2Value != null ? Number(Math.max(0, 100 - o2Value).toFixed(1)) : null),
    o2DeltaEarth,
    pressureDeltaEarth,
    runCount: runs.length,
  };
}
