export const EARTH_ZONES = Object.freeze([
  {
    id: 'tropical', label: 'Tropical zone', color: '#52d9aa', minLatitude: 0, maxLatitude: 23.5,
    biomes: 'Rainforests and savannas are examples only; this band also includes other ecosystems and oceans.',
    analyses: ['Humidity scenario comparison', 'Plant material selection', 'Combustion study review'],
  },
  {
    id: 'subtropical', label: 'Subtropical zone', color: '#e9bd75', minLatitude: 23.5, maxLatitude: 35,
    biomes: 'Deserts and shrublands are examples, not a classification of every point in this band.',
    analyses: ['Dry scenario comparison', 'Material and fuel selection', 'Experimental condition review'],
  },
  {
    id: 'temperate', label: 'Temperate zone', color: '#75aaff', minLatitude: 35, maxLatitude: 66.5,
    biomes: 'Temperate forests, grasslands and boreal forests are examples. These are not actual biome boundaries.',
    analyses: ['Seasonal scenario comparison', 'Forest material selection', 'Flame spread study review'],
  },
  {
    id: 'polar', label: 'Polar zone', color: '#c8deff', minLatitude: 66.5, maxLatitude: 90,
    biomes: 'Tundra and ice-covered regions are examples; their actual distribution requires geospatial data.',
    analyses: ['Low-temperature scenario comparison', 'Habitat material selection', 'Experimental condition review'],
  },
].map((zone) => Object.freeze({ ...zone, analyses: Object.freeze(zone.analyses) })));

function directionFrom(point) {
  if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) {
    throw new RangeError('A finite surface point is required');
  }
  const length = Math.hypot(...point);
  if (length === 0) throw new RangeError('A non-zero surface point is required');
  return point.map((value) => value / length);
}

export function getEarthZone(point) {
  const latitude = Math.asin(Math.min(1, Math.abs(directionFrom(point)[1]))) * 180 / Math.PI;
  return EARTH_ZONES.find(({ maxLatitude }) => latitude < maxLatitude) ?? EARTH_ZONES.at(-1);
}

export function getZoneDirection(zoneId, cameraPosition) {
  const zone = EARTH_ZONES.find(({ id }) => id === zoneId);
  if (!zone) throw new RangeError(`Unknown illustrative zone: ${zoneId}`);
  const [x, y, z] = directionFrom(cameraPosition);
  const horizontal = Math.hypot(x, z);
  const latitude = (zone.minLatitude + zone.maxLatitude) / 2 * Math.PI / 180;
  return [
    (horizontal > 1e-8 ? x / horizontal : 0) * Math.cos(latitude),
    Math.sin(latitude) * (y < 0 ? -1 : 1),
    (horizontal > 1e-8 ? z / horizontal : 1) * Math.cos(latitude),
  ];
}

export function getFocusView(point, distance = 2.55) {
  const direction = directionFrom(point);
  return { position: direction.map((value) => value * distance), target: [0, 0, 0] };
}
