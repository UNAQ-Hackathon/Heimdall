import { PLANET_MODELS } from './planet-catalog.js';

export function getSolarPlanetId(modelPath) {
  const filename = typeof modelPath === 'string' ? modelPath.split('/').at(-1) : null;
  const model = PLANET_MODELS.find((entry) => entry.filename === filename);
  if (!model) throw new RangeError(`Unknown solar-system asset: ${modelPath}`);
  return model.id;
}
