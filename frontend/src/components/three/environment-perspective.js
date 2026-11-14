const VIEWS = {
  earth: { position: [0, 3.2, 8], target: [0, 2, -10], fov: 52, ambient: 1.1, light: [-8, 12, 6], fog: [18, 40] },
  mercury: { position: [0, 3.4, 12], target: [-2, 0, -22], fov: 48, ambient: 0.15, light: [-30, 9, 15], fog: null },
  venus: { position: [0, 3.8, 10], target: [0, 2, -32], fov: 50, ambient: 1.2, light: [-16, 24, 8], fog: [12, 85] },
  moon: { position: [1, 3, 11], target: [-3, -0.4, -22], fov: 48, ambient: 0.12, light: [-25, 10, 14], fog: null },
  mars: { position: [1, 3.8, 12], target: [-2, 2, -35], fov: 49, ambient: 0.45, light: [-22, 18, 6], fog: [65, 165] },
  jupiter: { position: [0, 12, 28], target: [-5, -2, -35], fov: 48, ambient: 1.25, light: [-25, 35, 12], fog: [100, 240] },
  saturn: { position: [0, 14, 30], target: [0, -2, -45], fov: 48, ambient: 1.2, light: [-20, 35, 12], fog: [90, 230] },
  uranus: { position: [0, 9, 24], target: [0, -1, -38], fov: 46, ambient: 1.35, light: [-20, 30, 15], fog: [50, 180] },
  neptune: { position: [0, 11, 26], target: [-3, -2, -40], fov: 48, ambient: 0.8, light: [-22, 30, 12], fog: [90, 230] },
  sun: { position: [0, 13, 26], target: [0, -4, -38], fov: 46, ambient: 0, light: [0, 30, 0], fog: null, emissive: true },
};

export function getEnvironmentPerspective(planetId) {
  if (!Object.hasOwn(VIEWS, planetId)) throw new RangeError(`Unknown environment perspective: ${planetId}`);
  return { near: 0.1, far: 420, ...VIEWS[planetId] };
}

function crater(x, z, centerX, centerZ, radius) {
  const distance = Math.hypot(x - centerX, z - centerZ) / radius;
  return -1.4 * Math.exp(-Math.pow(distance / 0.65, 4)) + 1.3 * Math.exp(-Math.pow((distance - 1) / 0.16, 2));
}

export function sampleEnvironmentHeight(x, z, planetId) {
  getEnvironmentPerspective(planetId);
  const smallRelief = Math.sin(x * 0.47 + Math.cos(z * 0.31)) * Math.cos(z * 0.35) * 0.13;
  if (planetId === 'earth') return 0.9;
  if (planetId === 'moon' || planetId === 'mercury') {
    return 0.8 + smallRelief - (x * x + z * z) * 0.00035
      + crater(x, z, -4, -18, 8) + crater(x, z, 18, -48, planetId === 'moon' ? 12 : 17);
  }
  if (planetId === 'mars') {
    const mesa = (Math.tanh((x + 14) / 3) - Math.tanh((x - 3) / 3)) / 2;
    const canyon = Math.exp(-Math.pow((x - 6 - Math.sin(z * 0.07) * 3) / 4, 2));
    return 1 + smallRelief + mesa * (1 + Math.tanh((-z - 30) / 6)) * 3.5 - canyon * 1.1;
  }
  if (planetId === 'venus') {
    return 1.2 + Math.sin(x * 0.08) * Math.cos(z * 0.06) * 1.1 + smallRelief
      + Math.max(0, -z - 20) / 35 * (1 + Math.sin(x * 0.09));
  }
  const curvature = (x * x + Math.pow(z + 30, 2)) / (planetId === 'sun' ? 450 : 650);
  if (planetId === 'sun') return -4 - curvature + Math.sin(x * 3.1) * Math.cos(z * 2.7) * 0.12;
  const amplitude = { jupiter: 1.3, saturn: 0.7, uranus: 0.3, neptune: 1.7 }[planetId];
  return -4 - curvature + Math.sin(z * 0.2 + Math.sin(x * 0.065) * 2) * amplitude
    + Math.sin(x * 0.31 + z * 0.4) * amplitude * 0.2;
}

export function createEnvironmentPatch(planetId, resolution = 128) {
  getEnvironmentPerspective(planetId);
  if (!Number.isInteger(resolution) || resolution < 2 || resolution > 256) throw new RangeError('Invalid patch resolution');
  const positions = new Float32Array((resolution + 1) ** 2 * 3);
  const tones = new Float32Array((resolution + 1) ** 2);
  const indices = new Uint32Array(resolution ** 2 * 6);
  for (let row = 0; row <= resolution; row += 1) {
    for (let column = 0; column <= resolution; column += 1) {
      const index = row * (resolution + 1) + column;
      const x = -110 + column / resolution * 220;
      const z = -180 + row / resolution * 240;
      positions.set([x, sampleEnvironmentHeight(x, z, planetId), z], index * 3);
      const rocky = ['mercury', 'venus', 'moon', 'mars'].includes(planetId);
      const grain = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
      const wave = planetId === 'sun'
        ? Math.sin(x * 2.7 + Math.cos(z * 3.3)) * Math.cos(z * 2.3)
        : rocky
          ? (grain - Math.floor(grain) - 0.5) * 1.3 + Math.sin(x * 0.13) * Math.cos(z * 0.17) * 0.3
          : Math.sin(z * 0.21 + Math.sin(x * 0.075) * 2 + Math.sin(x * 0.4 + z * 0.22) * 0.25);
      tones[index] = 0.5 + wave * (planetId === 'uranus' ? 0.15 : 0.5);
      if (row < resolution && column < resolution) {
        const next = index + resolution + 1;
        indices.set([index, next, index + 1, index + 1, next, next + 1], (row * resolution + column) * 6);
      }
    }
  }
  return { positions, tones, indices };
}
