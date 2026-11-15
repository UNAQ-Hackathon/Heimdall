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

export const CATEGORY_STYLE = {
  prevention: { label: 'PREVENTION', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' },
  detection: { label: 'DETECTION', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)' },
  suppression: { label: 'SUPPRESSION', color: '#34d399', bg: 'rgba(52, 211, 153, 0.12)' },
};

/**
 * Filters PSI investigations by query string, pillar category, fuel type, and hardware family.
 */
export function filterPsiInvestigations(
  items = [],
  { query = '', category = 'all', fuelType = 'all', hardware = 'all' } = {}
) {
  const q = String(query ?? '').trim().toLowerCase();
  const hwFilter =
    CATALOG_HARDWARE_FILTERS.find((item) => item.id === hardware) ?? CATALOG_HARDWARE_FILTERS[0];

  return items.filter((inv) => {
    if (category && category !== 'all' && inv.category !== category) return false;
    if (fuelType && fuelType !== 'all' && inv.fuelType !== fuelType) return false;
    if (!hwFilter.match(String(inv.hardware ?? ''))) return false;

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
