import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { ISS_STATION_MODEL } from '../src/components/three/planet-catalog.js';
import { normalizeModel } from '../src/components/three/normalize-model.js';
import { createSurfacePreview, ISS_INTERIOR_PHASE_LABELS } from '../src/components/three/surface-preview.js';
import { ISS_DESTINATION, PLANETS } from '../src/services/mockData.js';

async function loadRawGlb(relPath) {
  const fileUrl = new URL(relPath, import.meta.url);
  const bytes = await readFile(fileUrl);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const jsonLength = bytes.readUInt32LE(12);
  const metadata = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const parsed = await new GLTFLoader().parseAsync(buffer, '');
  return { scene: parsed.scene, metadata };
}

for (const [label, relPath] of [
  ['issNuevo', '../../assets3d/ISS/issNuevo.glb'],
  ['MilleniumTriangle', '../../assets3d/millenium/MilleniumTriangle.glb'],
]) {
  test(`${label}: new 3D GLB loads cleanly, is self-contained, and normalizes`, async () => {
    const { scene, metadata } = await loadRawGlb(relPath);
    for (const resource of [...(metadata.buffers ?? []), ...(metadata.images ?? [])]) {
      assert.ok(!resource.uri || resource.uri.startsWith('data:'), 'External resource found');
    }
    const normalized = normalizeModel(scene);
    const bounds = new Box3().setFromObject(normalized);
    const size = bounds.getSize(new Vector3());
    assert.ok(Math.abs(Math.max(size.x, size.y, size.z) - 2) < 1e-5);
    assert.ok(bounds.getCenter(new Vector3()).length() < 1e-5);
  });
}

test('ISS orbital destination sits cleanly between Earth and Moon and links to iss scenario', () => {
  const earth = PLANETS.find((p) => p.name === 'Earth');
  const moon = PLANETS.find((p) => p.name === 'Moon');
  assert.equal(ISS_DESTINATION.name, 'ISS');
  assert.equal(ISS_DESTINATION.parent, 'Earth');
  assert.ok(ISS_DESTINATION.distance > earth.size);
  assert.ok(ISS_DESTINATION.distance + ISS_DESTINATION.size < moon.distance - moon.size);
  assert.equal(ISS_STATION_MODEL.id, 'iss');
  assert.equal(ISS_STATION_MODEL.analyzable, true);
  assert.equal(ISS_STATION_MODEL.scenarioId, 'iss');
});

test('ISS conceptual interior theme and airlock phase labels are defined in English', () => {
  const theme = createSurfacePreview(null, 'iss');
  assert.equal(theme.kind, 'interior');
  assert.ok(theme.title.includes('ISS'));
  assert.ok(theme.description.toLowerCase().includes('airlock'));
  assert.deepEqual(Object.keys(ISS_INTERIOR_PHASE_LABELS), ['pressurize', 'ingress', 'sealed']);
  for (const label of Object.values(ISS_INTERIOR_PHASE_LABELS)) {
    assert.ok(/^[A-Z0-9\s·.\-]+$/i.test(label));
  }
});
