import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPreviewTheme } from '../three/surface-preview.js';
import { EARTH_ZONES } from '../three/planet-analysis.js';
import { SCENARIOS, useApp } from '../../context/AppContext.jsx';

const PlanetSurfacePreview = lazy(() => import('../three/PlanetSurfacePreview.jsx'));

export default function PlanetAnalysisPanel({
  planet,
  zone,
  zoneId = 'temperate',
  onZoneChange,
  closing,
  onClose,
  onSelectPlanet,
  onOpenTestbench,
  minimized = false,
  onToggleMinimize,
}) {
  const titleRef = useRef(null);
  const appCtx = useApp();
  const [internalZoneId, setInternalZoneId] = useState(zone?.id ?? zoneId ?? 'temperate');

  const activeZoneId = onZoneChange ? zoneId : internalZoneId;
  const activeZone =
    planet.id === 'earth'
      ? EARTH_ZONES.find((z) => z.id === activeZoneId) ?? zone ?? EARTH_ZONES[2]
      : zone;

  const preview = getPreviewTheme(activeZone?.id, planet.id);

  // For Earth, allow switching between Earth (1g baseline), ISS / LEO (sub-option), and Spacesuit
  const [earthSubScenario, setEarthSubScenario] = useState(
    appCtx?.scenarioKey === 'iss' || appCtx?.scenarioKey === 'suit'
      ? appCtx.scenarioKey
      : 'earth'
  );

  const activeScenarioId =
    planet.id === 'earth' ? earthSubScenario : planet.scenarioId;

  const activeScenario = activeScenarioId ? SCENARIOS[activeScenarioId] : null;

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  const handleZoneClick = (nextZoneId) => {
    setInternalZoneId(nextZoneId);
    onZoneChange?.(nextZoneId);
  };

  const handleJump = (targetPlanetId) => {
    const targetName =
      targetPlanetId === 'iss'
        ? 'ISS'
        : targetPlanetId === 'moon'
          ? 'Moon'
          : 'Mars';
    if (appCtx?.setScenarioKey) {
      appCtx.setScenarioKey(targetPlanetId);
    }
    if (appCtx?.setFocusPlanet) {
      appCtx.setFocusPlanet(targetName);
    }
    if (onSelectPlanet) {
      onSelectPlanet(targetPlanetId);
    }
  };

  return (
    <aside
      className={`planet-analysis${closing ? ' planet-analysis--closing' : ''}`}
      aria-hidden={closing}
      inert={closing}
      aria-labelledby="planet-analysis-title"
      style={{
        '--zone-color': activeZone?.color ?? preview.accent ?? preview.ground[0],
      }}
    >
      {/* Top Bar */}
      <div
        className="planet-analysis__header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.01em',
              color: '#b7cbe4',
            }}
          >
            {planet.id === 'iss'
              ? `${planet.label} · Airlock & Module Interior`
              : `${planet.label} · Surface Preview`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onToggleMinimize && (
            <button
              type="button"
              className="mission-inspection__mobile-toggle"
              onClick={onToggleMinimize}
              aria-expanded={!minimized}
              aria-label={minimized ? 'Expand inspection panel' : 'Minimize inspection panel to view 3D planet'}
            >
              {minimized ? 'Panel ▴' : '3D ▾'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel and return to global view"
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              color: '#94a3b8',
              fontSize: '11px',
              padding: '3px 8px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Title */}
      <div className="planet-analysis__intro">
        {planet.classification && (
          <div className="planet-analysis__badge">{planet.classification}</div>
        )}
        <h2
          id="planet-analysis-title"
          ref={titleRef}
          tabIndex={-1}
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 800,
            color: '#f8fafc',
            outline: 'none',
          }}
        >
          {activeZone?.label ?? preview.title}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#afc2db', lineHeight: 1.55 }}>
          {activeZone?.biomes ?? planet.publicDescription ?? preview.description}
        </p>
      </div>

      {/* Interactive Earth Biome Selector (Tropical / Subtropical / Temperate / Polar) */}
      {planet.id === 'earth' && (
        <div className="earth-biome-selector" role="group" aria-labelledby="earth-biome-label">
          <span id="earth-biome-label" className="earth-biome-selector__label">Earth biome preview</span>
          <div className="earth-biome-selector__options">
            {EARTH_ZONES.map((z) => (
              <button
                key={z.id}
                type="button"
                className="earth-biome-selector__button"
                aria-pressed={activeZone?.id === z.id}
                onClick={() => handleZoneClick(z.id)}
              >
                {z.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3D Low-Poly Surface Preview Canvas */}
      <figure className="planet-analysis__preview" style={{ margin: 0 }}>
        <div
          className="planet-surface__canvas"
          role="group"
          aria-label={`${planet.label}: ${preview.title}, conceptual 3D preview`}
          style={{
            width: '100%',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
            background: '#070b14',
            position: 'relative',
          }}
        >
          <Suspense
            fallback={
              <div
                role="status"
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontFamily: 'var(--font-sans)',
                  color: '#64748b',
                }}
              >
                Loading 3D surface preview…
              </div>
            }
          >
            <PlanetSurfacePreview zoneId={activeZone?.id} planetId={planet.id} />
          </Suspense>
        </div>
        <figcaption
          style={{
            marginTop: '5px',
            fontSize: '10px',
            fontFamily: 'var(--font-sans)',
            color: '#64748b',
            textAlign: 'center',
          }}
        >
          <span className="planet-analysis__caption-desktop">
            {planet.id === 'iss'
              ? 'Interactive 3D ISS airlock & module interior · Drag to look around'
              : 'Interactive 3D low-poly landscape · Drag to look around'}
          </span>
          <span className="planet-analysis__caption-mobile">
            {planet.id === 'iss'
              ? '3D ISS airlock & module interior'
              : '3D low-poly landing preview'}
          </span>
        </figcaption>
      </figure>

      {/* Surface Gravity & Distance Pills */}
      <div
        className="planet-analysis__metrics"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '8px',
        }}
      >
        <div
          style={{
            padding: '8px 10px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <div style={{ color: '#64748b', fontSize: '9px' }}>
            {planet.id === 'iss' ? 'MICROGRAVITY REGIME' : 'SURFACE GRAVITY'}
          </div>
          <strong style={{ color: '#f8fafc', fontSize: '12px' }}>
            {planet.id === 'iss' ? '~0g (Free Fall LEO)' : `${planet.gravityG} g`}
          </strong>
        </div>
        <div
          style={{
            padding: '8px 10px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <div style={{ color: '#64748b', fontSize: '9px' }}>
            {planet.id === 'iss' ? 'ORBITAL ALTITUDE' : 'SOLAR DISTANCE'}
          </div>
          <strong style={{ color: '#f8fafc', fontSize: '12px' }}>
            {planet.distanceFromSun}
          </strong>
        </div>
      </div>

      <div className="planet-analysis__details" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Physical & Orbital Profile */}
        {(planet.diameterOrSpan || planet.orbitAndRotation || planet.temperature || planet.atmosphere || planet.satellitesOrModules) && (
          <div className="planet-profile-card">
            <div className="planet-profile-card__heading">
              {planet.id === 'iss' ? 'ORBITAL & STATION PROFILE' : 'PHYSICAL & ATMOSPHERIC PROFILE'}
            </div>
            <dl className="planet-profile-grid">
              {planet.diameterOrSpan && (
                <div className="planet-profile-item">
                  <dt>{planet.id === 'iss' ? 'SPAN & VOLUME' : 'DIAMETER'}</dt>
                  <dd>{planet.diameterOrSpan}</dd>
                </div>
              )}
              {planet.orbitAndRotation && (
                <div className="planet-profile-item">
                  <dt>{planet.id === 'iss' ? 'ORBITAL VELOCITY' : 'ORBIT & ROTATION'}</dt>
                  <dd>{planet.orbitAndRotation}</dd>
                </div>
              )}
              {planet.temperature && (
                <div className="planet-profile-item planet-profile-item--full">
                  <dt>THERMAL REGIME</dt>
                  <dd>{planet.temperature}</dd>
                </div>
              )}
              {planet.atmosphere && (
                <div className="planet-profile-item planet-profile-item--full">
                  <dt>{planet.id === 'iss' ? 'CABIN ATMOSPHERE (ECLSS)' : 'ATMOSPHERE / COMPOSITION'}</dt>
                  <dd>{planet.atmosphere}</dd>
                </div>
              )}
              {planet.satellitesOrModules && (
                <div className="planet-profile-item planet-profile-item--full">
                  <dt>{planet.id === 'iss' ? 'PRESSURIZED MODULES' : 'MOONS & STRUCTURE'}</dt>
                  <dd>{planet.satellitesOrModules}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Spacecraft Fire & Combustion Context + Key Highlights */}
        {(planet.combustionContext || (planet.highlights && planet.highlights.length > 0)) && (
          <div className="planet-profile-card">
            <div className="planet-profile-card__heading">
              SPACECRAFT FIRE &amp; PSI CONTEXT
            </div>
            {planet.combustionContext && (
              <p className="planet-profile-card__text">{planet.combustionContext}</p>
            )}
            {planet.highlights && planet.highlights.length > 0 && (
              <ul className="planet-profile-highlights">
                {planet.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {planet.featuredStudies && planet.featuredStudies.length > 0 && (
              <div className="planet-profile-studies">
                <span className="planet-profile-studies__label">Related PSI Studies</span>
                <div className="planet-profile-studies__chips">
                  {planet.featuredStudies.map((study) => (
                    <Link
                      key={study.id}
                      to={`/study/${study.id}`}
                      className="planet-profile-study-chip"
                    >
                      {study.label} ↗
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      {!planet.analyzable ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            fontSize: '11px',
            color: '#fde68a',
          }}
        >
          <strong style={{ color: '#fbbf24' }}>
            No crewed-habitat scenario — outside PSI scope
          </strong>
          <span style={{ color: '#cbd5e1', lineHeight: 1.4 }}>
            Spacecraft fire risk depends on a pressurized habitat&apos;s internal atmosphere and gravity.
          </span>
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleJump('iss')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(56, 189, 248, 0.2)',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                color: '#f8fafc',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Board ISS
            </button>
            <button
              type="button"
              onClick={() => handleJump('moon')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                color: '#f8fafc',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Jump to Moon
            </button>
            <button
              type="button"
              onClick={() => handleJump('mars')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid var(--border-subtle)',
                color: '#f8fafc',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Jump to Mars
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Earth Habitat Sub-Scenarios */}
          {planet.id === 'earth' && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-sans)',
                  color: '#64748b',
                  marginBottom: '6px',
                }}
              >
                HABITAT REGIME
              </div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {['earth', 'iss', 'suit'].map((key) => {
                  const s = SCENARIOS[key];
                  if (!s) return null;
                  const active = earthSubScenario === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key === 'iss') {
                          handleJump('iss');
                          return;
                        }
                        setEarthSubScenario(key);
                        appCtx?.setScenarioKey?.(key);
                      }}
                      style={{
                        flex: 1,
                        fontSize: '10.5px',
                        padding: '5px 6px',
                        borderRadius: '6px',
                        border: active
                          ? '1px solid rgba(59, 130, 246, 0.45)'
                          : '1px solid var(--border-subtle)',
                        background: active
                          ? 'rgba(59, 130, 246, 0.2)'
                          : 'rgba(10, 15, 29, 0.7)',
                        color: active ? '#f8fafc' : '#94a3b8',
                        cursor: 'pointer',
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Habitat Telemetry Summary */}
          {activeScenario && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11px',
                color: '#cbd5e1',
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  color: '#f8fafc',
                  marginBottom: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '4px 8px',
                }}
              >
                <span>{activeScenario.label}</span>
                <span style={{ color: '#38bdf8', fontFamily: 'var(--font-sans)' }}>
                  {activeScenario.oxygenDisplay} · {activeScenario.pressureDisplay}
                </span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '11px', lineHeight: 1.4 }}>
                {activeScenario.note}
              </div>
            </div>
          )}

          {onOpenTestbench && (
            <button
              type="button"
              onClick={onOpenTestbench}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.45)',
                color: '#60a5fa',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Run Fire Hazard Testbench</span>
              <span>→</span>
            </button>
          )}
        </div>
      )}
      </div>
        </>
      )}
    </aside>
  );
}
