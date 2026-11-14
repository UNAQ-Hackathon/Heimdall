import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useBounds } from '@react-three/drei';

import { EARTH_ZONES, getZoneDirection, getFocusView } from './planet-analysis.js';

export function EarthAnalysisZones({ selectedZoneId }) {
  return EARTH_ZONES.flatMap((zone) => [1, -1].map((hemisphere) => {
    const start = hemisphere > 0 ? 90 - zone.maxLatitude : 90 + zone.minLatitude;
    const length = zone.maxLatitude - zone.minLatitude;
    return (
      <mesh key={`${zone.id}:${hemisphere}`}>
        <sphereGeometry args={[1.012, 64, 24, 0, Math.PI * 2, start * Math.PI / 180, length * Math.PI / 180]} />
        <meshBasicMaterial
          color={zone.color}
          transparent
          opacity={selectedZoneId === zone.id ? 0.3 : 0.1}
          depthWrite={false}
        />
      </mesh>
    );
  }));
}

export function AnalysisFocus({ selection }) {
  const bounds = useBounds();
  const camera = useThree((state) => state.camera);
  const { width, height } = useThree((state) => state.size);

  useEffect(() => {
    if (!selection) {
      bounds.refresh().fit();
      return;
    }
    const point = selection.point ?? (selection.zoneId
      ? getZoneDirection(selection.zoneId, camera.position.toArray())
      : camera.position.toArray());
    bounds.refresh();
    const { position, target } = getFocusView(point, bounds.getSize().distance * 0.94);
    bounds.moveTo(position).lookAt({ target });
  }, [bounds, camera, selection, width, height]);

  return null;
}
