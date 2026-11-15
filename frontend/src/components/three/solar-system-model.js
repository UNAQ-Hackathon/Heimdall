import { PLANET_MODELS } from './planet-catalog.js';

export function getSolarPlanetId(modelPath) {
  const filename = typeof modelPath === 'string' ? modelPath.split('/').at(-1) : null;
  const model = PLANET_MODELS.find((entry) => entry.filename === filename);
  if (!model) throw new RangeError(`Unknown solar-system asset: ${modelPath}`);
  return model.id;
}

/**
 * Computes the horizontal camera view offset (in CSS pixels) so the orbital
 * focus projects at the exact midpoint between the canvas left edge (sidebar
 * border or screen edge) and an overlying right-hand inspection panel.
 */
export function computeInspectorCenterOffsetX(canvasWidth, occludedRight) {
  if (!Number.isFinite(canvasWidth) || canvasWidth <= 0) return 0;
  if (!Number.isFinite(occludedRight) || occludedRight <= 0) return 0;
  return Math.min(canvasWidth * 0.42, occludedRight * 0.5);
}
