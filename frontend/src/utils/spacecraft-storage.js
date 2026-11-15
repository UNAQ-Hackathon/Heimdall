export const SPACECRAFT_STORAGE_KEY = 'heimdall.selectedSpacecraft';
export const DEFAULT_SHIP_FILE = 'naveAzulNuevo.glb';

export const LEGACY_SHIP_FILE_MAP = {
  'Nave_Azul_LowPoly.glb': 'naveAzulNuevo.glb',
  'Nave_Roja_LowPoly.glb': 'naveRojaNuevo.glb',
  'Nave_Verde_LowPoly.glb': 'naveVerdeNuevo.glb',
  'OVNI_LowPoly.glb': 'ovniNuevo.glb',
};

export const VALID_SHIP_FILES = [
  'naveAzulNuevo.glb',
  'naveRojaNuevo.glb',
  'naveVerdeNuevo.glb',
  'ovniNuevo.glb',
  'MilleniumTriangle.glb',
];

export function resolveShipFile(candidate) {
  if (typeof candidate !== 'string' || !candidate.trim()) {
    return DEFAULT_SHIP_FILE;
  }
  const normalized = LEGACY_SHIP_FILE_MAP[candidate.trim()] ?? candidate.trim();
  return VALID_SHIP_FILES.includes(normalized) ? normalized : DEFAULT_SHIP_FILE;
}

export function loadSavedShipFile(storage = typeof window !== 'undefined' ? window.localStorage : null) {
  if (!storage || typeof storage.getItem !== 'function') {
    return DEFAULT_SHIP_FILE;
  }
  try {
    return resolveShipFile(storage.getItem(SPACECRAFT_STORAGE_KEY));
  } catch {
    return DEFAULT_SHIP_FILE;
  }
}

export function saveShipFile(shipFile, storage = typeof window !== 'undefined' ? window.localStorage : null) {
  const resolved = resolveShipFile(shipFile);
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(SPACECRAFT_STORAGE_KEY, resolved);
    } catch {
      // Ignore storage quota or private-browsing access errors
    }
  }
  return resolved;
}
