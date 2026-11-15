/**
 * Transparent scenario-based ranking.
 * score = Σ weight_i × factor_i — every factor and its contribution
 * is returned in the breakdown so nothing is a black box.
 */

export const FACTOR_LABELS = {
  atmosphereMatch: 'Habitat Atmosphere (O₂ & Pressure)',
  gravityMatch: 'Gravity Regime & Proxies',
  dataRichness: 'Telemetry & Condition Coverage',
  documentation: 'Experimental Documentation',
};

function isNoDataPlaceholder(inv) {
  return inv?.dataAvailable === false || inv?.status === 'upcoming';
}

export const FACTORS = {
  atmosphereMatch: (inv, s) => {
    if (isNoDataPlaceholder(inv)) return 0;
    if (inv.conditions?.oxygenPct == null || s?.oxygenPct == null) return 0;
    const minO2 = inv.conditions?.oxygenMinPct ?? inv.conditions.oxygenPct;
    const maxO2 = inv.conditions?.oxygenMaxPct ?? inv.conditions.oxygenPct;
    const o2Ref =
      s.oxygenPct >= minO2 && s.oxygenPct <= maxO2
        ? s.oxygenPct
        : Math.abs(s.oxygenPct - minO2) < Math.abs(s.oxygenPct - maxO2)
          ? minO2
          : maxO2;
    const dO2 = Math.abs(o2Ref - s.oxygenPct) / Math.max(s.oxygenPct, 1);
    const dP =
      inv.conditions?.pressurePsi != null && s?.pressurePsi != null
        ? Math.abs(inv.conditions.pressurePsi - s.pressurePsi) / Math.max(s.pressurePsi, 1)
        : 0.25;
    const hasFlowQuery = s?.flowVelocity != null;
    const dFlow =
      hasFlowQuery && inv.conditions?.flowVelocity != null
        ? Math.min(1, Math.abs(inv.conditions.flowVelocity - s.flowVelocity) / 0.35)
        : hasFlowQuery
          ? 0.25
          : 0;
    const penalty = hasFlowQuery
      ? dO2 * 0.5 + dP * 0.3 + dFlow * 0.2
      : dO2 * 0.6 + dP * 0.4;
    return Number(Math.max(0, Math.min(1, 1 - penalty)).toFixed(4));
  },

  gravityMatch: (inv, s) => {
    if (isNoDataPlaceholder(inv)) return 0;
    const targetG = s?.gravity ?? 'microgravity';
    if (inv.gravityLevel === targetG) return 1;
    const isPartialG = targetG === 'lunar' || targetG === 'martian';
    if (isPartialG && inv.tags?.includes('partial-gravity-proxy')) return 0.9;
    if (isPartialG && inv.tags?.includes('lunar-regime')) return 0.78;
    if (targetG === '1g' && (inv.earthApplications?.length ?? 0) > 0) {
      return Number(Math.min(0.92, 0.6 + inv.earthApplications.length * 0.14).toFixed(4));
    }
    return inv.gravityLevel === 'microgravity' ? 0.5 : 0.2;
  },

  dataRichness: (inv) => {
    if (isNoDataPlaceholder(inv)) return 0;
    const pts = inv.series?.reduce((n, s) => n + (s.samples?.length ?? 0), 0) ?? 0;
    if (pts > 0) return Number(Math.min(1, pts / 500).toFixed(4));
    const condFields = [
      inv.conditions?.oxygenPct,
      inv.conditions?.pressurePsi,
      inv.conditions?.flowVelocity,
      inv.conditions?.oxygenMinPct,
      inv.conditions?.oxygenMaxPct,
    ].filter((v) => v != null).length;
    const rangeSpan =
      inv.conditions?.oxygenMaxPct != null && inv.conditions?.oxygenMinPct != null
        ? Math.min(1, (inv.conditions.oxygenMaxPct - inv.conditions.oxygenMinPct) / 40)
        : 0;
    const sensorScore = Math.min(1, (inv.sensors?.length ?? 0) / 5);
    const varScore = Math.min(1, (inv.variables?.length ?? 0) / 4);
    return Number(
      ((condFields / 5) * 0.35 + rangeSpan * 0.25 + sensorScore * 0.2 + varScore * 0.2).toFixed(4)
    );
  },

  documentation: (inv) => {
    const fields = [
      inv.objective,
      inv.fuel,
      inv.hardware,
      inv.sourceUrl,
      inv.sensors?.length,
      inv.variables?.length,
      inv.earthApplications?.length,
    ];
    const ratio = fields.filter(Boolean).length / fields.length;
    const tagScore = Math.min(1, (inv.tags?.length ?? 0) / 6);
    const earthScore = Math.min(1, (inv.earthApplications?.length ?? 0) / 2);
    return Number((ratio * 0.6 + tagScore * 0.2 + earthScore * 0.2).toFixed(4));
  },
};

export function rankInvestigations(investigations, scenario = {}, weights = {}) {
  const names = Object.keys(FACTORS);
  const w = Object.fromEntries(
    names.map((n) => [n, weights[n] != null ? Number(weights[n]) : 1 / names.length])
  );
  const total = names.reduce((s, n) => s + w[n], 0) || 1;

  let filtered = investigations;
  if (scenario?.category && scenario.category !== 'all') {
    filtered = filtered.filter((inv) => inv.category === scenario.category);
  }
  if (scenario?.fuelType && scenario.fuelType !== 'all') {
    filtered = filtered.filter((inv) => inv.fuelType === scenario.fuelType);
  }

  return filtered
    .map((inv) => {
      const breakdown = names.map((name) => {
        const value = Number(FACTORS[name](inv, scenario).toFixed(4));
        const normalizedWeight = Number((w[name] / total).toFixed(4));
        const contribution = Number(((value * w[name]) / total).toFixed(4));
        return {
          factor: name,
          label: FACTOR_LABELS[name],
          value,
          weight: w[name],
          normalizedWeight,
          contribution,
        };
      });
      const score = Number(breakdown.reduce((s, b) => s + b.contribution, 0).toFixed(4));
      return { investigation: inv, score, breakdown };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        String(a.investigation.acronym ?? '').localeCompare(String(b.investigation.acronym ?? ''))
    );
}
