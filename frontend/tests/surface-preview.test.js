import assert from 'node:assert/strict';
import test from 'node:test';
import { createSurfacePreview } from '../src/components/three/surface-preview.js';

for (const id of ['tropical', 'subtropical', 'temperate', 'polar']) {
  test(`${id}: conceptual terrain is deterministic and bounded`, () => {
    const scene = createSurfacePreview(id);
    assert.deepEqual(scene, createSurfacePreview(id));
    assert.equal(scene.tiles.length, 24 * 24);
    assert.ok(scene.tiles.every(({ x, z, height, color }) =>
      Number.isFinite(x) && Number.isFinite(z) && height > 0 && height < 8 && /^#[0-9a-f]{6}$/i.test(color)));
    assert.ok(scene.plants.every(({ x, y, z }) => [x, y, z].every(Number.isFinite)));
    if (id === 'polar') assert.equal(scene.plants.length, 0);
    else assert.ok(scene.plants.length > 0);
  });
}

test('unsupported bodies and Earth zones are rejected', () => {
  assert.throws(() => createSurfacePreview('jupiter'), RangeError);
  assert.throws(() => createSurfacePreview(null, 'pluto'), RangeError);
  assert.notDeepEqual(createSurfacePreview('polar').tiles, createSurfacePreview('tropical').tiles);
});

for (const id of ['mercury', 'venus', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'sun']) {
  test(`${id}: distinct conceptual environment without invented solid surfaces`, () => {
    const scene = createSurfacePreview(null, id);
    assert.deepEqual(scene, createSurfacePreview(null, id));
    assert.ok(scene.title && scene.description);
    assert.equal(scene.plants.length, 0);
    if (['jupiter', 'saturn', 'uranus', 'neptune', 'sun'].includes(id)) {
      assert.equal(scene.tiles.length, 0);
      assert.ok(['atmosphere', 'plasma'].includes(scene.kind));
    } else {
      assert.equal(scene.kind, 'surface');
      assert.equal(scene.tiles.length, 576);
      assert.ok(scene.rocks.length > 0);
    }
  });
}
