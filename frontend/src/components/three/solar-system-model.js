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

/**
 * Scales spacecraft exhaust/trail length smoothly according to orbital radius
 * and transfer arc distance so smaller orbits (like Moon or rocky planets) show
 * subtle, low-acceleration thruster plumes compared to wide outer-planet orbits
 * or long interplanetary burns.
 */
export function computeTrailScale({
  orbitRadius = 0.8,
  inTransit = false,
  tripDist = 10,
  progress = 0.5,
}) {
  if (inTransit) {
    const distFactor = Math.min(1, Math.max(0.32, 0.28 + (tripDist / 18) * 0.72));
    const burnArc = 0.52 + 0.48 * Math.sin(Math.PI * Math.max(0, Math.min(1, progress)));
    return Math.min(1, Math.max(0.24, distFactor * burnArc));
  }
  const safeRadius = Number.isFinite(orbitRadius) ? orbitRadius : 0.8;
  return Math.min(0.62, Math.max(0.14, (safeRadius - 0.32) / 2.3));
}
