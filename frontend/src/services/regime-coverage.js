export const MOON_BASE_TARGET = {
  acronym: 'Moon Base Target',
  category: 'habitat-target',
  x: 0.1,
  y: 30,
  o2Min: 30,
  o2Max: 30,
  hardware: 'Pressurized Lunar Habitat / Rover (>=30% O2, <=10.2 psi)',
};

export function extractPsiRegimeCoords(investigations = []) {
  return investigations
    .filter(
      (inv) =>
        inv &&
        inv.dataAvailable !== false &&
        Number.isFinite(Number(inv.conditions?.oxygenPct)) &&
        Number.isFinite(Number(inv.conditions?.flowVelocity)) &&
        inv.conditions?.oxygenPct !== null &&
        inv.conditions?.flowVelocity !== null
    )
    .map((inv) => {
      const o2 = Number(inv.conditions.oxygenPct);
      const flow = Number(inv.conditions.flowVelocity);
      const o2Min = Number.isFinite(Number(inv.conditions?.oxygenMinPct)) && inv.conditions.oxygenMinPct !== null
        ? Number(inv.conditions.oxygenMinPct)
        : o2;
      const o2Max = Number.isFinite(Number(inv.conditions?.oxygenMaxPct)) && inv.conditions.oxygenMaxPct !== null
        ? Number(inv.conditions.oxygenMaxPct)
        : o2;
      return {
        acronym: inv.acronym ?? inv.title ?? 'PSI Study',
        category: inv.category ?? 'prevention',
        x: flow,
        y: o2,
        o2Min,
        o2Max,
        hardware: inv.hardware ?? 'PSI Testbed',
      };
    });
}

export function buildConvexHullQueryPoints(investigations = []) {
  const seen = new Set();
  const points = [];

  for (const inv of investigations) {
    if (!inv || inv.dataAvailable === false) continue;
    const rawFlow = inv.conditions?.flowVelocity;
    if (rawFlow === null || rawFlow === undefined || !Number.isFinite(Number(rawFlow))) continue;
    const flow = Number(rawFlow);

    const o2Candidates = [
      inv.conditions?.oxygenMinPct,
      inv.conditions?.oxygenPct,
      inv.conditions?.oxygenMaxPct,
    ]
      .filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v)))
      .map(Number);

    for (const o2 of o2Candidates) {
      const key = `${o2.toFixed(3)}|${flow.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      points.push({
        oxygen_pct: o2,
        flow_velocity: flow,
        flammable: true,
        weight: 1,
      });
    }
  }

  return points;
}
