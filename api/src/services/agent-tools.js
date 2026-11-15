/**
 * Agent tools for the Heimdall copilot (Gemini function calling).
 * Every executor reads the real processed dataset, the real ranking engine,
 * or the real FireHazR model — a tool never fabricates a value; it returns
 * { error } so the model reports the limitation verbatim.
 */
import { rankInvestigations } from './ranking.service.js';
import { predictFirehazr } from './firehazr.service.js';
import { getAllInvestigations, findInvestigationById } from '../utils/processed-dataset.js';

const MAX_LIMIT = 20;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const MISSION_SCENARIOS = [
  {
    id: 'earth',
    label: 'Earth (1g baseline)',
    gravity: '1g',
    oxygenPct: 21,
    pressurePsi: 14.7,
    flowVelocity: 0.1,
  },
  {
    id: 'iss',
    label: 'ISS / LEO',
    gravity: 'microgravity',
    oxygenPct: 21,
    pressurePsi: 14.7,
    flowVelocity: 0.1,
  },
  {
    id: 'moon',
    label: 'Moon base / pressurized rover',
    gravity: 'lunar',
    oxygenPct: 30,
    pressurePsi: 10.2,
    flowVelocity: 0.1,
    note: 'Planned habitat atmosphere (>=30% O2, <=10.2 psi). No partial-gravity PSI data; results are bounded between microgravity and 1g.',
  },
  {
    id: 'mars',
    label: 'Mars base',
    gravity: 'martian',
    oxygenPct: 30,
    pressurePsi: 10.2,
    flowVelocity: 0.1,
    note: 'Habitat atmosphere assumed equal to lunar scenario.',
  },
  {
    id: 'suit',
    label: 'Spacesuit / airlock',
    gravity: 'microgravity',
    oxygenPct: 100,
    pressurePsi: 4.3,
    flowVelocity: 0.05,
    note: 'Worst-case flammability regime (100% O2 at 4.3 psi).',
  },
];

function compactDoc(inv) {
  const c = inv.conditions ?? {};
  return {
    acronym: inv.acronym,
    title: inv.title,
    category: inv.category,
    fuelType: inv.fuelType,
    gravityLevel: inv.gravityLevel,
    status: inv.status ?? 'published',
    dataAvailable: inv.dataAvailable !== false,
    hardware: inv.hardware,
    conditions: {
      oxygenPct: c.oxygenPct ?? null,
      oxygenMinPct: c.oxygenMinPct ?? null,
      oxygenMaxPct: c.oxygenMaxPct ?? null,
      pressurePsi: c.pressurePsi ?? null,
      flowVelocity: c.flowVelocity ?? null,
    },
    tags: inv.tags ?? [],
  };
}

function seriesStats(inv) {
  return (inv.series ?? []).map((s) => {
    const samples = Array.isArray(s.samples) ? s.samples : [];
    const xs = samples.map((p) => num(p?.[0])).filter((v) => v != null);
    const ys = samples.map((p) => num(p?.[1])).filter((v) => v != null);
    const range = (arr) =>
      arr.length ? { min: Math.min(...arr), max: Math.max(...arr) } : null;
    return {
      name: s.name,
      label: s.label,
      unit: s.unit,
      xLabel: s.xLabel,
      samples: samples.length,
      xRange: range(xs),
      yRange: range(ys),
    };
  });
}

async function searchInvestigations(args = {}) {
  const all = await getAllInvestigations();
  const query = String(args.query ?? '').toLowerCase();
  const tokens = query.split(/[^a-z0-9-]+/i).filter((t) => t.length >= 2).slice(0, 6);

  let docs = all;
  if (args.category && args.category !== 'all') {
    docs = docs.filter((d) => d.category === args.category);
  }
  if (args.fuelType && args.fuelType !== 'all') {
    docs = docs.filter((d) => d.fuelType === args.fuelType);
  }
  if (args.dataAvailable === true) {
    docs = docs.filter((d) => d.dataAvailable !== false && d.status !== 'upcoming');
  }
  if (tokens.length > 0) {
    docs = docs.filter((d) => {
      const haystack = [
        d.acronym,
        d.title,
        d.objective,
        d.fuel,
        d.hardware,
        ...(d.tags ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
  }

  const limit = clamp(num(args.limit) ?? 8, 1, MAX_LIMIT);
  return {
    total: docs.length,
    returned: Math.min(docs.length, limit),
    investigations: docs.slice(0, limit).map(compactDoc),
  };
}

async function getInvestigation(args = {}) {
  const inv = await findInvestigationById(args.acronym ?? args.id ?? args.title);
  if (!inv) {
    return { error: `No investigation matches '${args.acronym ?? args.id ?? args.title}'.` };
  }
  return {
    ...compactDoc(inv),
    objective: inv.objective,
    fuel: inv.fuel,
    variables: inv.variables ?? [],
    sensors: inv.sensors ?? [],
    earthApplications: inv.earthApplications ?? [],
    sourceUrl: inv.sourceUrl ?? null,
    seriesSource: inv.seriesSource ?? null,
    series: seriesStats(inv),
  };
}

async function rankForScenario(args = {}) {
  const all = await getAllInvestigations();
  const scenario = {
    gravity: args.gravity ?? 'microgravity',
    oxygenPct: num(args.oxygenPct),
    pressurePsi: num(args.pressurePsi),
    flowVelocity: num(args.flowVelocity),
    category: args.category ?? 'all',
    fuelType: args.fuelType ?? 'all',
  };
  const weights =
    args.weights && typeof args.weights === 'object' ? args.weights : undefined;
  const ranked = rankInvestigations(all, scenario, weights);
  const limit = clamp(num(args.limit) ?? 5, 1, MAX_LIMIT);

  return {
    scenario,
    total: ranked.length,
    ranking: ranked.slice(0, limit).map((r) => ({
      acronym: r.investigation.acronym,
      title: r.investigation.title,
      score: r.score,
      breakdown: r.breakdown.map((b) => ({
        factor: b.factor,
        value: b.value,
        normalizedWeight: b.normalizedWeight,
        contribution: b.contribution,
      })),
    })),
  };
}

async function predictBurnDuration(args = {}) {
  const conditions = {
    fuel: args.fuel,
    pressure_mmhg: num(args.pressure_mmhg),
    diameter_mm: num(args.diameter_mm),
    o2_fraction: num(args.o2_fraction),
    n2_fraction: num(args.n2_fraction),
    co2_fraction: num(args.co2_fraction) ?? 0,
    he_fraction: num(args.he_fraction) ?? 0,
  };
  try {
    const result = await predictFirehazr(conditions);
    return { conditions, prediction: result };
  } catch (err) {
    return {
      conditions,
      error: `FireHazR prediction unavailable or out of coverage: ${err.message}`,
    };
  }
}

const EXECUTORS = {
  search_investigations: searchInvestigations,
  get_investigation: getInvestigation,
  rank_investigations: rankForScenario,
  predict_burn_duration: predictBurnDuration,
  list_mission_scenarios: async () => ({ scenarios: MISSION_SCENARIOS }),
};

export async function executeAgentTool(name, args = {}) {
  const executor = EXECUTORS[name];
  if (!executor) return { error: `Unknown tool '${name}'.` };
  try {
    return await executor(args);
  } catch (err) {
    return { error: `Tool '${name}' failed: ${err.message}` };
  }
}

const stringEnum = (values) => ({ type: 'string', enum: values });

export const AGENT_TOOL_DECLARATIONS = [
  {
    name: 'search_investigations',
    description:
      'Search the NASA PSI investigation catalog by keyword, category, or fuel type. Returns compact records; call get_investigation for full detail.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords (acronym, fuel, hardware, objective).' },
        category: stringEnum(['all', 'prevention', 'detection', 'suppression']),
        fuelType: stringEnum(['all', 'solid', 'gas', 'droplet', 'aerosol']),
        dataAvailable: { type: 'boolean', description: 'true excludes upcoming studies (LUCI, FM2).' },
        limit: { type: 'number', description: 'Max results (1-20, default 8).' },
      },
    },
  },
  {
    name: 'get_investigation',
    description:
      'Get full detail for one PSI investigation: objective, fuel, conditions (O2 %, pressure, flow), variables, sensors, series stats, and provenance.',
    parameters: {
      type: 'object',
      properties: {
        acronym: { type: 'string', description: "Study acronym, e.g. 'BASS-II', 'FLEX', 'CFI-G'." },
      },
      required: ['acronym'],
    },
  },
  {
    name: 'rank_investigations',
    description:
      'Run the transparent scenario ranking engine. Returns scored investigations with a per-factor breakdown. Use list_mission_scenarios for habitat presets (Moon base: lunar, 30% O2, 10.2 psi).',
    parameters: {
      type: 'object',
      properties: {
        gravity: stringEnum(['microgravity', '1g', 'lunar', 'martian']),
        oxygenPct: { type: 'number', description: 'Habitat O2 concentration %.' },
        pressurePsi: { type: 'number', description: 'Habitat pressure in psi.' },
        flowVelocity: { type: 'number', description: 'Ventilation flow m/s.' },
        category: stringEnum(['all', 'prevention', 'detection', 'suppression']),
        fuelType: stringEnum(['all', 'solid', 'gas', 'droplet', 'aerosol']),
        limit: { type: 'number', description: 'Max results (1-20, default 5).' },
      },
    },
  },
  {
    name: 'predict_burn_duration',
    description:
      'Predict recorded microgravity droplet burn duration (seconds) with the FireHazR KNN FLEX v3 model. Only Methanol/Heptane, mole fractions 0-1 summing to ~1 (tolerance 0.025). Returns a coverage abstention instead of a number when the query is unsupported — report it verbatim, never estimate.',
    parameters: {
      type: 'object',
      properties: {
        fuel: stringEnum(['Methanol', 'Heptane']),
        pressure_mmhg: { type: 'number' },
        diameter_mm: { type: 'number', description: 'Initial droplet diameter in mm.' },
        o2_fraction: { type: 'number', description: 'O2 mole fraction 0-1.' },
        n2_fraction: { type: 'number', description: 'N2 mole fraction 0-1.' },
        co2_fraction: { type: 'number', description: 'CO2 mole fraction 0-1 (default 0).' },
        he_fraction: { type: 'number', description: 'He mole fraction 0-1 (default 0).' },
      },
      required: ['fuel', 'pressure_mmhg', 'diameter_mm', 'o2_fraction', 'n2_fraction'],
    },
  },
  {
    name: 'list_mission_scenarios',
    description:
      'List the predefined mission habitat scenarios (Earth 1g, ISS, Moon base, Mars base, spacesuit) with their gravity, O2 %, and pressure for ranking.',
    parameters: { type: 'object', properties: {} },
  },
];
