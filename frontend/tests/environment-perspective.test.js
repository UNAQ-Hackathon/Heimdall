import assert from 'node:assert/strict';
import test from 'node:test';
import { getEnvironmentPerspective, sampleEnvironmentHeight, createEnvironmentPatch } from '../src/components/three/environment-perspective.js';

const bodies = ['mercury', 'venus', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'sun'];

for (const id of bodies) {
  test(`${id}: perspective looks into its environment with adequate camera clearance`, () => {
    const view = getEnvironmentPerspective(id);
    assert.ok(view.position.every(Number.isFinite));
    assert.ok(view.target.every(Number.isFinite));
    assert.ok(view.position[2] > view.target[2]);
    assert.ok(view.position[1] > sampleEnvironmentHeight(view.position[0], view.position[2], id) + 0.5);
    assert.ok(view.fov >= 35 && view.fov <= 60);
    assert.ok(view.near > 0 && view.far > 150);
  });

  test(`${id}: continuous faceted environment is deterministic and finite`, () => {
    const patch = createEnvironmentPatch(id, 24);
    assert.deepEqual(patch, createEnvironmentPatch(id, 24));
    assert.equal(patch.positions.length, 25 * 25 * 3);
    assert.equal(patch.indices.length, 24 * 24 * 6);
    assert.ok(patch.positions.every(Number.isFinite));
    assert.ok(patch.tones.every((value) => value >= 0 && value <= 1));
    assert.ok(patch.indices.every((value) => value < 25 * 25));
    assert.ok(patch.positions[2] < getEnvironmentPerspective(id).target[2]);
  });
}

test('viewpoints distinguish terrain, cloud decks and solar plasma', () => {
  assert.notDeepEqual(getEnvironmentPerspective('moon').position, getEnvironmentPerspective('jupiter').position);
  assert.notDeepEqual(getEnvironmentPerspective('sun').position, getEnvironmentPerspective('mars').position);
  assert.equal(getEnvironmentPerspective('mercury').ambient, 0.15);
  assert.equal(getEnvironmentPerspective('sun').emissive, true);
  assert.ok(getEnvironmentPerspective('venus').fog);
  assert.equal(getEnvironmentPerspective('moon').fog, null);
  assert.throws(() => getEnvironmentPerspective('pluto'), RangeError);
  assert.throws(() => createEnvironmentPatch('mars', 0), RangeError);
});

test('crater basins have raised rims rather than block-shaped pits', () => {
  for (const id of ['mercury', 'moon']) {
    const basin = sampleEnvironmentHeight(-4, -18, id);
    const rim = sampleEnvironmentHeight(4, -18, id);
    assert.ok(rim > basin + 0.5);
  }
});
