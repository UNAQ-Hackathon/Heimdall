import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { getPreviewTheme } from '../three/surface-preview.js';

const PlanetSurfacePreview = lazy(() => import('../three/PlanetSurfacePreview.jsx'));

export default function PlanetAnalysisPanel({ planet, zone, closing, onClose }) {
  const titleRef = useRef(null);
  const preview = getPreviewTheme(zone?.id, planet.id);
  const analyses = zone?.analyses ?? ['Material selection', 'Scenario comparison', 'Available study review'];
  const [analysis, setAnalysis] = useState(analyses[0]);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <aside className={`planet-analysis${closing ? ' planet-analysis--closing' : ''}`} aria-hidden={closing} inert={closing} aria-labelledby="planet-analysis-title" style={{ '--zone-color': zone?.color ?? preview.accent ?? preview.ground[0] }}>
      <div className="planet-analysis__topline">
        <span>ENVIRONMENT / PREVIEW</span>
        <button type="button" onClick={onClose} aria-label="Close panel and return to global view">Close ×</button>
      </div>
      <p className="planet-analysis__planet">{planet.label}</p>
      <h2 id="planet-analysis-title" ref={titleRef} tabIndex={-1}>{zone?.label ?? preview.title}</h2>
      <figure className="planet-surface">
        <div className="planet-surface__canvas" role="group" aria-label={`${planet.label}: ${preview.title}, conceptual 3D preview`}>
          <Suspense fallback={<p role="status">Preparing environment…</p>}>
            <PlanetSurfacePreview zoneId={zone?.id} planetId={planet.id} />
          </Suspense>
        </div>
        <figcaption>Conceptual low-poly scene · Drag to look around</figcaption>
      </figure>
      <p>{zone?.biomes ?? preview.description}</p>
      <div className="planet-analysis__notice">
        {zone
          ? 'Schematic bands, not mapped biomes. The scene is illustrative and does not reconstruct the selected location.'
          : 'Artistic environment, not a measured location or a physical simulation. Colors, scale and visibility are illustrative.'}
      </div>
      <fieldset className="planet-analysis__choices">
        <legend>Possible analysis routes</legend>
        {analyses.map((label) => (
          <label key={label}>
            <input type="radio" name="planet-analysis" value={label} checked={analysis === label} onChange={() => setAnalysis(label)} />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="planet-analysis__empty" role="status">
        <strong>No results calculated</strong>
        <p>Selected route: {analysis}. Validated data and the analysis engine are not connected yet. No simulation is running.</p>
      </div>
      <button className="planet-analysis__return" type="button" onClick={onClose}>Back to global view</button>
    </aside>
  );
}
