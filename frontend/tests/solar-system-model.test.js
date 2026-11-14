import assert from 'node:assert/strict';
import test from 'node:test';

import { PLANETS } from '../src/services/mockData.js';
import { getPlanetModel } from '../src/components/three/planet-catalog.js';
import { getSolarPlanetId } from '../src/components/three/solar-system-model.js';

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
