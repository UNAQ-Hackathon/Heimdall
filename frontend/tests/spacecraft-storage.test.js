import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SHIP_FILE,
  SPACECRAFT_STORAGE_KEY,
  loadSavedShipFile,
  resolveShipFile,
  saveShipFile,
} from '../src/utils/spacecraft-storage.js';

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

test('saves and restores selected spacecraft from browser storage', () => {
  const storage = createMemoryStorage();
  assert.equal(loadSavedShipFile(storage), DEFAULT_SHIP_FILE);

  const saved = saveShipFile('MilleniumTriangle.glb', storage);
  assert.equal(saved, 'MilleniumTriangle.glb');
  assert.equal(storage.getItem(SPACECRAFT_STORAGE_KEY), 'MilleniumTriangle.glb');
  assert.equal(loadSavedShipFile(storage), 'MilleniumTriangle.glb');
});

test('maps legacy spacecraft filenames and rejects unknown values safely', () => {
  assert.equal(resolveShipFile('Nave_Roja_LowPoly.glb'), 'naveRojaNuevo.glb');
  assert.equal(resolveShipFile('OVNI_LowPoly.glb'), 'ovniNuevo.glb');
  assert.equal(resolveShipFile('unknownShip.glb'), DEFAULT_SHIP_FILE);
  assert.equal(resolveShipFile(''), DEFAULT_SHIP_FILE);
});

test('handles unavailable or throwing storage gracefully', () => {
  const brokenStorage = {
    getItem() {
      throw new Error('SecurityError');
    },
    setItem() {
      throw new Error('QuotaExceededError');
    },
  };
  assert.equal(loadSavedShipFile(brokenStorage), DEFAULT_SHIP_FILE);
  assert.equal(saveShipFile('ovniNuevo.glb', brokenStorage), 'ovniNuevo.glb');
  assert.equal(loadSavedShipFile(null), DEFAULT_SHIP_FILE);
});
