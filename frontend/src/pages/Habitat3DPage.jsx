import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  ISS_STATION_MODEL,
  PLANET_MODELS,
  getPlanetModel,
} from '../components/three/planet-catalog.js';
import { EARTH_ZONES } from '../components/three/planet-analysis.js';
import PlanetAnalysisPanel from '../components/ui/PlanetAnalysisPanel.jsx';
import HeimdallLogo from '../components/ui/HeimdallLogo.jsx';

const PlanetViewer = lazy(() => import('../components/three/PlanetViewer.jsx'));
const PlanetSurfacePreview = lazy(() => import('../components/three/PlanetSurfacePreview.jsx'));

export default function Habitat3DPage() {
  const [planetId, setPlanetId] = useState('earth');
  const [selection, setSelection] = useState(null);
  const [panelSelection, setPanelSelection] = useState(null);
  const selectionOrigin = useRef(null);
  const selectorRef = useRef(null);
  const planet = planetId === 'iss' ? ISS_STATION_MODEL : getPlanetModel(planetId);
  const zone = EARTH_ZONES.find(({ id }) => id === panelSelection?.zoneId);

  useEffect(() => {
    if (selection) {
      setPanelSelection(selection);
      return;
    }
    const timer = window.setTimeout(() => setPanelSelection(null), 450);
    return () => window.clearTimeout(timer);
  }, [selection]);

  const selectRegion = (region) => {
    if (!selection) selectionOrigin.current = document.activeElement;
    setSelection(region);
  };

  const closePanel = useCallback(() => {
    setSelection(null);
    const origin = selectionOrigin.current;
    if (origin?.isConnected && origin !== document.body) origin.focus({ preventScroll: true });
    else selectorRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!selection) return;
    const handleKey = (event) => {
      if (event.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selection, closePanel]);

  return (
    <section className="planet-preview">
      <div className="planet-preview__header">
        <div>
          <p className="planet-preview__eyebrow"><HeimdallLogo /> / EXPLORER</p>
          <h1>Planetary explorer</h1>
          <p className="planet-preview__muted">Navigation prototype · Illustrative models, not physical scale.</p>
        </div>
        <label className="planet-preview__selector">
          Model
          <select ref={selectorRef} value={planetId} onChange={(event) => { setSelection(null); setPanelSelection(null); setPlanetId(event.target.value); }}>
            {PLANET_MODELS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            <option value={ISS_STATION_MODEL.id}>{ISS_STATION_MODEL.label}</option>
          </select>
        </label>
      </div>
      <div className={`planet-preview__stage${selection ? ' planet-preview__stage--focused' : ''}`}>
        <Suspense fallback={<p role="status">Loading 3D viewer…</p>}>
          {planetId === 'iss' ? (
            <div className="planet-preview__viewport" style={{ height: 'clamp(420px, 70vh, 780px)' }}>
              <PlanetSurfacePreview planetId="iss" />
            </div>
          ) : (
            <PlanetViewer
              planetId={planetId}
              className="planet-preview__viewport"
              style={{ height: 'clamp(420px, 70vh, 780px)' }}
              spaceBackground
              autoRotate
              enableAnalysis
              selection={selection}
              onRegionSelect={selectRegion}
            />
          )}
        </Suspense>
        <div className="planet-preview__mode" aria-live="polite">
          {selection ? 'ENVIRONMENT INSPECTION' : 'GLOBAL VIEW / SELECT THE MODEL'}
        </div>
        {panelSelection && panelSelection.planetId === planetId && (
          <PlanetAnalysisPanel
            key={`${planetId}:${panelSelection.zoneId}`}
            planet={planet}
            zone={zone}
            closing={!selection}
            onClose={closePanel}
            onSelectPlanet={(nextId) => {
              setPlanetId(nextId);
              const nextSelection = { planetId: nextId, zoneId: null, point: null };
              setSelection(nextSelection);
              setPanelSelection(nextSelection);
            }}
          />
        )}
      </div>
      {planetId === 'earth' ? (
        <div className="planet-zones" role="group" aria-label="Select an illustrative Earth zone">
          {EARTH_ZONES.map(({ id, label, color }) => (
            <button
              type="button"
              key={id}
              style={{ '--zone-color': color }}
              aria-pressed={selection?.zoneId === id}
              onClick={() => selectRegion({ planetId, zoneId: id, point: null })}
            >
              <span aria-hidden="true" />{label}
            </button>
          ))}
          <p>Schematic climate bands, not actual biome boundaries.</p>
        </div>
      ) : (
        <button className="planet-preview__inspect" type="button" onClick={() => selectRegion({ planetId, zoneId: null, point: null })}>
          {planetId === 'iss' ? 'Board ISS · Inspect Telemetry' : 'Explore environment'}
        </button>
      )}
      <p className="planet-preview__hint">
        {selection ? 'Scroll or pinch to adjust the globe · Close or press Esc to return'
          : 'Drag to orbit · Scroll or pinch to zoom · Click the model to explore'}
      </p>
    </section>
  );
}
