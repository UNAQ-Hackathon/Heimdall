import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { normalizeModel } from '../src/components/three/normalize-model.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '../..');

function ensureBrowserGlobals() {
  if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;
  if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
}

async function loadGlb(relPath) {
  ensureBrowserGlobals();
  const data = await fs.readFile(path.join(repoRoot, relPath));
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      '',
      resolve,
      reject
    );
  });
}

test('naveAzul status variants (normal, flames, burned) load cleanly with expected nodes and materials', async () => {
  const normal = await loadGlb('assets3d/nuevasNaves/naveAzulNuevo.glb');
  const flames = await loadGlb('assets3d/nuevasNaves/naveAzulLlamas.glb');
  const burned = await loadGlb('assets3d/nuevasNaves/naveAzulQuemada.glb');

  for (const [label, gltf] of [
    ['normal', normal],
    ['flames', flames],
    ['burned', burned],
  ]) {
    let meshCount = 0;
    gltf.scene.traverse((node) => {
      if (node.isMesh) meshCount += 1;
    });
    assert.ok(meshCount > 0, `${label} must contain meshes`);
    const normalized = normalizeModel(gltf.scene);
    const box = new THREE.Box3().setFromObject(normalized);
    assert.ok(!box.isEmpty());
  }

  const flameNodes = [];
  const smokeNodes = [];
  flames.scene.traverse((node) => {
    if (/^Llama_/i.test(node.name)) flameNodes.push(node.name);
    if (/^Humo_/i.test(node.name)) smokeNodes.push(node.name);
  });
  assert.ok(flameNodes.length > 0, 'naveAzulLlamas.glb must contain animatable Llama_* nodes');
  assert.ok(smokeNodes.length > 0, 'naveAzulLlamas.glb must contain Humo_* smoke nodes');

  const burnedMats = new Set();
  burned.scene.traverse((node) => {
    if (node.isMesh && node.material?.name) burnedMats.add(node.material.name);
  });
  assert.ok(
    [...burnedMats].some((name) => /quemad|carboniz/i.test(name)),
    'naveAzulQuemada.glb must include charred materials'
  );
});
