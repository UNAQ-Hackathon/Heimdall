import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLEX_TRIALS,
  getMixtureEnvelope,
  clampConditionsToEnvelope,
  updateMeterCondition,
  evaluateSupportCoverage,
  trialToConditions,
} from '../src/services/flex-coverage.js';

test('FLEX trial catalog contains 258 real input coordinates without target leakage', () => {
  assert.equal(FLEX_TRIALS.length, 258);
  for (const trial of FLEX_TRIALS) {
    assert.equal('duracion' in trial, false);
    assert.equal('y' in trial, false);
    assert.ok(trial.p > 0 && trial.d > 0);
  }
});

test('meters clamp strictly inside active FLEX bounds and maintain gas sum = 1.000', () => {
  const envCo2 = getMixtureEnvelope('Methanol', 'CO₂');
  const clamped = clampConditionsToEnvelope(
    { fuel: 'Methanol', pressure_mmhg: 99999, o2_fraction: 0.9, n2_fraction: 0.1, co2_fraction: 0.85, he_fraction: 0.2, diameter_mm: 99 },
    'Methanol',
    'CO₂'
  );
  assert.ok(clamped.pressure_mmhg >= envCo2.pressure[0] && clamped.pressure_mmhg <= envCo2.pressure[1]);
  assert.ok(clamped.o2_fraction >= envCo2.o2[0] && clamped.o2_fraction <= envCo2.o2[1]);
  assert.ok(clamped.co2_fraction >= envCo2.co2[0] && clamped.co2_fraction <= envCo2.co2[1]);
  assert.equal(clamped.he_fraction, 0);
  assert.ok(clamped.diameter_mm >= envCo2.diameter[0] && clamped.diameter_mm <= envCo2.diameter[1]);
  const sum = clamped.o2_fraction + clamped.n2_fraction + clamped.co2_fraction + clamped.he_fraction;
  assert.ok(Math.abs(sum - 1) <= 0.002);

  const updated = updateMeterCondition(clamped, 'CO₂', 'pressure_mmhg', 100);
  assert.equal(updated.pressure_mmhg, envCo2.pressure[0]);
});

test('support coverage identifies published trial, gap, and nearest valid snap target', () => {
  const baseline = evaluateSupportCoverage({
    fuel: 'Methanol',
    pressure_mmhg: 765,
    o2_fraction: 0.21,
    n2_fraction: 0.79,
    co2_fraction: 0,
    he_fraction: 0,
    diameter_mm: 1.8,
  });
  assert.equal(baseline.supported, true);

  const gap = evaluateSupportCoverage({
    fuel: 'Methanol',
    pressure_mmhg: 765,
    o2_fraction: 0.31,
    n2_fraction: 0.69,
    co2_fraction: 0,
    he_fraction: 0,
    diameter_mm: 1.8,
  });
  assert.equal(gap.supported, false);
  assert.ok(Math.abs(gap.distance - 0.9163) < 0.005);
  assert.ok(gap.nearestTrial);
  const snapped = evaluateSupportCoverage(trialToConditions(gap.nearestTrial));
  assert.equal(snapped.supported, true);
});
