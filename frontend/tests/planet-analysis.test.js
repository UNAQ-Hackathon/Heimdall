import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';

import { EARTH_ZONES, getEarthZone, getZoneDirection, getFocusView } from '../src/components/three/planet-analysis.js';

const atLatitude = (degrees) => [0, Math.sin(degrees * Math.PI / 180), Math.cos(degrees * Math.PI / 180)];

test('illustrative bands cover both hemispheres without gaps', () => {
  assert.equal(new Set(EARTH_ZONES.map(({ id }) => id)).size, 4);
  assert.equal(EARTH_ZONES[0].minLatitude, 0);
  assert.equal(EARTH_ZONES.at(-1).maxLatitude, 90);
  EARTH_ZONES.slice(1).forEach((zone, index) => {
    assert.equal(zone.minLatitude, EARTH_ZONES[index].maxLatitude);
  });
  for (const latitude of [0, 12, 23.5, 30, 35, 50, 66.5, 80, 90]) {
    assert.equal(getEarthZone(atLatitude(latitude)).id, getEarthZone(atLatitude(-latitude)).id);
  }
  assert.equal(getEarthZone(atLatitude(12)).id, 'tropical');
  assert.equal(getEarthZone(atLatitude(30)).id, 'subtropical');
  assert.equal(getEarthZone(atLatitude(50)).id, 'temperate');
  assert.equal(getEarthZone(atLatitude(80)).id, 'polar');
});

test('classification is independent of display scale and rejects invalid points', () => {
  assert.equal(getEarthZone([0, 10, 0]).id, 'polar');
  for (const point of [[0, 0, 0], [NaN, 0, 1], [0, Infinity, 1]]) {
    assert.throws(() => getEarthZone(point), RangeError);
  }
});

test('keyboard selection faces the current camera hemisphere', () => {
  for (const zone of EARTH_ZONES) {
    for (const camera of [[3, 1, 0], [-3, -1, 0], [0, 4, 0]]) {
      const direction = getZoneDirection(zone.id, camera);
      assert.equal(getEarthZone(direction).id, zone.id);
      assert.ok(Math.abs(new Vector3(...direction).length() - 1) < 1e-8);
      assert.ok(new Vector3(...direction).dot(new Vector3(...camera)) >= 0);
    }
  }
  assert.throws(() => getZoneDirection('missing', [0, 0, 4]), RangeError);
});

test('inspection keeps the planet centered with a subtle, aspect-aware approach', () => {
  for (const point of [[0, 0, 1], [1, 0, 0], [0, 1, 0], [0, -1, 0]]) {
    for (const distance of [2.55, 4.2]) {
      const { position, target } = getFocusView(point, distance);
      assert.ok(Math.abs(new Vector3(...position).length() - distance) < 1e-8);
      assert.deepEqual(target, [0, 0, 0]);
      assert.ok(new Vector3(...position).cross(new Vector3(...point)).length() < 1e-8);
    }
  }
});
