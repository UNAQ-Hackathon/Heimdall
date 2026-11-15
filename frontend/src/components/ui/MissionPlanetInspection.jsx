import { useEffect, useState } from 'react';
import { getPlanetModel, ISS_STATION_MODEL } from '../three/planet-catalog.js';
import { getSolarPlanetId } from '../three/solar-system-model.js';
import { EARTH_ZONES } from '../three/planet-analysis.js';
import PlanetAnalysisPanel from './PlanetAnalysisPanel.jsx';

export default function MissionPlanetInspection({
  body,
  onClose,
  onOpenTestbench,
}) {
  const [zoneId, setZoneId] = useState('temperate');
  const planet =
    body.name === 'ISS'
      ? ISS_STATION_MODEL
      : getPlanetModel(getSolarPlanetId(body.model));
  const zone =
    planet.id === 'earth'
      ? EARTH_ZONES.find(({ id }) => id === zoneId) ?? EARTH_ZONES[2]
      : undefined;

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <section
      className="mission-inspection"
      aria-label={`${planet.label} environment inspection`}
    >
      <PlanetAnalysisPanel
        key={`${planet.id}:${zoneId}`}
        planet={planet}
        zone={zone}
        zoneId={zoneId}
        onZoneChange={setZoneId}
        onClose={onClose}
        onOpenTestbench={onOpenTestbench}
      />
    </section>
  );
}
