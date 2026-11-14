export const PLANET_MODELS = Object.freeze([
  { id: 'mercury', label: 'Mercury', filename: 'Mercurio.glb' },
  { id: 'venus', label: 'Venus', filename: 'Venus.glb' },
  { id: 'earth', label: 'Earth', filename: 'Tierra.glb' },
  { id: 'moon', label: 'Moon', filename: 'Luna.glb' },
  { id: 'mars', label: 'Mars', filename: 'Marte.glb' },
  { id: 'jupiter', label: 'Jupiter', filename: 'Jupiter.glb' },
  { id: 'saturn', label: 'Saturn', filename: 'Saturno.glb' },
  { id: 'uranus', label: 'Uranus', filename: 'Urano.glb' },
  { id: 'neptune', label: 'Neptune', filename: 'Neptuno.glb' },
  { id: 'sun', label: 'Sun', filename: 'Sol.glb' },
].map(Object.freeze));

export function getPlanetModel(id) {
  const model = PLANET_MODELS.find((entry) => entry.id === id);
  if (!model) throw new RangeError(`Unknown planetary model: ${id}`);
  return model;
}
