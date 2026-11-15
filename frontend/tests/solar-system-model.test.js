import assert from 'node:assert/strict';
import test from 'node:test';

import { PLANETS } from '../src/services/mockData.js';
import { getPlanetModel } from '../src/components/three/planet-catalog.js';
import {
  computeInspectorCenterOffsetX,
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
