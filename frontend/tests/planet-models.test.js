import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { getPlanetModel, ISS_STATION_MODEL, PLANET_MODELS } from '../src/components/three/planet-catalog.js';
import { normalizeModel } from '../src/components/three/normalize-model.js';
import { INVESTIGATIONS } from '../src/services/mockData.js';

const assetRoot = new URL('../../assets3d/planetas/', import.meta.url);

async function loadAsset(filename) {
  const bytes = await readFile(new URL(filename, assetRoot));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const jsonLength = bytes.readUInt32LE(12);
  const metadata = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const scene = await new GLTFLoader().parseAsync(buffer, '');
  return { scene: scene.scene, metadata };
}

test('catalog contains unique IDs and filenames', () => {
  assert.equal(PLANET_MODELS.length, 10);
  assert.equal(new Set(PLANET_MODELS.map(({ id }) => id)).size, 10);
  assert.equal(new Set(PLANET_MODELS.map(({ filename }) => filename)).size, 10);
  assert.equal(getPlanetModel('saturn').filename, 'Saturno.glb');
  assert.throws(() => getPlanetModel('pluto'), RangeError);
});

for (const { id, filename } of PLANET_MODELS) {
  test(`${id}: GLB loads, is self-contained and normalizes without modifying the cache`, async () => {
    const { scene, metadata } = await loadAsset(filename);
    for (const resource of [...(metadata.buffers ?? []), ...(metadata.images ?? [])]) {
      assert.ok(!resource.uri || resource.uri.startsWith('data:'), 'External resource found');
    }
    const originalBounds = new Box3().setFromObject(scene);
    const model = normalizeModel(scene);
    const secondInstance = normalizeModel(scene);
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    assert.ok(Math.abs(Math.max(size.x, size.y, size.z) - 2) < 1e-5);
    assert.ok(bounds.getCenter(new Vector3()).length() < 1e-5);
    assert.ok(originalBounds.equals(new Box3().setFromObject(scene)));
    assert.equal(scene.parent, null);
    assert.notEqual(model.children[0].children[0], secondInstance.children[0].children[0]);
    const meshes = [];
    scene.traverse((node) => { if (node.isMesh) meshes.push(node); });
    assert.ok(meshes.length > 0);
    if (id === 'saturn') assert.ok(meshes.length >= 2);
  });
}

test('normalization rejects an empty scene', () => {
  assert.throws(() => normalizeModel(new Group()), /no visible geometry/);
});

test('all planets and ISS include detailed physical, orbital, and PSI context without broken study links', () => {
  const validStudyIds = new Set(INVESTIGATIONS.map((inv) => inv.id));
  const requiredFields = [
    'classification',
    'diameterOrSpan',
    'orbitAndRotation',
    'temperature',
    'atmosphere',
    'satellitesOrModules',
    'combustionContext',
  ];

  for (const body of [...PLANET_MODELS, ISS_STATION_MODEL]) {
    for (const field of requiredFields) {
      assert.equal(typeof body[field], 'string', `${body.id} missing ${field}`);
      assert.ok(body[field].trim().length > 0, `${body.id} has empty ${field}`);
    }
    assert.ok(Array.isArray(body.highlights) && body.highlights.length >= 2, `${body.id} highlights`);
    for (const study of body.featuredStudies ?? []) {
      assert.ok(validStudyIds.has(study.id), `${body.id} references unknown study ${study.id}`);
      assert.ok(typeof study.label === 'string' && study.label.length > 0);
    }
  }
});

test('copilot modal keeps fixed overlay positioning above global tri-card styles', async () => {
  const [mainJs, appShellCss] = await Promise.all([
    readFile(new URL('../src/main.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/app-shell.css', import.meta.url), 'utf8'),
  ]);

  const globalIdx = mainJs.indexOf("import './styles/global.css'");
  const appIdx = mainJs.indexOf("import App from './App.jsx'");
  assert.ok(globalIdx !== -1 && appIdx !== -1 && globalIdx < appIdx, 'global.css must load before App.jsx');
  assert.match(appShellCss, /\.copilot-chat\.copilot-chat--modal\s*\{[^}]*position:\s*fixed;/);
});
