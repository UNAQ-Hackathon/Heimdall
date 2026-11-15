/**
 * Pure filtering and summary utilities for the NASA PSI Combustion Catalog.
 * Operates strictly on verified processed PSI records without inventing values.
 */

export const CATALOG_CATEGORIES = [
  { id: 'all', label: 'All Pillars' },
  { id: 'prevention', label: 'Prevention' },
  { id: 'detection', label: 'Detection' },
  { id: 'suppression', label: 'Suppression' },
];

export const CATALOG_FUEL_TYPES = [
  { id: 'all', label: 'All Fuels' },
  { id: 'solid', label: 'Solid' },
  { id: 'droplet', label: 'Droplet (Liquid)' },
  { id: 'gas', label: 'Gas' },
  { id: 'aerosol', label: 'Aerosol / Dust' },
];

export const CATALOG_HARDWARE_FILTERS = [
  { id: 'all', label: 'All Hardware', match: () => true },
  { id: 'acme', label: 'CIR / ACME', match: (hw) => /acme/i.test(hw) },
  { id: 'mdca', label: 'CIR / MDCA', match: (hw) => /mdca/i.test(hw) },
  { id: 'msg', label: 'ISS MSG', match: (hw) => /\bmsg\b/i.test(hw) },
  { id: 'saffire', label: 'Cygnus / Saffire', match: (hw) => /saffire/i.test(hw) },
  { id: 'same', label: 'SAME Pegasor', match: (hw) => /same\s+pegasor/i.test(hw) },
];

export const CATALOG_DATA_FILTERS = [
  { id: 'all', label: 'All Records' },
  { id: 'published', label: 'Published PSI Data' },
  { id: 'series', label: 'Empirical Curves (FLEX)' },
  { id: 'upcoming', label: 'Upcoming Lunar (LUCI / FM2)' },
];

export function getHardwareFamily(hardware = '') {
  const hw = String(hardware ?? '');
  if (/acme/i.test(hw)) return 'CIR / ACME (Modular Gas Rack)';
  if (/mdca/i.test(hw)) return 'CIR / MDCA (Droplet Apparatus)';
  if (/spice/i.test(hw) || /\bmsg\b/i.test(hw)) return 'ISS MSG (SPICE Flow Duct / Glovebox)';
  if (/saffire/i.test(hw)) return 'Cygnus Spacecraft (Saffire Duct)';
  if (/same/i.test(hw) || /pegasor/i.test(hw)) return 'SAME / DAFT Aerosol Suite';
  if (/lunar|clps|planned/i.test(hw)) return 'Planned Lunar Payload';
  return hw || 'ISS Combustion Hardware';
}

export const CATEGORY_STYLE = {
  prevention: { label: 'PREVENTION', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' },
  detection: { label: 'DETECTION', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)' },
  suppression: { label: 'SUPPRESSION', color: '#34d399', bg: 'rgba(52, 211, 153, 0.12)' },
};

/**
 * Filters PSI investigations by query string, pillar category, fuel type, hardware family, and data status.
 */
export function filterPsiInvestigations(
  items = [],
  { query = '', category = 'all', fuelType = 'all', hardware = 'all', dataStatus = 'all' } = {}
) {
  const q = String(query ?? '').trim().toLowerCase();
  const hwFilter =
    CATALOG_HARDWARE_FILTERS.find((item) => item.id === hardware) ?? CATALOG_HARDWARE_FILTERS[0];

  return items.filter((inv) => {
    if (category && category !== 'all' && inv.category !== category) return false;
    if (fuelType && fuelType !== 'all' && inv.fuelType !== fuelType) return false;
    if (!hwFilter.match(String(inv.hardware ?? ''))) return false;

    const isUpcoming = inv.dataAvailable === false || inv.status === 'upcoming';
    if (dataStatus === 'published' && isUpcoming) return false;
    if (dataStatus === 'upcoming' && !isUpcoming) return false;
    if (dataStatus === 'series') {
      const pts = Array.isArray(inv.series)
        ? inv.series.reduce((sum, s) => sum + (s?.samples?.length ?? 0), 0)
        : 0;
      if (pts === 0) return false;
    }

    if (!q) return true;
    const haystack = [
      inv.psiId,
      inv.acronym,
      inv.title,
      inv.objective,
      inv.fuel,
      inv.hardware,
      ...(Array.isArray(inv.sensors) ? inv.sensors : []),
      ...(Array.isArray(inv.variables) ? inv.variables : []),
      ...(Array.isArray(inv.earthApplications) ? inv.earthApplications : []),
      ...(Array.isArray(inv.tags) ? inv.tags : []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}

/**
 * Summarizes strictly measured/documented fields across a list of PSI records.
 */
export function summarizeCatalogMetrics(items = []) {
  const o2Values = [];
  const hardwareSet = new Set();
  let earthApplicationsCount = 0;

  items.forEach((inv) => {
    const cond = inv.conditions ?? {};
    [cond.oxygenMinPct, cond.oxygenPct, cond.oxygenMaxPct].forEach((val) => {
      if (Number.isFinite(val)) o2Values.push(val);
    });
    if (inv.hardware) hardwareSet.add(inv.hardware);
    if (Array.isArray(inv.earthApplications)) {
      earthApplicationsCount += inv.earthApplications.length;
    }
  });

  return {
    count: items.length,
    oxygenMinPct: o2Values.length ? Math.min(...o2Values) : null,
    oxygenMaxPct: o2Values.length ? Math.max(...o2Values) : null,
    hardwareCount: hardwareSet.size,
    earthApplicationsCount,
  };
}

function escapeCsvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/**
 * Builds an RFC-4180 CSV export from verified PSI investigation records for predictive modeling.
 */
export function buildPsiDatasetCsv(items = []) {
  const headers = [
    'psiId',
    'acronym',
    'title',
    'category',
    'gravityLevel',
    'status',
    'dataAvailable',
    'fuelType',
    'fuel',
    'hardware',
    'oxygenMinPct',
    'oxygenPct',
    'oxygenMaxPct',
    'pressurePsi',
    'flowVelocityMs',
    'variables',
    'sensors',
    'seriesPointCount',
    'earthApplications',
    'sourceUrl',
  ];

  const rows = items.map((inv) => {
    const cond = inv.conditions ?? {};
    const pts = Array.isArray(inv.series)
      ? inv.series.reduce((sum, s) => sum + (s?.samples?.length ?? 0), 0)
      : 0;
    return [
      inv.psiId ?? '',
      inv.acronym ?? '',
      inv.title ?? '',
      inv.category ?? '',
      inv.gravityLevel ?? '',
      inv.status ?? 'published',
      inv.dataAvailable !== false,
      inv.fuelType ?? '',
      inv.fuel ?? '',
      inv.hardware ?? '',
      cond.oxygenMinPct ?? '',
      cond.oxygenPct ?? '',
      cond.oxygenMaxPct ?? '',
      cond.pressurePsi ?? '',
      cond.flowVelocity ?? '',
      Array.isArray(inv.variables) ? inv.variables.join(' | ') : '',
      Array.isArray(inv.sensors) ? inv.sensors.join(' | ') : '',
      pts,
      Array.isArray(inv.earthApplications) ? inv.earthApplications.join(' | ') : '',
      inv.sourceUrl ?? '',
    ];
  });

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

/**
 * Computes transparent similarities and differences across 2-3 selected PSI investigations
 * using strictly verified dataset attributes.
 */
export function summarizeInvestigationDifferences(studies = []) {
  if (!Array.isArray(studies) || studies.length < 2) {
    return { similarities: [], differences: [] };
  }

  const similarities = [];
  const differences = [];

  const categories = [...new Set(studies.map((s) => s.category).filter(Boolean))];
  if (categories.length === 1) {
    similarities.push(`Shared safety pillar: ${categories[0]}`);
  } else if (categories.length > 1) {
    differences.push(`Cross-pillar scope: ${categories.join(' vs ')}`);
  }

  const hwFamilies = [...new Set(studies.map((s) => getHardwareFamily(s.hardware)))];
  if (hwFamilies.length === 1) {
    similarities.push(`Shared testbed family: ${hwFamilies[0]}`);
  } else {
    differences.push(`Different testbeds: ${hwFamilies.join(' vs ')}`);
  }

  const fuelTypes = [...new Set(studies.map((s) => s.fuelType).filter(Boolean))];
  if (fuelTypes.length === 1) {
    similarities.push(`Same fuel phase: ${fuelTypes[0]}`);
  } else if (fuelTypes.length > 1) {
    differences.push(`Different fuel phases: ${fuelTypes.join(' vs ')}`);
  }

  const gravities = [...new Set(studies.map((s) => s.gravityLevel).filter(Boolean))];
  if (gravities.length === 1) {
    similarities.push(`Same gravity regime: ${gravities[0]}`);
  } else if (gravities.length > 1) {
    differences.push(`Gravity regime gap: ${gravities.join(' vs ')}`);
  }

  const o2Bounds = studies
    .map((s) => {
      const c = s.conditions ?? {};
      const low = c.oxygenMinPct ?? c.oxygenPct;
      const high = c.oxygenMaxPct ?? c.oxygenPct;
      return low != null && high != null ? { acronym: s.acronym, low, high } : null;
    })
    .filter(Boolean);

  if (o2Bounds.length >= 2) {
    const minO2 = Math.min(...o2Bounds.map((b) => b.low));
    const maxO2 = Math.max(...o2Bounds.map((b) => b.high));
    if (minO2 === maxO2) {
      similarities.push(`Identical reported O₂ level: ${minO2}%`);
    } else {
      differences.push(
        `O₂ span ranges from ${minO2}% to ${maxO2}% (${o2Bounds.map((b) => `${b.acronym}: ${b.low === b.high ? `${b.low}%` : `${b.low}-${b.high}%`}`).join(', ')})`
      );
    }
  }

  const flowValues = studies.filter((s) => s.conditions?.flowVelocity != null);
  if (flowValues.length > 0 && flowValues.length < studies.length) {
    differences.push(
      `Flow regime contrast: ${flowValues.map((s) => `${s.acronym} (${s.conditions.flowVelocity} m/s)`).join(', ')} vs quiescent/unreported studies`
    );
  }

  const upcoming = studies.filter((s) => s.dataAvailable === false || s.status === 'upcoming');
  if (upcoming.length > 0) {
    differences.push(
      `Pending PSI data gap: ${upcoming.map((s) => s.acronym).join(', ')} have no published experimental conditions yet`
    );
  }

  return { similarities, differences };
}

export const CATALOG_PILLAR_GUIDE = [
  {
    id: 'all',
    label: 'All Studies',
    shortLabel: 'All',
    description: 'Every spacecraft combustion experiment in the archive',
    color: '#94a3b8',
  },
  {
    id: 'prevention',
    label: 'Prevent Fires',
    shortLabel: 'Prevent',
    description: 'How easily materials catch fire and sustain a flame',
    color: '#38bdf8',
  },
  {
    id: 'detection',
    label: 'Detect Smoke',
    shortLabel: 'Detect',
    description: 'How smoke particles and flame light trigger alarms',
    color: '#fbbf24',
  },
  {
    id: 'suppression',
    label: 'Suppress Flames',
    shortLabel: 'Suppress',
    description: 'How gas mixtures and airflow put out fires',
    color: '#34d399',
  },
];

export const CATALOG_FUEL_OPTIONS = [
  { id: 'all', label: 'All materials' },
  { id: 'solid', label: 'Solid materials (plastics, fabrics)' },
  { id: 'droplet', label: 'Liquid fuel droplets (methanol, heptane)' },
  { id: 'gas', label: 'Flammable gases (methane, ethylene)' },
  { id: 'aerosol', label: 'Smoke particles and aerosols' },
];

export const CATALOG_HARDWARE_OPTIONS = [
  { id: 'all', label: 'All spacecraft test chambers' },
  { id: 'acme', label: 'CIR / ACME — Gas burner rack' },
  { id: 'mdca', label: 'CIR / MDCA — Droplet test rig' },
  { id: 'msg', label: 'ISS MSG — Glovebox flow duct' },
  { id: 'saffire', label: 'Cygnus / Saffire — Full-scale spacecraft fire' },
  { id: 'same', label: 'SAME Pegasor — Smoke and aerosol suite' },
];

export const CATALOG_DATA_OPTIONS = [
  { id: 'all', label: 'All archive status' },
  { id: 'published', label: 'Published PSI test conditions' },
  { id: 'series', label: 'Empirical curve runs (FLEX, 258 samples)' },
  { id: 'upcoming', label: 'Upcoming Lunar missions (LUCI / FM2)' },
];

/**
 * Extracts verified O2 bounds and human-readable label for a single study without guessing values.
 */
export function getStudyOxygenBounds(study) {
  const cond = study?.conditions ?? {};
  const candidates = [cond.oxygenMinPct, cond.oxygenPct, cond.oxygenMaxPct].filter((v) =>
    Number.isFinite(v)
  );
  if (candidates.length === 0) {
    return {
      minPct: null,
      maxPct: null,
      nominalPct: null,
      label: study?.oxygenRange || 'Pending publication',
    };
  }
  const minPct = Math.min(...candidates);
  const maxPct = Math.max(...candidates);
  const nominalPct = Number.isFinite(cond.oxygenPct) ? cond.oxygenPct : null;
  const label =
    study?.oxygenRange ||
    (minPct === maxPct ? `${minPct}% O₂` : `${minPct}% – ${maxPct}% O₂`);
  return { minPct, maxPct, nominalPct, label };
}

/**
 * Classifies a study's verified telemetry depth: empirical curves, published condition bounds, or upcoming lunar gap.
 */
export function getStudyTelemetryTier(study) {
  if (study?.dataAvailable === false || study?.status === 'upcoming') {
    return 'upcoming';
  }
  const hasSeries = Array.isArray(study?.series)
    ? study.series.some((s) => Array.isArray(s?.samples) && s.samples.length > 0)
    : false;
  return hasSeries ? 'empirical' : 'published';
}

/**
 * Summarizes strictly verified experimental series samples attached to an investigation.
 */
export function getStudySeriesStats(study) {
  const rawSeries = Array.isArray(study?.series) ? study.series : [];
  const seriesSummaries = rawSeries
    .map((series, index) => {
      const rawSamples = Array.isArray(series?.samples) ? series.samples : [];
      const points = rawSamples
        .map((pt) => {
          if (Array.isArray(pt) && pt.length >= 2) {
            const x = Number(pt[0]);
            const y = Number(pt[1]);
            return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
          }
          if (pt && typeof pt === 'object') {
            const x = Number(pt.x);
            const y = Number(pt.y);
            return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
          }
          return null;
        })
        .filter(Boolean);

      if (points.length === 0) return null;
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      return {
        name: series.name || `series-${index}`,
        label: series.label || series.name || `Series ${index + 1}`,
        unit: series.unit || '',
        xLabel: series.xLabel || 'Parameter',
        count: points.length,
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        points,
      };
    })
    .filter(Boolean);

  const sampleCount = seriesSummaries.reduce((sum, s) => sum + s.count, 0);
  return {
    seriesCount: seriesSummaries.length,
    sampleCount,
    seriesSummaries,
  };
}

/**
 * Aggregates general archive telemetry and condition coverage across filtered PSI studies.
 */
export function summarizeCatalogOverview(items = []) {
  const byCategory = { prevention: 0, detection: 0, suppression: 0 };
  const telemetryCounts = {
    empiricalStudies: 0,
    empiricalSamples: 0,
    publishedStudies: 0,
    upcomingStudies: 0,
  };
  const o2Values = [];
  const pressureValues = [];
  const hardwareSet = new Set();
  let earthApplicationsCount = 0;

  items.forEach((inv) => {
    if (inv.category && Object.hasOwn(byCategory, inv.category)) {
      byCategory[inv.category] += 1;
    }

    const tier = getStudyTelemetryTier(inv);
    if (tier === 'upcoming') {
      telemetryCounts.upcomingStudies += 1;
    } else if (tier === 'empirical') {
      telemetryCounts.empiricalStudies += 1;
      telemetryCounts.publishedStudies += 1;
      telemetryCounts.empiricalSamples += getStudySeriesStats(inv).sampleCount;
    } else {
      telemetryCounts.publishedStudies += 1;
    }

    const cond = inv.conditions ?? {};
    [cond.oxygenMinPct, cond.oxygenPct, cond.oxygenMaxPct].forEach((val) => {
      if (Number.isFinite(val)) o2Values.push(val);
    });
    if (Number.isFinite(cond.pressurePsi)) {
      pressureValues.push(cond.pressurePsi);
    }
    if (inv.hardware) hardwareSet.add(inv.hardware);
    if (Array.isArray(inv.earthApplications)) {
      earthApplicationsCount += inv.earthApplications.length;
    }
  });

  return {
    total: items.length,
    byCategory,
    telemetryCounts,
    oxygenSpan: {
      minPct: o2Values.length ? Math.min(...o2Values) : null,
      maxPct: o2Values.length ? Math.max(...o2Values) : null,
    },
    pressureSpan: {
      minPsi: pressureValues.length ? Math.min(...pressureValues) : null,
      maxPsi: pressureValues.length ? Math.max(...pressureValues) : null,
    },
    hardwareCount: hardwareSet.size,
    earthApplicationsCount,
  };
}
