import { useEffect, useRef, useState } from 'react';
import { getPlanetModel, ISS_STATION_MODEL } from '../three/planet-catalog.js';
import { getSolarPlanetId } from '../three/solar-system-model.js';
import { EARTH_ZONES } from '../three/planet-analysis.js';
import { useSound } from '../../context/SoundContext.jsx';
import PlanetAnalysisPanel from './PlanetAnalysisPanel.jsx';

export default function MissionPlanetInspection({
  body,
  onClose,
  onOpenTestbench,
  minimized = false,
  onToggleMinimize,
}) {
  const sfx = useSound();
  const [zoneId, setZoneId] = useState('temperate');
  const openedRef = useRef(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    if (sectionRef.current) {
      sectionRef.current.scrollTop = 0;
    }
  }, [body.name]);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    sfx?.play('panel-whoosh');
  }, [sfx]);
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
      ref={sectionRef}
      className={`mission-inspection${minimized ? ' mission-inspection--minimized' : ''}`}
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
        minimized={minimized}
        onToggleMinimize={onToggleMinimize}
      />
    </section>
  );
}
