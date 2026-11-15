import assert from 'node:assert/strict';
import test from 'node:test';

import { PLANETS } from '../src/services/mockData.js';
import { getPlanetModel } from '../src/components/three/planet-catalog.js';
import {
  computeInspectorCenterOffsetX,
  computeTrailScale,
  getSolarPlanetId,
} from '../src/components/three/solar-system-model.js';

for (const planet of PLANETS) {
  test(`${planet.name}: mission scene asset resolves to a canonical PlanetModel ID`, () => {
    const id = getSolarPlanetId(planet.model);
    assert.equal(getPlanetModel(id).filename, planet.model.split('/').at(-1));
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0);
  });
}

test('solar scene resolves localized filenames without fetching obsolete public paths', () => {
  assert.equal(getSolarPlanetId('/models/planetas/Sol.glb'), 'sun');
  assert.equal(getSolarPlanetId('/models/planetas/Tierra.glb'), 'earth');
  assert.equal(getSolarPlanetId('/models/planetas/Luna.glb'), 'moon');
  assert.equal(new Set(PLANETS.map(({ model }) => getSolarPlanetId(model))).size, 10);
});

test('missing and unsupported scene assets remain explicit errors, not silent Earth fallbacks', () => {
  for (const model of [undefined, null, '', '/models/planetas/Pluto.glb']) {
    assert.throws(() => getSolarPlanetId(model), RangeError);
  }
  assert.throws(() => getPlanetModel(undefined), RangeError);
});

test('inspector view offset centers planets cleanly between sidebar/edge and inspection drawer', () => {
  // With sidebar open (canvas 1020px) and 368px right panel: midpoint is (1020 - 368)/2 = 326px
  const offsetWithSidebar = computeInspectorCenterOffsetX(1020, 368);
  assert.equal(1020 / 2 - offsetWithSidebar, (1020 - 368) / 2);

  // With sidebar collapsed (canvas 1440px) and 368px right panel: midpoint is (1440 - 368)/2 = 536px
  const offsetNoSidebar = computeInspectorCenterOffsetX(1440, 368);
  assert.equal(1440 / 2 - offsetNoSidebar, (1440 - 368) / 2);

  // Closed panel or invalid inputs return zero offset
  assert.equal(computeInspectorCenterOffsetX(1020, 0), 0);
  assert.equal(computeInspectorCenterOffsetX(0, 368), 0);
});

test('orbital trail scale stays smaller on tight orbits like Moon than wide outer orbits or long transfers', () => {
  const moonOrbit = computeTrailScale({ orbitRadius: 0.49, inTransit: false });
  const earthOrbit = computeTrailScale({ orbitRadius: 0.88, inTransit: false });
  const jupiterOrbit = computeTrailScale({ orbitRadius: 1.68, inTransit: false });
  const shortHop = computeTrailScale({ inTransit: true, tripDist: 1.8, progress: 0.5 });
  const deepTransfer = computeTrailScale({ inTransit: true, tripDist: 22, progress: 0.5 });

  assert.ok(moonOrbit < earthOrbit);
  assert.ok(earthOrbit < jupiterOrbit);
  assert.ok(shortHop < deepTransfer);
  assert.ok(moonOrbit >= 0.14 && deepTransfer <= 1);
});
