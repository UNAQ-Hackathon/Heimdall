import processedInvestigations from '../../../data/processed/psi-investigations.json' with { type: 'json' };
import {
  FACTORS,
  FACTOR_LABELS,
  rankInvestigations as rankDataset,
} from '../../../api/src/services/ranking.service.js';

export { FACTORS, FACTOR_LABELS, processedInvestigations };

function slugifyPsiKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/^psi-/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function findProcessedInvestigation(raw) {
  const keys = [
    raw?.slug,
    raw?.id,
    raw?.psiId,
    raw?.sources?.psiId,
    raw?.acronym,
    raw?.name,
    raw?.title,
  ]
    .filter(Boolean)
    .map(slugifyPsiKey);

  if (!keys.length) return null;

  return (
    processedInvestigations.find((item) => {
      const itemKeys = [item.psiId, item.acronym, item.title]
        .filter(Boolean)
        .map(slugifyPsiKey);
      return keys.some((k) => itemKeys.includes(k));
    }) ?? null
  );
}

/**
 * Format a processed PSI investigation document with UI-friendly display fields
 * while preserving all raw schema fields (`psiId`, `acronym`, `title`, `objective`,
 * `fuel`, `fuelType`, `hardware`, `category`, `gravityLevel`, `conditions`,
 * `variables`, `sensors`, `earthApplications`, `sourceUrl`, `tags`).
 */
export function enrichInvestigationForUI(rawInv, rankItem = null) {
  const matched = findProcessedInvestigation(rawInv);
  const inv = matched ? { ...matched, ...rawInv } : { ...rawInv };
  if (!inv.acronym && rawInv?.name) inv.acronym = rawInv.name;
  if (!inv.title && (matched?.title || rawInv?.name)) inv.title = matched?.title ?? rawInv.name;
  if (!inv.psiId && (rawInv?.sources?.psiId || matched?.psiId)) {
    inv.psiId = rawInv?.sources?.psiId ?? matched?.psiId;
  }
  if (!inv.hardware && (matched?.hardware || rawInv?.family)) {
    inv.hardware = matched?.hardware ?? rawInv.family;
  }
  if (!inv.category && (matched?.category || rawInv?.researchType)) {
    inv.category = matched?.category ?? rawInv.researchType;
  }

  const slug =
    slugifyPsiKey(
      inv.slug ?? inv.id ?? inv.psiId ?? inv.acronym ?? inv.title ?? inv._id
    ) || 'study';

  const isUpcoming = inv.dataAvailable === false || inv.status === 'upcoming';
  const cond = inv.conditions ?? {};
  const minO2 = cond.oxygenMinPct ?? cond.oxygenPct;
  const maxO2 = cond.oxygenMaxPct ?? cond.oxygenPct;
  const oxygenRange = isUpcoming
    ? 'No PSI data yet'
    : minO2 != null && maxO2 != null && minO2 !== maxO2
      ? `${minO2}% → ${maxO2}% O₂ (nominal ${cond.oxygenPct ?? maxO2}%)`
      : cond.oxygenPct != null
        ? `${cond.oxygenPct}% O₂`
        : 'null (unverified)';

  const ambientPressure = isUpcoming
    ? 'No PSI data yet'
    : cond.pressurePsi != null
      ? `${cond.pressurePsi} psi`
      : 'null (unverified)';

  const flowVelocityLabel = isUpcoming
    ? 'No PSI data yet'
    : cond.flowVelocity != null
      ? `${cond.flowVelocity} m/s`
      : 'null (unverified / quiescent)';

  const score = rankItem?.score ?? null;
  const matchScore = score != null ? Math.round(score * 100) : null;
  const breakdown = rankItem?.breakdown ?? [];

  return {
    ...inv,
    id: slug,
    status: inv.status ?? (isUpcoming ? 'upcoming' : 'published'),
    dataAvailable: !isUpcoming,
    name: inv.acronym ?? inv.title,
    facility: inv.hardware ?? 'NASA ISS Facility',
    subtitle: inv.title,
    description: inv.objective,
    fuelGeometry: inv.fuel ?? 'null',
    fuelDetail: inv.fuel ?? 'null',
    oxygenRange,
    ambientPressure,
    ambientLabel:
      cond.ambient ??
      (isUpcoming ? 'Upcoming lunar payload · No PSI conditions yet' : 'ISS microgravity testbed'),
    flowVelocity: flowVelocityLabel,
    criticalBehavior: inv.objective,
    verified: !isUpcoming,
    verifiedLabel: isUpcoming ? 'UPCOMING · NO PSI DATA YET' : 'NASA PSI ARCHIVE RECORD',
    archiveCode: inv.psiId ?? slug.toUpperCase(),
    vehicle: inv.hardware ?? 'ISS',
    score,
    matchScore,
    breakdown,
    aiSummary: {
      student: `${inv.objective ?? ''}${
        inv.earthApplications?.length
          ? ` Earth application: ${inv.earthApplications[0]}.`
          : ''
      }`,
      engineer: `${inv.objective ?? ''} [Hardware: ${inv.hardware ?? 'N/A'} | Fuel: ${
        inv.fuel ?? 'N/A'
      } | O₂: ${oxygenRange} | P: ${ambientPressure} | Flow: ${flowVelocityLabel}]`,
    },
    aiInsight: isUpcoming
      ? `${inv.acronym} (${inv.title}) is a planned lunar-gravity investigation with no experimental PSI dataset published yet.`
      : inv.acronym === 'E-FIELD Flames'
        ? 'E-FIELD Flames uses electric-field ion-driven convection in microgravity as an experimental body-force proxy for partial gravity (lunar/Martian buoyancy).'
        : inv.acronym === 'CFI-G'
          ? 'CFI-G tested the highest oxygen concentration in the PSI combustion archive (up to 85% O₂ injected from the spherical burner).'
          : `${inv.acronym} provides empirical ${inv.gravityLevel ?? 'microgravity'} bounds in ${inv.hardware ?? 'ISS facility'}.`,
    synthesis: {
      missionObjective: inv.objective ?? 'Not available in PSI record.',
      fuelAndGeometry: inv.fuel ?? 'Not available in PSI record.',
      testConditions: `O₂: ${oxygenRange} | Pressure: ${ambientPressure} | Flow: ${flowVelocityLabel} | Gravity: ${inv.gravityLevel}`,
      telemetryArray: inv.sensors?.length ? inv.sensors.join(', ') : 'Not available in PSI record.',
    },
  };
}

export function rankLocalInvestigations(scenario = {}, weights = {}) {
  const results = rankDataset(processedInvestigations, scenario, weights);
  return results.map((item) => ({
    ...item,
    investigation: enrichInvestigationForUI(item.investigation, item),
  }));
}

/**
 * Checks whether a What-If query (oxygenPct, pressurePsi, flowVelocity, fuelType)
 * falls inside the empirical region covered by measured NASA PSI data.
 */
export function checkConditionCoverage(
  { oxygenPct, pressurePsi, flowVelocity, fuelType = 'all' },
  investigations = processedInvestigations
) {
  const pool =
    fuelType && fuelType !== 'all'
      ? investigations.filter((inv) => inv.fuelType === fuelType)
      : investigations;

  if (!pool.length) {
    return {
      covered: false,
      message: 'No measured data in this region',
      detail: `No PSI investigations match fuel type "${fuelType}".`,
    };
  }

  const o2Values = pool
    .flatMap((inv) => [
      inv.conditions?.oxygenMinPct,
      inv.conditions?.oxygenMaxPct,
      inv.conditions?.oxygenPct,
    ])
    .filter((v) => v != null);
  const pValues = pool.map((inv) => inv.conditions?.pressurePsi).filter((v) => v != null);
  const flowValues = pool.map((inv) => inv.conditions?.flowVelocity).filter((v) => v != null);

  const minO2 = o2Values.length ? Math.min(...o2Values) : 15;
  const maxO2 = o2Values.length ? Math.max(...o2Values) : 85;
  const minP = pValues.length ? Math.min(...pValues) - 1.5 : 8.5;
  const maxP = pValues.length ? Math.max(...pValues) + 1.5 : 16.5;
  const maxFlow = flowValues.length ? Math.max(...flowValues, 0.35) : 0.35;

  const reasons = [];
  if (oxygenPct != null && (oxygenPct < minO2 || oxygenPct > maxO2)) {
    reasons.push(
      `O₂ (${oxygenPct}%) is outside the measured ${
        fuelType !== 'all' ? `${fuelType}-fuel ` : ''
      }PSI envelope (${minO2}%–${maxO2}% O₂; global max is 85% O₂ in CFI-G)`
    );
  }
  if (pressurePsi != null && (pressurePsi < minP || pressurePsi > maxP)) {
    reasons.push(
      `Pressure (${pressurePsi} psi) is outside the measured PSI cabin/chamber envelope (${minP.toFixed(
        1
      )}–${maxP.toFixed(1)} psi)`
    );
  }
  if (flowVelocity != null && (flowVelocity < 0 || flowVelocity > maxFlow)) {
    reasons.push(
      `Airflow (${flowVelocity} m/s) exceeds measured forced-convection duct bounds (0.00–${maxFlow.toFixed(
        2
      )} m/s)`
    );
  }

  // Also verify at least one study in the pool is simultaneously close in both O2 and pressure
  const hasJointMatch = pool.some((inv) => {
    const c = inv.conditions ?? {};
    const lo = (c.oxygenMinPct ?? c.oxygenPct ?? 21) - 2.0;
    const hi = (c.oxygenMaxPct ?? c.oxygenPct ?? 21) + 2.0;
    const o2Ok = oxygenPct == null || (oxygenPct >= lo && oxygenPct <= hi);
    const pOk =
      pressurePsi == null ||
      c.pressurePsi == null ||
      Math.abs(c.pressurePsi - pressurePsi) <= 2.5;
    return o2Ok && pOk;
  });

  if (!reasons.length && !hasJointMatch) {
    reasons.push(
      `No single PSI experiment simultaneously covers ${oxygenPct}% O₂ at ${pressurePsi} psi for ${
        fuelType === 'all' ? 'any fuel' : `${fuelType} fuel`
      }`
    );
  }

  return {
    covered: reasons.length === 0,
    message: reasons.length === 0 ? null : 'No measured data in this region',
    detail: reasons.join('; '),
    envelope: { minO2, maxO2, minP, maxP, maxFlow },
  };
}

/**
 * Generates an honest Markdown mission fire-safety brief from the active scenario,
 * factor weights, and top ranked PSI investigations without fabricating metrics.
 */
export function buildMissionBriefMarkdown({
  scenario,
  rankedItems = [],
  weights = {},
  audience = 'Engineer',
  category = 'all',
}) {
  const label = scenario?.label ?? scenario?.id ?? 'Custom Scenario';
  const lines = [
    `# Heimdall Mission Fire Safety Brief — ${label}`,
    '',
    `- **Audience mode:** ${audience}`,
    `- **Category filter:** ${category}`,
    `- **Target environment:** Gravity ${scenario?.gravity ?? 'N/A'} | O₂ ${scenario?.oxygenPct ?? 'N/A'}% | Pressure ${scenario?.pressurePsi ?? 'N/A'} psi | Flow ${scenario?.flow ?? 'N/A'} m/s`,
  ];

  if (scenario?.partialGravity) {
    lines.push(
      '- **Partial-gravity note:** NASA PSI currently contains no direct lunar (0.165g) or Martian (0.38g) datasets (LUCI & FM2 upcoming). Risk is bounded between 0g microgravity and 1g baselines.'
    );
  }

  const weightEntries = Object.entries(weights);
  if (weightEntries.length > 0) {
    lines.push(
      `- **Ranking weights:** ${weightEntries
        .map(([k, v]) => `${FACTOR_LABELS[k] ?? k}: ${v}`)
        .join(' · ')}`
    );
  }

  lines.push('', '## Top Ranked NASA PSI Investigations', '');

  const topItems = rankedItems.slice(0, 5);
  if (!topItems.length) {
    lines.push('No investigations matched the active filters.');
  } else {
    topItems.forEach((item, idx) => {
      const scorePct = item.matchScore != null ? `${item.matchScore}%` : 'N/A';
      const summary =
        audience === 'Student'
          ? item.aiSummary?.student ?? item.objective
          : item.aiSummary?.engineer ?? item.objective;
      const breakdownStr = Array.isArray(item.breakdown) && item.breakdown.length
        ? item.breakdown
            .map((b) => `${FACTOR_LABELS[b.factor] ?? b.factor}: +${(b.contribution * 100).toFixed(0)}%`)
            .join(', ')
        : 'N/A';

      lines.push(
        `### ${idx + 1}. ${item.acronym ?? item.name} (${item.psiId ?? item.id}) — Match ${scorePct}`,
        `- **Category / Hardware:** ${item.category ?? 'N/A'} · ${item.hardware ?? 'N/A'}`,
        `- **Test Conditions:** O₂ ${item.oxygenRange ?? 'N/A'} · Pressure ${item.ambientPressure ?? 'N/A'} · Gravity ${item.gravityLevel ?? 'N/A'}`,
        `- **Score Breakdown:** ${breakdownStr}`,
        `- **Brief:** ${summary ?? 'No summary available.'}`,
        item.sourceUrl ? `- **PSI Source:** ${item.sourceUrl}` : null,
        ''
      );
    });
  }

  return lines.filter((line) => line !== null).join('\n');
}
