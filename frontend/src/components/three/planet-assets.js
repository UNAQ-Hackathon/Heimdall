import { useGLTF } from '@react-three/drei';
import { getPlanetModel } from './planet-catalog.js';

const urls = import.meta.glob('../../../../assets3d/planetas/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

export function getPlanetUrl(id) {
  const { filename } = getPlanetModel(id);
  const url = urls[`../../../../assets3d/planetas/${filename}`];
  if (!url) throw new Error(`Missing planetary asset: ${filename}`);
  return url;
}

export function preloadPlanet(id) {
  useGLTF.preload(getPlanetUrl(id), false, false);
}
