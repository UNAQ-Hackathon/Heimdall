/**
 * Transform a raw PSI record into the Heimdall Investigation schema
 * (see api/src/models/Investigation.js).
 *
 * Keeps strict provenance: never invents numbers; unverified values remain null.
 */
const VALID_CATEGORIES = new Set(['prevention', 'detection', 'suppression']);
const VALID_GRAVITY = new Set(['microgravity', 'lunar', 'martian', '1g', 'unknown']);
const VALID_FUEL_TYPES = new Set(['solid', 'gas', 'droplet', 'aerosol']);

function toNullableNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

export function transformInvestigation(raw) {
  const cond = raw.conditions ?? {};
  const category = VALID_CATEGORIES.has(raw.category) ? raw.category : 'prevention';
  const gravityLevel = VALID_GRAVITY.has(raw.gravityLevel) ? raw.gravityLevel : 'unknown';
  const fuelType = VALID_FUEL_TYPES.has(raw.fuelType) ? raw.fuelType : null;

  return {
    psiId: raw.psiId ?? raw.id ?? null,
    title: raw.title ?? 'Untitled investigation',
    acronym: raw.acronym ?? null,
    objective: raw.objective ?? null,
    fuel: raw.fuel ?? null,
    fuelType,
    hardware: raw.hardware ?? null,
    category,
    gravityLevel,
    conditions: {
      oxygenPct: toNullableNumber(cond.oxygenPct ?? raw.oxygenPct),
      oxygenMinPct: toNullableNumber(cond.oxygenMinPct ?? raw.oxygenMinPct),
      oxygenMaxPct: toNullableNumber(cond.oxygenMaxPct ?? raw.oxygenMaxPct),
      pressurePsi: toNullableNumber(cond.pressurePsi ?? raw.pressurePsi),
      flowVelocity: toNullableNumber(cond.flowVelocity ?? raw.flowVelocity),
      ambient: cond.ambient ?? raw.ambient ?? null,
    },
    variables: Array.isArray(raw.variables) ? raw.variables : [],
    sensors: Array.isArray(raw.sensors) ? raw.sensors : [],
    series: Array.isArray(raw.series) ? raw.series : [],
    earthApplications: Array.isArray(raw.earthApplications) ? raw.earthApplications : [],
    sourceUrl: raw.sourceUrl ?? 'https://psi.nasa.gov/',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
  };
}
