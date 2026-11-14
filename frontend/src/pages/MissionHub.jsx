import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, SCENARIOS } from '../context/AppContext.jsx';
import { PLANETS, rankInvestigations } from '../services/mockData.js';
import SolarSystemScene, { SHIP_CATALOG } from '../components/three/SolarSystemScene.jsx';
import MissionPlanetInspection from '../components/ui/MissionPlanetInspection.jsx';
import '../styles/mission-hub.css';

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'prevention', label: 'Prevention & Flammability' },
  { id: 'suppression', label: 'Extinction & Suppression' },
  { id: 'detection', label: 'Detection & Diagnostics' },
];

const SCENARIO_PLANET_MAP = {
  iss: 'Earth',
  lunarBase: 'Moon',
  rover: 'Moon',
  spacesuit: 'Earth',
  mars: 'Mars',
};

export default function MissionHub() {
  const navigate = useNavigate();
  const {
    scenarioKey,
    setScenarioKey,
    scenario,
    audience,
    category,
    setCategory,
    weights,
    setWeights,
    focusPlanet,
    setFocusPlanet,
    chatOpen,
    setChatOpen,
  } = useApp();

  const [orbitPaused, setOrbitPaused] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [selectedShip, setSelectedShip] = useState(
    SHIP_CATALOG[0]?.id || 'Nave_Azul_LowPoly.glb'
  );

  const focusedPlanet = useMemo(
    () => (focusPlanet ? PLANETS.find((p) => p.name === focusPlanet) : null),
    [focusPlanet]
  );

  const rankedStudies = useMemo(
    () => rankInvestigations(scenarioKey, weights, category),
    [scenarioKey, weights, category]
  );

  const handleScenarioChange = (key) => {
    setScenarioKey(key);
    const mappedPlanet = SCENARIO_PLANET_MAP[key];
    if (mappedPlanet !== undefined) {
      setFocusPlanet(mappedPlanet);
    }
  };

  return (
    <div className="mission-hub">
      {/* Left Sidebar: Clean Minimalist NASA Mission Panel */}
      {!panelCollapsed && (
        <aside className="mission-sidebar">
          {/* Header & Telemetry Badges */}
          <div
            style={{
              padding: '20px 22px 16px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#38bdf8',
                  letterSpacing: '0.08em',
                }}
              >
                NASA PSI · {scenario.sysId}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: '#64748b',
                }}
              >
                {rankedStudies.length} studies
              </span>
            </div>

            <h1
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#f8fafc',
                letterSpacing: '-0.02em',
                marginBottom: '12px',
              }}
            >
              {scenario.label}
            </h1>

            {/* Clean Environment Telemetry Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span className="tri-pill">
                <span style={{ color: '#64748b' }}>Gravity</span>
                <strong style={{ color: '#e2e8f0' }}>{scenario.gravity}</strong>
              </span>
              <span className="tri-pill">
                <span style={{ color: '#64748b' }}>Pressure</span>
                <strong style={{ color: '#e2e8f0' }}>{scenario.pressurePsi} psi</strong>
              </span>
              <span
                className="tri-pill"
                style={{
                  borderColor:
                    scenario.oxygenPct > 25
                      ? 'rgba(239, 68, 68, 0.35)'
                      : 'var(--border-subtle)',
                  background:
                    scenario.oxygenPct > 25
                      ? 'rgba(239, 68, 68, 0.1)'
                      : 'rgba(15, 23, 42, 0.75)',
                }}
              >
                <span style={{ color: '#94a3b8' }}>O₂</span>
                <strong
                  style={{
                    color: scenario.oxygenPct > 25 ? '#f87171' : '#34d399',
                  }}
                >
                  {scenario.oxygenPct}%
                </strong>
              </span>
            </div>
          </div>

          {/* Clean Dropdown Filters */}
          <div
            style={{
              padding: '14px 22px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: 'rgba(15, 23, 42, 0.35)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr auto',
                gap: '8px',
                alignItems: 'end',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: '#64748b',
                    marginBottom: '5px',
                    letterSpacing: '0.05em',
                  }}
                >
                  SCENARIO
                </label>
                <select
                  value={scenarioKey}
                  onChange={(e) => handleScenarioChange(e.target.value)}
                  className="tri-select"
                  style={{ width: '100%' }}
                >
                  {Object.entries(SCENARIOS).map(([key, sc]) => (
                    <option key={key} value={key} style={{ background: '#0f172a' }}>
                      {sc.label} ({sc.oxygenPct}% O₂)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: '#64748b',
                    marginBottom: '5px',
                    letterSpacing: '0.05em',
                  }}
                >
                  CATEGORY
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="tri-select"
                  style={{ width: '100%' }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id} style={{ background: '#0f172a' }}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowWeights(!showWeights)}
                title="Ranking weights"
                style={{
                  height: '33px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: showWeights
                    ? '1px solid rgba(59, 130, 246, 0.5)'
                    : '1px solid var(--border-subtle)',
                  background: showWeights
                    ? 'rgba(59, 130, 246, 0.16)'
                    : 'rgba(15, 23, 42, 0.85)',
                  color: showWeights ? '#60a5fa' : '#94a3b8',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                }}
              >
                Weights
              </button>
            </div>

            {showWeights && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(5, 8, 17, 0.65)',
                  border: '1px solid var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                }}
              >
                {[
                  { key: 'oxygenConc', label: 'O₂ Concentration' },
                  { key: 'pressure', label: 'Ambient Pressure' },
                  { key: 'airflow', label: 'Ventilation Flow' },
                  { key: 'fuelType', label: 'Fuel Geometry' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        color: '#94a3b8',
                        marginBottom: '4px',
                      }}
                    >
                      <span>{label}</span>
                      <span style={{ color: '#38bdf8' }}>{weights[key] ?? 20}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={weights[key] ?? 20}
                      onChange={(e) =>
                        setWeights((prev) => ({
                          ...prev,
                          [key]: Number(e.target.value),
                        }))
                      }
                      style={{
                        width: '100%',
                        accentColor: '#3b82f6',
                        height: '4px',
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ranked Studies Feed */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {rankedStudies.map((study) => {
              const summaryText =
                audience === 'Student'
                  ? study.aiSummary?.student
                  : study.aiSummary?.engineer;

              return (
                <div
                  key={study.id}
                  onClick={() => navigate(`/study/${study.id}`)}
                  className="tri-card"
                  style={{
                    padding: '16px',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: '#f8fafc',
                        }}
                      >
                        {study.name}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color: '#64748b',
                        }}
                      >
                        {study.facility}
                      </span>
                    </div>

                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: study.matchScore >= 85 ? '#34d399' : '#60a5fa',
                        background:
                          study.matchScore >= 85
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'rgba(59, 130, 246, 0.12)',
                        border:
                          study.matchScore >= 85
                            ? '1px solid rgba(16, 185, 129, 0.28)'
                            : '1px solid rgba(59, 130, 246, 0.28)',
                      }}
                    >
                      {study.matchScore}% match
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: '#94a3b8',
                      marginBottom: '10px',
                    }}
                  >
                    <span>{study.oxygenRange}</span>
                    <span style={{ color: '#475569' }}>·</span>
                    <span>{study.ambientPressure}</span>
                    <span style={{ color: '#475569' }}>·</span>
                    <span style={{ color: '#cbd5e1' }}>{study.fuelGeometry}</span>
                  </div>

                  <p
                    style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      lineHeight: 1.5,
                      marginBottom: '12px',
                    }}
                  >
                    {summaryText || study.description}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '10px',
                      borderTop: '1px solid rgba(148, 163, 184, 0.08)',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <span style={{ color: '#64748b' }}>
                      {study.runsArchived} flight runs
                    </span>
                    <span style={{ color: '#60a5fa', fontWeight: 500 }}>
                      Inspect study →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {/* Right 3D Solar System Viewport */}
      <section className="mission-viewport">
        <div className="mission-stage">
          <SolarSystemScene
            paused={orbitPaused}
            panelCollapsed={panelCollapsed}
            shipFile={selectedShip}
          />

          {/* Sidebar Collapse Toggle Button */}
          <button
            type="button"
            onClick={() => setPanelCollapsed(!panelCollapsed)}
            title={panelCollapsed ? 'Show Mission Panel' : 'Hide Mission Panel'}
            style={{
              position: 'absolute',
              left: '16px',
              bottom: '20px',
              zIndex: 20,
              padding: '7px 12px',
              borderRadius: '8px',
              background: 'rgba(10, 15, 29, 0.85)',
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--border-subtle)',
              color: '#94a3b8',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
            }}
          >
            {panelCollapsed ? 'Show Panel' : 'Hide Panel'}
          </button>

          {/* Top Floating HUD Bar */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '20px',
              right: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              pointerEvents: 'none',
              zIndex: 15,
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            {/* Orbit Target + Spacecraft Selectors */}
            <div
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(10, 15, 29, 0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '6px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: '#64748b',
                    letterSpacing: '0.06em',
                  }}
                >
                  TARGET
                </span>
                <select
                  aria-label="Planet to explore"
                  value={focusPlanet || ''}
                  onChange={(e) => setFocusPlanet(e.target.value || null)}
                  className="tri-select"
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    padding: '3px 24px 3px 4px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  <option value="" style={{ background: '#0f172a' }}>
                    Solar System Overview
                  </option>
                  {PLANETS.filter((p) => p.name !== 'Sol').map((p) => (
                    <option key={p.name} value={p.name} style={{ background: '#0f172a' }}>
                      {p.name} ({p.au})
                    </option>
                  ))}
                </select>
              </div>

              <span
                style={{
                  width: '1px',
                  height: '16px',
                  background: 'var(--border-subtle)',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: '#64748b',
                    letterSpacing: '0.06em',
                  }}
                >
                  CRAFT
                </span>
                <select
                  aria-label="Spacecraft model"
                  value={selectedShip}
                  onChange={(e) => setSelectedShip(e.target.value)}
                  className="tri-select"
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    padding: '3px 24px 3px 4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#38bdf8',
                  }}
                >
                  {SHIP_CATALOG.map((ship) => (
                    <option key={ship.id} value={ship.id} style={{ background: '#0f172a' }}>
                      {ship.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Playback & Camera Controls */}
            <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
              <button
                type="button"
                onClick={() => setOrbitPaused((p) => !p)}
                style={{
                  padding: '7px 13px',
                  borderRadius: '8px',
                  background: orbitPaused
                    ? 'rgba(245, 158, 11, 0.16)'
                    : 'rgba(10, 15, 29, 0.85)',
                  backdropFilter: 'blur(12px)',
                  border: orbitPaused
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : '1px solid var(--border-subtle)',
                  color: orbitPaused ? '#fbbf24' : '#e2e8f0',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                }}
              >
                {orbitPaused ? 'Resume Orbit' : 'Pause Orbit'}
              </button>

              {focusPlanet && (
                <button
                  type="button"
                  onClick={() => setFocusPlanet(null)}
                  style={{
                    padding: '7px 13px',
                    borderRadius: '8px',
                    background: 'rgba(10, 15, 29, 0.85)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid var(--border-subtle)',
                    color: '#60a5fa',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                  }}
                >
                  Reset View
                </button>
              )}
            </div>
          </div>

          {/* Floating AI Copilot Quick Button */}
          {!chatOpen && !focusedPlanet && (
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                zIndex: 15,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '9999px',
                background: 'rgba(15, 23, 42, 0.9)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                color: '#f8fafc',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#fc3d21',
                }}
              />
              Ask Heimdall Copilot
            </button>
          )}
        </div>

        {focusedPlanet && (
          <MissionPlanetInspection
            body={focusedPlanet}
            onClose={() => setFocusPlanet(null)}
          />
        )}
      </section>
    </div>
  );
}
