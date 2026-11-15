import assert from 'node:assert/strict';
import test from 'node:test';

import { enrichInvestigationForUI, processedInvestigations } from '../src/services/ranking.js';
import {
  computeTelemetryKPIs,
  deriveTelemetryTheme,
  filterTelemetryRuns,
  filterTelemetryStudies,
  getAllFlexRuns,
  getExperimentParamEntries,
  isDropletTelemetryStudy,
  normalizeMongoExperiments,
} from '../src/services/telemetry-f1.js';

const enrichedStudies = processedInvestigations.map((inv) => enrichInvestigationForUI(inv));

test('enrichInvestigationForUI resolves non-empty id even from partial MongoDB schema docs', () => {
  const partialMongo = {
    _id: '675000000000000000000001',
    slug: 'acme-cfi-g',
    name: 'CFI-G',
    family: 'CIR/ACME',
    researchType: 'prevention',
    sources: { psiId: 'PSI-ACME-CFI-G' },
  };
  const enriched = enrichInvestigationForUI(partialMongo);
  assert.equal(enriched.id, 'acme-cfi-g');
  assert.equal(enriched.acronym, 'CFI-G');
  assert.equal(enriched.psiId, 'PSI-ACME-CFI-G');
  assert.equal(enriched.conditions?.oxygenMaxPct, 39.97);
});

test('filterTelemetryStudies filters by oxygen regime, pillar, fuel, hardware, and query', () => {
  const hyperoxic = filterTelemetryStudies(enrichedStudies, { oxygenRegime: 'hyperoxic' });
  assert.ok(hyperoxic.some((s) => s.acronym === 'CFI-G'));
  assert.ok(hyperoxic.every((s) => (s.conditions?.oxygenMaxPct ?? s.conditions?.oxygenPct) > 35));

  const detectionMsg = filterTelemetryStudies(enrichedStudies, {
    category: 'detection',
    hardware: 'msg',
  });
  assert.ok(detectionMsg.length >= 2);
  assert.ok(detectionMsg.every((s) => s.category === 'detection'));
});

test('FLEX 258-run telemetry filters accurately by fuel, gas mix, and oxygen band', () => {
  const runs = getAllFlexRuns();
  assert.equal(runs.length, 258);

  const co2Methanol = filterTelemetryRuns(runs, { fuel: 'Methanol', mix: 'CO₂' });
  assert.ok(co2Methanol.length > 0);
  assert.ok(co2Methanol.every((r) => r.fuel === 'Methanol' && r.mix === 'CO₂' && r.co2Pct > 0));

  const heRuns = filterTelemetryRuns(runs, { mix: 'He' });
  assert.ok(heRuns.length > 0);
  assert.ok(heRuns.every((r) => r.hePct > 0));
});

test('deriveTelemetryTheme adapts interface palette dynamically to fetched data', () => {
  const cfiG = enrichedStudies.find((s) => s.acronym === 'CFI-G');
  const cfiTheme = deriveTelemetryTheme({ study: cfiG });
  assert.equal(cfiTheme.id, 'hyperoxic');
  assert.equal(cfiTheme.primary, '#fb7185');

  const same = enrichedStudies.find((s) => s.acronym === 'SAME');
  const sameTheme = deriveTelemetryTheme({ study: same });
  assert.equal(sameTheme.id, 'detection');
  assert.equal(sameTheme.primary, '#fbbf24');

  const efield = enrichedStudies.find((s) => s.acronym === 'E-FIELD Flames');
  const efieldTheme = deriveTelemetryTheme({ study: efield });
  assert.equal(efieldTheme.id, 'efield');
  assert.equal(efieldTheme.primary, '#a78bfa');

  const runs = getAllFlexRuns();
  const co2Run = runs.find((r) => r.mix === 'CO₂');
  const heRun = runs.find((r) => r.mix === 'He');
  const flex2 = enrichedStudies.find((s) => s.acronym === 'FLEX-2');

  assert.equal(deriveTelemetryTheme({ study: flex2, activeRun: co2Run }).id, 'co2');
  assert.equal(deriveTelemetryTheme({ study: flex2, activeRun: heRun }).id, 'helium');
  assert.equal(isDropletTelemetryStudy(flex2), true);
});

test('computeTelemetryKPIs computes exact deltas without inventing missing values', () => {
  const runs = getAllFlexRuns();
  const co2Run = runs.find((r) => r.mix === 'CO₂');
  const flex2 = enrichedStudies.find((s) => s.acronym === 'FLEX-2');
  const kpis = computeTelemetryKPIs({ study: flex2, runs, activeRun: co2Run });

  assert.equal(kpis.o2Value, co2Run.o2Pct);
  assert.equal(kpis.co2Pct, co2Run.co2Pct);
  assert.equal(kpis.pressureMmhg, co2Run.pressureMmhg);
  assert.equal(kpis.diameterMm, co2Run.diameterMm);
  assert.equal(kpis.flowVelocity, 0.026);

  const cfiG = enrichedStudies.find((s) => s.acronym === 'CFI-G');
  const cfiKpis = computeTelemetryKPIs({ study: cfiG });
  assert.equal(cfiKpis.flowVelocity, null);
  assert.equal(cfiKpis.o2Value, 37.165);
});

test('normalizeMongoExperiments and getExperimentParamEntries preserve non-FLEX BASS-II runs', () => {
  const bassIiDocs = [
    {
      runId: 'B1',
      investigationSlug: 'bass-ii',
      date: '2014-02-19',
      flowVelocityMs: null,
      pressureKpa: null,
      o2Percent: 22.2,
      o2PercentFinal: 22.2,
      fuel: {
        material: '100 micron PMMA film   2 cm wide',
        family: 'PMMA',
        form: 'film',
      },
      gravity: { regime: 'microgravity', g: 0 },
      params: {
        co2InitialPct: 0.44,
        co2FinalPct: 0.44,
        coInitialPpm: 0,
        coFinalPpm: 6,
        totalFrames: 57,
      },
      sensors: ['CO2', 'CO', 'O2', 'radiometer'],
      sourceFile: 'PSI-25_Experimental table_BASS-II.csv',
      pi: 'Bhattacharjee',
      sampleNumber: '147',
    },
  ];

  const normalized = normalizeMongoExperiments(bassIiDocs);
  assert.equal(normalized.length, 1);
  const run = normalized[0];
  assert.equal(run.runId, 'B1');
  assert.equal(run.fuelFamily, 'PMMA');
  assert.equal(run.o2Pct, 22.2);
  assert.equal(run.o2PctFinal, 22.2);
  assert.equal(run.pressurePsi, null);
  assert.equal(run.sourceFile, 'PSI-25_Experimental table_BASS-II.csv');
  assert.deepEqual(run.sensors, ['CO2', 'CO', 'O2', 'radiometer']);

  const entries = getExperimentParamEntries(run);
  assert.deepEqual(
    entries.map((e) => [e.label, e.value]),
    [
      ['CO₂ init', '0.44 %'],
      ['CO₂ final', '0.44 %'],
      ['CO init', '0 ppm'],
      ['CO final', '6 ppm'],
      ['Frames', '57'],
    ]
  );

  const bassIi = enrichedStudies.find((s) => s.acronym === 'BASS-II');
  const kpis = computeTelemetryKPIs({ study: bassIi, runs: normalized });
  assert.equal(kpis.runCount, 1);
  assert.equal(kpis.o2Min, 22.2);
  assert.equal(kpis.o2Max, 22.2);
});
