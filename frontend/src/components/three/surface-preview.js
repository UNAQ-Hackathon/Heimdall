const EARTH_THEMES = {
  tropical: { title: 'Tropical landscape', sky: '#9bc5bd', ground: ['#65994c', '#558440', '#7b9e55'], foliage: '#39744c', trunk: '#70543a', plant: 'tree' },
  subtropical: { title: 'Subtropical landscape', sky: '#b9c8cf', ground: ['#d1af73', '#bd985f', '#dfbd83'], foliage: '#6a8650', trunk: '#6a8650', plant: 'cactus' },
  temperate: { title: 'Temperate landscape', sky: '#a6bdd0', ground: ['#809554', '#6f884c', '#93a365'], foliage: '#4e7050', trunk: '#765b40', plant: 'pine' },
  polar: { title: 'Polar landscape', sky: '#a8c2d3', ground: ['#d2e0dd', '#b9ced1', '#e5e9dc'], rock: '#9bb7c4' },
};

const BODY_THEMES = {
  mercury: { kind: 'surface', title: 'Cratered horizon', sky: '#111321', ground: ['#8d8274', '#a39786', '#766c63'], rock: '#6d6259', craters: true, description: 'A stylized rocky horizon with angular ridges and crater-like forms.' },
  venus: { kind: 'surface', title: 'Ochre lowlands', sky: '#a18b55', ground: ['#aa8452', '#bd9860', '#8f6a43'], rock: '#76583c', haze: true, description: 'An artistic ochre landscape and muted sky, not a reconstruction of a measured location.' },
  moon: { kind: 'surface', title: 'Lunar horizon', sky: '#0b1020', ground: ['#969a9c', '#b1b2ad', '#797f86'], rock: '#696f76', craters: true, description: 'A conceptual lunar scene with pale terrain, craters and a dark sky.' },
  mars: { kind: 'surface', title: 'Rust-red mesas', sky: '#ba9583', ground: ['#ae6145', '#c17b53', '#8d4b3b'], rock: '#784436', description: 'A stylized red-rock landscape with stepped mesas and scattered boulders.' },
  jupiter: { kind: 'atmosphere', title: 'Banded cloudscape', sky: '#bda48b', ground: ['#d7bea0', '#b38362', '#e8d4b6'], accent: '#aa5d44', description: 'An artistic view through warm cloud bands. No solid ground is depicted.' },
  saturn: { kind: 'atmosphere', title: 'Golden cloudscape', sky: '#bcae86', ground: ['#d9c899', '#b6a071', '#ece0b9'], accent: '#a78b5f', description: 'A conceptual golden atmosphere with a decorative ring arc. No solid ground is depicted.' },
  uranus: { kind: 'atmosphere', title: 'Cyan cloud layers', sky: '#80b9bd', ground: ['#a6d4cf', '#73adb7', '#c0e1d6'], accent: '#5896a6', description: 'A stylized cyan atmospheric scene. Shapes and visibility are illustrative; there is no solid ground.' },
  neptune: { kind: 'atmosphere', title: 'Deep-blue cloud layers', sky: '#253e77', ground: ['#3868a8', '#588cbd', '#244d91'], accent: '#a0c8d6', description: 'An artistic deep-blue atmosphere with angular cloud forms. No solid ground is depicted.' },
  sun: { kind: 'plasma', title: 'Solar plasma', sky: '#120b16', ground: ['#bc3c15', '#f28b28', '#ffd266'], accent: '#ffcf69', description: 'A conceptual view above a curved emitting plasma layer, with bright granulation and rising prominence loops. Not solid ground or a physical simulation.' },
};

export function getPreviewTheme(zoneId, planetId = 'earth') {
  const theme = planetId === 'earth' ? EARTH_THEMES[zoneId] : BODY_THEMES[planetId];
  if (!theme) throw new RangeError(`No conceptual environment for ${planetId}:${zoneId}`);
  return {
    kind: 'surface', plant: null, clouds: planetId === 'earth',
    description: 'A conceptual landscape, not a reconstruction of the selected point or a verified biome map.',
    ...theme,
  };
}

const noise = (x, z) => {
  const value = Math.sin(x * 127.1 + z * 311.7 + 41.3) * 43758.5453;
  return value - Math.floor(value);
};

export function createSurfacePreview(zoneId, planetId = 'earth') {
  const theme = getPreviewTheme(zoneId, planetId);
  const tiles = [];
  const plants = [];
  const rocks = [];
  if (theme.kind !== 'surface') return { ...theme, tiles, plants, rocks };
  for (let row = 0; row < 24; row += 1) {
    for (let column = 0; column < 24; column += 1) {
      const x = (column - 11.5) * 2;
      const z = (row - 11.5) * 2;
      const ridge = Math.max(0, -z / 8) * (0.7 + 0.45 * Math.sin(x * 0.2));
      const craterDistance = Math.hypot(x + 3, z + 10);
      const crater = theme.craters ? (craterDistance < 5 ? -0.8 : craterDistance < 7 ? 0.6 : 0) : 0;
      const height = Math.max(0.3, 0.9 + Math.round((ridge + crater + noise(column, row) * 0.25) / 0.3) * 0.3);
      tiles.push({ x, z, height, color: theme.ground[Math.floor(noise(column + 20, row) * theme.ground.length)] });
      const feature = noise(column, row + 50);
      const inView = Math.abs(x) < 17 && z < 5 && z > -20;
      if (theme.plant && feature > 0.93 && inView) {
        plants.push({ x, y: height, z, scale: 1 + noise(column + 80, row) * 0.7 });
      } else if (theme.rock && feature > 0.91 && inView) {
        rocks.push({ x, y: height, z, scale: 0.4 + noise(column + 80, row) * 1.1 });
      }
    }
  }
  return { ...theme, tiles, plants, rocks };
}
