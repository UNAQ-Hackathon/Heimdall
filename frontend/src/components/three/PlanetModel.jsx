import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';

import { getPlanetModel } from './planet-catalog.js';
import { getPlanetUrl } from './planet-assets.js';
import { normalizeModel } from './normalize-model.js';

export default function PlanetModel({ planetId, onLoad }) {
  const { scene } = useGLTF(getPlanetUrl(planetId), false, false);
  const model = useMemo(() => normalizeModel(scene), [scene]);

  useEffect(() => {
    onLoad?.(getPlanetModel(planetId));
  }, [planetId, model, onLoad]);

  return <primitive object={model} dispose={null} />;
}
