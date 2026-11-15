import assert from 'node:assert/strict';
import test from 'node:test';

import { PLANET_MODELS, getPlanetModel } from '../src/components/three/planet-catalog.js';
import { SCENARIOS } from '../src/context/scenarios.js';
import {
  processedInvestigations,
  rankLocalInvestigations,
  enrichInvestigationForUI,
  checkConditionCoverage,
  buildMissionBriefMarkdown,
} from '../src/services/ranking.js';

const EXPECTED_ACRONYMS = [
  'BASS',
  'BASS-II',
  'Saffire-I',
  'Saffire-II',
  'Saffire-III',
  'SAME',
  'SAME-R',
  'FLEX',
  'FLEX-2',
  'CFI',
  'CFI-G',
  'BRE',
  'E-FIELD Flames',
  'CLD Flame',
  'Flame Design',
  's-Flame',
  'SPICE',
  'SLICE',
  'DAFT',
  'DAFT-2',
  'SoFIE',
  'LUCI',
  'FM2',
];

test('processed PSI dataset includes all 23 required investigations and verified hardware', () => {
  assert.equal(processedInvestigations.length, 23);
  const acronyms = processedInvestigations.map((inv) => inv.acronym);
  for (const reqAcronym of EXPECTED_ACRONYMS) {
    assert.ok(acronyms.includes(reqAcronym), `Missing PSI investigation: ${reqAcronym}`);
  }

  const flex = processedInvestigations.find((i) => i.acronym === 'FLEX');
  assert.equal(flex.series.length, 6);
  assert.equal(
    flex.series.reduce((sum, s) => sum + s.samples.length, 0),
    258
  );

  const sofie = processedInvestigations.find((i) => i.acronym === 'SoFIE');
  assert.equal(sofie.category, 'prevention');
  assert.equal(sofie.fuelType, 'solid');
  assert.equal(sofie.dataAvailable, true);

  for (const upcomingAcronym of ['LUCI', 'FM2']) {
    const item = processedInvestigations.find((i) => i.acronym === upcomingAcronym);
    assert.equal(item.status, 'upcoming');
    assert.equal(item.gravityLevel, 'lunar-partial');
    assert.equal(item.dataAvailable, false);
    assert.deepEqual(item.series, []);
  }

  const flex2 = processedInvestigations.find((i) => i.acronym === 'FLEX-2');
  assert.ok(flex2.hardware.includes('MDCA'), 'FLEX-2 must reference MDCA in CIR');
  assert.equal(flex2.fuelType, 'droplet');

  const cfiG = processedInvestigations.find((i) => i.acronym === 'CFI-G');
  assert.equal(cfiG.conditions.oxygenPct, 85);
  assert.ok(cfiG.hardware.includes('CIR/ACME'));

  const eField = processedInvestigations.find((i) => i.acronym === 'E-FIELD Flames');
  assert.ok(eField.tags.includes('partial-gravity-proxy'));

  const daft = processedInvestigations.find((i) => i.acronym === 'DAFT');
  assert.ok(daft.hardware.includes('SAME'));
  assert.equal(daft.conditions.flowVelocity, null);
});

test('planet catalog marks only Earth, Moon, and Mars as analyzable with scenarioId', () => {
  const analyzable = PLANET_MODELS.filter((p) => p.analyzable);
  assert.deepEqual(
    analyzable.map((p) => [p.id, p.scenarioId]),
    [
      ['earth', 'earth'],
      ['moon', 'moon'],
      ['mars', 'mars'],
    ]
  );

  for (const id of ['mercury', 'venus', 'jupiter', 'saturn', 'uranus', 'neptune', 'sun']) {
    const model = getPlanetModel(id);
    assert.equal(model.analyzable, false);
    assert.equal(model.scenarioId, null);
  }
});

test('5 product scenarios exist with Mars marked as assumed same as lunar', () => {
  assert.deepEqual(Object.keys(SCENARIOS), ['earth', 'iss', 'moon', 'mars', 'suit']);
  assert.equal(SCENARIOS.moon.gravityG, 0.165);
  assert.equal(SCENARIOS.moon.oxygenPct, 30);
  assert.equal(SCENARIOS.moon.pressurePsi, 10.2);
  assert.equal(SCENARIOS.mars.assumedAtmosphere, true);
  assert.ok(SCENARIOS.mars.oxygenDisplay.includes('assumed, same as lunar'));
  assert.equal(SCENARIOS.suit.oxygenPct, 100);
  assert.equal(SCENARIOS.suit.pressurePsi, 4.3);
});

test('ranking is deterministic and changes when scenario or weights change', () => {
  const moonRun1 = rankLocalInvestigations(SCENARIOS.moon, {
    atmosphereMatch: 40,
    gravityMatch: 20,
    dataRichness: 20,
    documentation: 20,
  });
  const moonRun2 = rankLocalInvestigations(SCENARIOS.moon, {
    atmosphereMatch: 40,
    gravityMatch: 20,
    dataRichness: 20,
    documentation: 20,
  });

  assert.deepEqual(
    moonRun1.map((r) => ({ id: r.investigation.psiId, score: r.score })),
    moonRun2.map((r) => ({ id: r.investigation.psiId, score: r.score }))
  );

  // Every ranked item has 4 factor breakdowns
  for (const item of moonRun1) {
    assert.equal(item.breakdown.length, 4);
  }

  const issRun = rankLocalInvestigations(SCENARIOS.iss, {
    atmosphereMatch: 40,
    gravityMatch: 20,
    dataRichness: 20,
    documentation: 20,
  });
  assert.notDeepEqual(
    moonRun1.map((r) => r.investigation.psiId),
    issRun.map((r) => r.investigation.psiId)
  );

  const gravityHeavyMoon = rankLocalInvestigations(SCENARIOS.moon, {
    atmosphereMatch: 5,
    gravityMatch: 85,
    dataRichness: 5,
    documentation: 5,
  });
  assert.notEqual(moonRun1[0].score, gravityHeavyMoon[0].score);
});

test('checkConditionCoverage detects inside-envelope vs out-of-envelope conditions', () => {
  const inBounds = checkConditionCoverage({
    oxygenPct: 21,
    pressurePsi: 14.7,
    flowVelocity: 0.1,
    fuelType: 'all',
  });
  assert.equal(inBounds.covered, true);

  const outOfBounds = checkConditionCoverage({
    oxygenPct: 95,
    pressurePsi: 4.3,
    flowVelocity: 0.45,
    fuelType: 'all',
  });
  assert.equal(outOfBounds.covered, false);
  assert.equal(outOfBounds.message, 'No measured data in this region');
});

test('buildMissionBriefMarkdown outputs transparent scenario, weights, and ranked PSI citations', () => {
  const weights = { atmosphereMatch: 40, gravityMatch: 20, dataRichness: 20, documentation: 20 };
  const ranked = rankLocalInvestigations(SCENARIOS.moon, weights).map((item) =>
    enrichInvestigationForUI(item.investigation, item)
  );
  const md = buildMissionBriefMarkdown({
    scenario: SCENARIOS.moon,
    rankedItems: ranked,
    weights,
    audience: 'Student',
    category: 'all',
  });
  assert.ok(md.includes('# Heimdall Mission Fire Safety Brief'));
  assert.ok(md.includes('**Audience mode:** Student'));
  assert.ok(md.includes('0g microgravity and 1g baselines'));
  assert.ok(md.includes('Top Ranked NASA PSI Investigations'));
});
