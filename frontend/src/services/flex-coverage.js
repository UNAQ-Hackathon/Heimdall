import flexTrialsData from '../data/flex-trials.json' with { type: 'json' };

export const MIXTURE_OPTIONS = [
  { id: 'O₂/N₂', label: 'O₂ / N₂ (Air / Habitat)', shortLabel: 'O₂ / N₂' },
  { id: 'CO₂', label: 'O₂ / N₂ + CO₂ (Suppressant)', shortLabel: '+ CO₂' },
  { id: 'He', label: 'O₂ / N₂ + He (Inert)', shortLabel: '+ He' },
];

export const FLEX_TRIALS = flexTrialsData.trials;
export const FLEX_SOPORTE = flexTrialsData.soporte;
export const FLEX_UMBRALES = flexTrialsData.umbrales;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const roundTo = (value, decimals = 4) => Number(value.toFixed(decimals));

export function inferMixture(conditions = {}) {
  if (Number(conditions.co2_fraction) > 0.005) return 'CO₂';
  if (Number(conditions.he_fraction) > 0.005) return 'He';
  return 'O₂/N₂';
}

export function getMixtureEnvelope(fuel = 'Methanol', mix = 'O₂/N₂') {
  const key = `${fuel} | ${mix}`;
  const raw = FLEX_SOPORTE[key] ?? FLEX_SOPORTE['Methanol | O₂/N₂'];
  return {
    key,
    count: raw.n,
    groups: raw.n_grupos,
    pressure: raw.min[0] != null ? [raw.min[0], raw.max[0]] : [526.3, 2319.7],
    o2: [raw.min[1], raw.max[1]],
    n2: [raw.min[2], raw.max[2]],
    co2: [raw.min[3], raw.max[3]],
    he: [raw.min[4], raw.max[4]],
    diameter: [raw.min[5], raw.max[5]],
  };
}

/**
 * Computes dynamic min/max bounds for O2 and active diluent (CO2 or He)
 * so that N2 = 1 - O2 - diluent always remains within [n2Min, n2Max].
 */
export function getDynamicGasBounds(conditions, mix = inferMixture(conditions)) {
  const fuel = conditions?.fuel === 'Heptane' ? 'Heptane' : 'Methanol';
  const env = getMixtureEnvelope(fuel, mix);
  const o2 = Number(conditions?.o2_fraction) || env.o2[0];
  const co2 = mix === 'CO₂' ? Number(conditions?.co2_fraction) || env.co2[0] : 0;
  const he = mix === 'He' ? Number(conditions?.he_fraction) || env.he[0] : 0;
  const dil = mix === 'CO₂' ? co2 : mix === 'He' ? he : 0;

  const o2Min = Math.max(env.o2[0], roundTo(1 - dil - env.n2[1], 3));
  const o2Max = Math.min(env.o2[1], roundTo(1 - dil - env.n2[0], 3));
  const safeO2Max = Math.max(o2Min, o2Max);

  const dilRange = mix === 'CO₂' ? env.co2 : mix === 'He' ? env.he : [0, 0];
  const dilMin = mix === 'O₂/N₂' ? 0 : Math.max(dilRange[0], roundTo(1 - o2 - env.n2[1], 3));
  const dilMax = mix === 'O₂/N₂' ? 0 : Math.min(dilRange[1], roundTo(1 - o2 - env.n2[0], 3));

  return {
    o2: [roundTo(o2Min, 3), roundTo(safeO2Max, 3)],
    diluent: [roundTo(dilMin, 3), roundTo(Math.max(dilMin, dilMax), 3)],
    n2: env.n2,
  };
}

/**
 * Clamps full conditions into a target Fuel + Mixture envelope and balances N2 to 1.000.
 */
export function clampConditionsToEnvelope(conditions, targetFuel, targetMix) {
  const fuel = targetFuel === 'Heptane' ? 'Heptane' : 'Methanol';
  const mix = MIXTURE_OPTIONS.some((m) => m.id === targetMix) ? targetMix : 'O₂/N₂';
  const env = getMixtureEnvelope(fuel, mix);

  const pressure_mmhg = roundTo(
    clamp(Number(conditions?.pressure_mmhg) || env.pressure[0], env.pressure[0], env.pressure[1]),
    1
  );
  const diameter_mm = roundTo(
    clamp(Number(conditions?.diameter_mm) || env.diameter[0], env.diameter[0], env.diameter[1]),
    2
  );

  let co2_fraction = mix === 'CO₂'
    ? clamp(Number(conditions?.co2_fraction) || env.co2[0], env.co2[0], env.co2[1])
    : 0;
  let he_fraction = mix === 'He'
    ? clamp(Number(conditions?.he_fraction) || env.he[0], env.he[0], env.he[1])
    : 0;
  const dil = mix === 'CO₂' ? co2_fraction : mix === 'He' ? he_fraction : 0;

  const o2Min = Math.max(env.o2[0], 1 - dil - env.n2[1]);
  const o2Max = Math.min(env.o2[1], 1 - dil - env.n2[0]);
  let o2_fraction = clamp(Number(conditions?.o2_fraction) || env.o2[0], Math.min(o2Min, env.o2[1]), Math.max(o2Min, o2Max));

  // If diluent + o2 still violates N2 bounds, adjust diluent to satisfy N2
  let n2_fraction = 1 - o2_fraction - dil;
  if (n2_fraction < env.n2[0] || n2_fraction > env.n2[1]) {
    const targetN2 = clamp(n2_fraction, env.n2[0], env.n2[1]);
    if (mix === 'CO₂') {
      co2_fraction = clamp(1 - o2_fraction - targetN2, env.co2[0], env.co2[1]);
      n2_fraction = 1 - o2_fraction - co2_fraction;
    } else if (mix === 'He') {
      he_fraction = clamp(1 - o2_fraction - targetN2, env.he[0], env.he[1]);
      n2_fraction = 1 - o2_fraction - he_fraction;
    } else {
      o2_fraction = clamp(1 - targetN2, env.o2[0], env.o2[1]);
      n2_fraction = 1 - o2_fraction;
    }
  }

  return {
    fuel,
    pressure_mmhg,
    o2_fraction: roundTo(o2_fraction, 3),
    n2_fraction: roundTo(n2_fraction, 3),
    co2_fraction: roundTo(co2_fraction, 3),
    he_fraction: roundTo(he_fraction, 3),
    diameter_mm,
  };
}

/**
 * Updates one meter value while keeping all values clamped inside the active envelope
 * and automatically balancing N2 = 1 - O2 - CO2 - He.
 */
export function updateMeterCondition(conditions, mix, key, rawValue) {
  const fuel = conditions.fuel === 'Heptane' ? 'Heptane' : 'Methanol';
  const env = getMixtureEnvelope(fuel, mix);
  const val = Number(rawValue);
  if (!Number.isFinite(val)) return conditions;

  if (key === 'pressure_mmhg') {
    return {
      ...conditions,
      pressure_mmhg: roundTo(clamp(val, env.pressure[0], env.pressure[1]), 1),
    };
  }
  if (key === 'diameter_mm') {
    return {
      ...conditions,
      diameter_mm: roundTo(clamp(val, env.diameter[0], env.diameter[1]), 2),
    };
  }

  const bounds = getDynamicGasBounds(conditions, mix);
  if (key === 'o2_fraction') {
    const o2 = roundTo(clamp(val, bounds.o2[0], bounds.o2[1]), 3);
    const co2 = mix === 'CO₂' ? Number(conditions.co2_fraction) || 0 : 0;
    const he = mix === 'He' ? Number(conditions.he_fraction) || 0 : 0;
    return {
      ...conditions,
      o2_fraction: o2,
      co2_fraction: roundTo(co2, 3),
      he_fraction: roundTo(he, 3),
      n2_fraction: roundTo(1 - o2 - co2 - he, 3),
    };
  }
  if (key === 'co2_fraction' && mix === 'CO₂') {
    const co2 = roundTo(clamp(val, bounds.diluent[0], bounds.diluent[1]), 3);
    const o2 = Number(conditions.o2_fraction) || env.o2[0];
    return {
      ...conditions,
      co2_fraction: co2,
      he_fraction: 0,
      n2_fraction: roundTo(1 - o2 - co2, 3),
    };
  }
  if (key === 'he_fraction' && mix === 'He') {
    const he = roundTo(clamp(val, bounds.diluent[0], bounds.diluent[1]), 3);
    const o2 = Number(conditions.o2_fraction) || env.o2[0];
    return {
      ...conditions,
      co2_fraction: 0,
      he_fraction: he,
      n2_fraction: roundTo(1 - o2 - he, 3),
    };
  }
  return conditions;
}

export function trialToConditions(trial) {
  return {
    fuel: trial.fuel,
    pressure_mmhg: trial.p,
    o2_fraction: trial.o2,
    n2_fraction: trial.n2,
    co2_fraction: trial.co2,
    he_fraction: trial.he,
    diameter_mm: trial.d,
  };
}

/**
 * Mirrors KNN FLEX v3's Euclidean standardized distance gate on the active fuel + mixture
 * so the UI can show live experimental coverage and snap cleanly to the nearest NASA trial.
 */
export function evaluateSupportCoverage(conditions) {
  const mix = inferMixture(conditions);
  const fuel = conditions?.fuel === 'Heptane' ? 'Heptane' : 'Methanol';
  const key = `${fuel} | ${mix}`;
  const limit = FLEX_UMBRALES[key] ?? null;
  const poolTrials = FLEX_TRIALS.filter((t) => t.fuel === fuel && t.mix === mix);

  const vec = [
    Number(conditions?.pressure_mmhg) || 0,
    Number(conditions?.o2_fraction) || 0,
    Number(conditions?.n2_fraction) || 0,
    Number(conditions?.co2_fraction) || 0,
    Number(conditions?.he_fraction) || 0,
    Number(conditions?.diameter_mm) || 0,
    fuel === 'Heptane' ? 1 : 0,
  ];
  const { centro, escala } = flexTrialsData;
  const zQuery = vec.map((v, i) => (v - centro[i]) / escala[i]);

  let minDist = Infinity;
  let nearestTrial = null;

  for (const trial of poolTrials) {
    const tv = [
      trial.p,
      trial.o2,
      trial.n2,
      trial.co2,
      trial.he,
      trial.d,
      trial.fuel === 'Heptane' ? 1 : 0,
    ];
    let sumSq = 0;
    for (let i = 0; i < 7; i += 1) {
      const diff = zQuery[i] - (tv[i] - centro[i]) / escala[i];
      sumSq += diff * diff;
    }
    const dist = Math.sqrt(sumSq);
    if (dist < minDist) {
      minDist = dist;
      nearestTrial = trial;
    }
  }

  const supported = limit != null && Number.isFinite(minDist) && minDist <= limit + 1e-12;
  return {
    mixture: key,
    mix,
    limit,
    distance: Number.isFinite(minDist) ? minDist : null,
    supported,
    nearestTrial,
    poolTrials,
  };
}
