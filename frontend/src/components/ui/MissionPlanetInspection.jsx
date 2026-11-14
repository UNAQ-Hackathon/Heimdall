import { useEffect, useState } from 'react';
import { getPlanetModel } from '../three/planet-catalog.js';
import { getSolarPlanetId } from '../three/solar-system-model.js';
import { EARTH_ZONES } from '../three/planet-analysis.js';
import PlanetAnalysisPanel from './PlanetAnalysisPanel.jsx';

export default function MissionPlanetInspection({ body, onClose }) {
  const [zoneId, setZoneId] = useState('temperate');
  const planet = getPlanetModel(getSolarPlanetId(body.model));
  const zone = planet.id === 'earth' ? EARTH_ZONES.find(({ id }) => id === zoneId) : undefined;

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <section className="mission-inspection" aria-label={`${planet.label} environment inspection`}>
      {planet.id === 'earth' && (
        <label className="mission-inspection__zone">
          Earth zone
          <select className="tri-select" value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
            {EARTH_ZONES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      )}
      <PlanetAnalysisPanel key={`${planet.id}:${zoneId}`} planet={planet} zone={zone} onClose={onClose} />
    </section>
  );
}
