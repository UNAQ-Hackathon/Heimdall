import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MissionPlanetInspection from '../components/ui/MissionPlanetInspection.jsx';
import FireHazRPage from './FireHazRPage.jsx';
import SolarSystemScene, { SHIP_CATALOG } from '../components/three/SolarSystemScene.jsx';
import { SCENARIOS, useApp } from '../context/AppContext.jsx';
import { api } from '../services/api.js';
import { FACTOR_LABELS, rankLocalInvestigations } from '../services/ranking.js';
import { PLANETS } from '../services/mockData.js';
import '../styles/mission-hub.css';

const SCENARIO_TO_PLANET = {
  earth: 'Earth',
  iss: 'Earth',
  moon: 'Moon',
  mars: 'Mars',
  suit: 'Earth',
};

const FACTOR_COLORS = {
  atmosphereMatch: '#38bdf8',
  gravityMatch: '#a78bfa',
  dataRichness: '#34d399',
  documentation: '#fbbf24',
};

export default function MissionHub() {
  const {
    scenarioKey,
    setScenarioKey,
    scenario,
    audience,
    category,
    setCategory,
    focusPlanet,
    setFocusPlanet,
    weights,
    setWeights,
    chatOpen,
    setChatOpen,
  } = useApp();

  const [searchParams] = useSearchParams();
  const [paused, setPaused] = useState(false);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState(
    () => (searchParams.get('tab') === 'whatif' ? 'whatif' : 'ranking')
  );
  const [shipFile, setShipFile] = useState('Nave_Azul_LowPoly.glb');
  const navigate = useNavigate();
  const targetRef = useRef(null);

  useEffect(() => {
    const qPlanet = searchParams.get('planet');
    if (qPlanet) setFocusPlanet(qPlanet);
    const qScenario = searchParams.get('scenario');
    if (qScenario) setScenarioKey(qScenario);
  }, [searchParams, setFocusPlanet, setScenarioKey]);

  const closeInspection = useCallback(() => {
    setFocusPlanet(null);
    targetRef.current?.focus({ preventScroll: true });
  }, [setFocusPlanet]);

  // Synchronous initial/fallback ranking from processed PSI dataset
  const localRanked = useMemo(
    () => rankLocalInvestigations({ ...scenario, category }, weights),
    [scenario, category, weights]
  );

  const [rankedItems, setRankedItems] = useState(localRanked);
  const [rankSource, setRankSource] = useState('local-processed');

  useEffect(() => {
    setRankedItems(localRanked);
    let cancelled = false;
    api.rank({ ...scenario, category }, weights).then((res) => {
      if (!cancelled && Array.isArray(res?.results)) {
        setRankedItems(res.results);
        setRankSource(res.source ?? 'api');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scenario, category, weights, localRanked]);

  const activePlanetObj = useMemo(
    () => PLANETS.find((p) => p.name === focusPlanet) ?? null,
    [focusPlanet]
  );

  const handleScenarioChange = (nextKey) => {
    setScenarioKey(nextKey);
    const targetBody = SCENARIO_TO_PLANET[nextKey];
    if (targetBody) setFocusPlanet(targetBody);
  };

  return (
    <div className="mission-hub">
      {/* Left Analytical Panel (Ranking + Breakdown + What-If Testbench) */}
      {!panelCollapsed && (
        <aside
          style={{
            width: '440px',
            minWidth: '440px',
            height: '100%',
            overflowY: 'auto',
            padding: '20px 22px',
            borderRight: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-panel)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            zIndex: 25,
          }}
        >
          {/* NASA Mission Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#64748b',
                letterSpacing: '0.08em',
              }}
            >
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                NASA PSI · {scenario.sysId}
              </span>
              <span>
                {scenario.partialGravity ? 'BOUNDED: MICRO-G ↔ 1G' : rankSource.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h1
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#f8fafc',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                {scenario.label}
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: '#94a3b8',
                }}
              >
                {rankedItems.length} PSI studies
              </span>
            </div>

            {/* Habitat Environment Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
              <span className="tri-pill">
                <span style={{ color: '#64748b' }}>Gravity</span>
                <strong style={{ color: '#e2e8f0' }}>
                  {scenario.gravityDisplay ?? scenario.gravity}
                </strong>
              </span>
              <span className="tri-pill">
                <span style={{ color: '#64748b' }}>Pressure</span>
                <strong style={{ color: '#e2e8f0' }}>
                  {scenario.pressureDisplay ?? `${scenario.pressurePsi} psi`}
                </strong>
              </span>
              <span
                className="tri-pill"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderColor: 'rgba(239, 68, 68, 0.32)',
                }}
              >
                <span style={{ color: '#94a3b8' }}>O₂</span>
                <strong style={{ color: '#fca5a5' }}>
                  {scenario.oxygenDisplay ?? `${scenario.oxygenPct}%`}
                </strong>
              </span>
            </div>

            {/* Mars Assumed Badge */}
            {scenario.assumedAtmosphere && (
              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#7dd3fc',
                  padding: '6px 10px',
                  borderRadius: '8px',
                }}
              >
                Mars habitat atmosphere (30% O₂, 10.2 psi): <strong>assumed, same as lunar</strong>.
              </div>
            )}

            {/* Partial Gravity Scientific Notice (Moon & Mars) */}
            {scenario.partialGravity && (
              <div
                style={{
                  fontSize: '11px',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.24)',
                  color: '#fde68a',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  lineHeight: 1.45,
                }}
              >
                <strong style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
                  PARTIAL-G BOUND (micro-g ↔ 1g):{' '}
                </strong>
                PSI has no direct {scenario.gravityG}g data; results are bounded between microgravity and 1g.{' '}
                <strong>E-FIELD Flames (ACME)</strong> acts as a partial-gravity proxy;{' '}
                <strong>CFI-G (ACME)</strong> tested up to 85% O₂.
              </div>
            )}

            {/* Earth / ISS sub-options when Earth or ISS is active */}
            {(scenarioKey === 'earth' || scenarioKey === 'iss') &&
              SCENARIOS.earth &&
              SCENARIOS.iss && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#64748b' }}>Regime:</span>
                  {['earth', 'iss'].map((subKey) => (
                    <button
                      key={subKey}
                      type="button"
                      onClick={() => handleScenarioChange(subKey)}
                      style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border:
                          scenarioKey === subKey
                            ? '1px solid rgba(59, 130, 246, 0.45)'
                            : '1px solid var(--border-subtle)',
                        background:
                          scenarioKey === subKey
                            ? 'rgba(59, 130, 246, 0.18)'
                            : 'rgba(15, 23, 42, 0.7)',
                        color: scenarioKey === subKey ? '#f8fafc' : '#94a3b8',
                        cursor: 'pointer',
                      }}
                    >
                      {SCENARIOS[subKey].label}
                    </button>
                  ))}
                </div>
              )}
          </div>

          {/* Mode Switcher: Ranked PSI Studies vs What-If Testbench */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              padding: '4px',
              borderRadius: '10px',
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('ranking')}
              style={{
                padding: '8px 10px',
                borderRadius: '7px',
                fontSize: '12px',
                fontWeight: 600,
                background:
                  activeTab === 'ranking' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border:
                  activeTab === 'ranking'
                    ? '1px solid rgba(59, 130, 246, 0.4)'
                    : '1px solid transparent',
                color: activeTab === 'ranking' ? '#f8fafc' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              PSI Studies
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('whatif')}
              style={{
                padding: '8px 10px',
                borderRadius: '7px',
                fontSize: '12px',
                fontWeight: 600,
                background:
                  activeTab === 'whatif' ? 'rgba(245, 158, 11, 0.18)' : 'transparent',
                border:
                  activeTab === 'whatif'
                    ? '1px solid rgba(245, 158, 11, 0.45)'
                    : '1px solid transparent',
                color: activeTab === 'whatif' ? '#fbbf24' : '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#f59e0b',
                }}
              />
              Fire Hazard Testbench
            </button>
          </div>

          {/* Scenario & Category Filters + Weights Drawer */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 0.9fr auto',
              gap: '8px',
              alignItems: 'end',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: '#64748b',
                  letterSpacing: '0.05em',
                }}
              >
                MISSION SCENARIO
              </span>
              <select
                aria-label="Mission Scenario"
                className="tri-select"
                value={scenarioKey}
                onChange={(e) => handleScenarioChange(e.target.value)}
                style={{ width: '100%' }}
              >
                {Object.entries(SCENARIOS).map(([key, s]) => (
                  <option key={s.id ?? key} value={s.id ?? key} style={{ background: '#0f172a' }}>
                    {s.label} ({s.oxygenDisplay ?? `${s.oxygenPct}% O₂`})
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: '#64748b',
                  letterSpacing: '0.05em',
                }}
              >
                CATEGORY
              </span>
              <select
                aria-label="Category Filter"
                className="tri-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="all" style={{ background: '#0f172a' }}>
                  All Categories
                </option>
                <option value="prevention" style={{ background: '#0f172a' }}>
                  Prevention
                </option>
                <option value="detection" style={{ background: '#0f172a' }}>
                  Detection
                </option>
                <option value="suppression" style={{ background: '#0f172a' }}>
                  Suppression
                </option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => setWeightsOpen(!weightsOpen)}
              title="Adjust ranking weights"
              style={{
                height: '33px',
                padding: '0 11px',
                borderRadius: '8px',
                background: weightsOpen
                  ? 'rgba(59, 130, 246, 0.18)'
                  : 'rgba(15, 23, 42, 0.85)',
                border: weightsOpen
                  ? '1px solid rgba(59, 130, 246, 0.45)'
                  : '1px solid var(--border-subtle)',
                color: weightsOpen ? '#60a5fa' : '#94a3b8',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              Weights
            </button>
          </div>

          {/* Expandable Weights Drawer */}
          {weightsOpen && (
            <div
              className="tri-card"
              style={{
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                RANKING WEIGHTS
              </span>
              {Object.entries(weights).map(([wKey, val]) => (
                <div
                  key={wKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                  }}
                >
                  <span style={{ color: '#cbd5e1' }}>
                    {FACTOR_LABELS[wKey] ?? wKey}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={val}
                      onChange={(e) => setWeights({ ...weights, [wKey]: Number(e.target.value) })}
                      style={{ width: '90px', accentColor: '#3b82f6' }}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: '#60a5fa',
                        width: '32px',
                        textAlign: 'right',
                      }}
                    >
                      {val}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'whatif' ? (
            <FireHazRPage compact />
          ) : (
            /* Clean Ranked Study Cards (no browser <details> disclosure arrows) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rankedItems.map(({ investigation: inv, score, breakdown }, idx) => {
                const pct = Math.round(score * 100);
                return (
                  <div
                    key={inv.psiId ?? inv.id}
                    onClick={() => navigate(`/study/${inv.id}`)}
                    className="tri-card"
                    style={{
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Card Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
                        <span
                          style={{
                            color: '#60a5fa',
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                          }}
                        >
                          #{idx + 1}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                          {inv.acronym ?? inv.name}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono)',
                            color: '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {inv.hardware ?? inv.facility}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          color: '#34d399',
                          background: 'rgba(16, 185, 129, 0.12)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {scenario.partialGravity
                          ? `${Math.max(10, pct - 7)}%–${Math.min(100, pct + 5)}% (0g↔1g)`
                          : `${(score * 100).toFixed(0)}% match`}
                      </span>
                    </div>

                    {/* Stacked Factor Breakdown Bar + Explicit Factor Values */}
                    {breakdown?.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div className="score-bar-container">
                          {breakdown.map((b) => (
                            <div
                              key={b.factor}
                              className="score-bar-segment"
                              title={`${b.factor}: ${(b.value * 100).toFixed(0)}% × weight ${b.weight} = +${(
                                b.contribution * 100
                              ).toFixed(1)}%`}
                              style={{
                                width: `${Math.max(3, b.contribution * 100)}%`,
                                backgroundColor: FACTOR_COLORS[b.factor] ?? '#3b82f6',
                              }}
                            />
                          ))}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '4px',
                            fontSize: '9.5px',
                            fontFamily: 'var(--font-mono)',
                            color: '#cbd5e1',
                          }}
                        >
                          {breakdown.map((b) => (
                            <span
                              key={b.factor}
                              style={{
                                background: 'rgba(15, 23, 42, 0.85)',
                                border: '1px solid rgba(148, 163, 184, 0.16)',
                                borderRadius: '4px',
                                padding: '1px 5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: FACTOR_COLORS[b.factor] ?? '#3b82f6',
                                }}
                              />
                              <span>
                                {b.factor}: +{(b.contribution * 100).toFixed(0)}%
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key Telemetry Metadata */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        flexWrap: 'wrap',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: '#94a3b8',
                      }}
                    >
                      <span>O₂: {inv.oxygenRange}</span>
                      <span style={{ color: '#475569' }}>·</span>
                      <span>P: {inv.ambientPressure}</span>
                      <span style={{ color: '#475569' }}>·</span>
                      <span>Flow: {inv.flowVelocity}</span>
                    </div>

                    {/* Concise Summary */}
                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        color: '#94a3b8',
                        lineHeight: 1.5,
                      }}
                    >
                      {audience === 'Engineer'
                        ? inv.aiSummary?.engineer
                        : inv.aiSummary?.student}
                    </p>

                    {/* Footer */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: '#64748b',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(148, 163, 184, 0.08)',
                      }}
                    >
                      <a
                        href={inv.sourceUrl ?? 'https://psi.nasa.gov/'}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: '#64748b', textDecoration: 'none' }}
                      >
                        PSI Archive ↗
                      </a>
                      <span style={{ color: '#60a5fa', fontWeight: 500 }}>
                        Inspect study →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      )}

      {/* Right 3D Solar System Area */}
      <div
        className="mission-hub__explorer"
        style={{
          flex: 1,
          position: 'relative',
          height: '100%',
          background: '#040711',
          overflow: 'hidden',
        }}
      >
        {/* Clean Sidebar Toggle Button */}
        <button
          type="button"
          onClick={() => setPanelCollapsed(!panelCollapsed)}
          title={panelCollapsed ? 'Show PSI Studies Panel' : 'Hide Panel'}
          style={{
            position: 'absolute',
            left: '16px',
            bottom: '20px',
            zIndex: 35,
            background: 'rgba(10, 15, 29, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '7px 12px',
            color: '#94a3b8',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          {panelCollapsed ? 'Show Panel' : 'Hide Panel'}
        </button>

        {/* Minimalist Top Bar Over 3D Scene */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '20px',
            right: '20px',
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {/* Target Body + Spacecraft Dropdowns */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '6px 14px',
              borderRadius: '10px',
              background: 'rgba(10, 15, 29, 0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-subtle)',
              pointerEvents: 'auto',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#64748b',
                letterSpacing: '0.06em',
              }}
            >
              TARGET
            </span>
            <select
              ref={targetRef}
              aria-label="Planet to explore"
              value={focusPlanet ?? ''}
              onChange={(e) => setFocusPlanet(e.target.value || null)}
              className="tri-select"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                padding: '3px 24px 3px 4px',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <option value="" style={{ background: '#0f172a' }}>
                Solar System Overview (0–30.1 AU)
              </option>
              {PLANETS.map((p) => (
                <option key={p.name} value={p.name} style={{ background: '#0f172a' }}>
                  {p.name === 'Sol' ? 'Sun (Sol)' : p.name} · {p.au}
                </option>
              ))}
            </select>

            {SHIP_CATALOG.length > 0 && (
              <>
                <span
                  style={{
                    width: '1px',
                    height: '16px',
                    background: 'var(--border-subtle)',
                  }}
                />
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: '#64748b',
                    letterSpacing: '0.06em',
                  }}
                >
                  CRAFT
                </span>
                <select
                  aria-label="Spacecraft model"
                  value={shipFile}
                  onChange={(e) => setShipFile(e.target.value)}
                  className="tri-select"
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    padding: '3px 24px 3px 4px',
                    color: '#38bdf8',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {SHIP_CATALOG.map((ship) => (
                    <option key={ship.id} value={ship.id} style={{ background: '#0f172a' }}>
                      {ship.label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          {/* Minimalist Orbit Controls */}
          <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
            <button
              type="button"
              onClick={() => setPaused(!paused)}
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                background: paused
                  ? 'rgba(245, 158, 11, 0.16)'
                  : 'rgba(10, 15, 29, 0.85)',
                backdropFilter: 'blur(12px)',
                border: paused
                  ? '1px solid rgba(245, 158, 11, 0.4)'
                  : '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: paused ? '#fbbf24' : '#e2e8f0',
                padding: '7px 13px',
                cursor: 'pointer',
              }}
            >
              {paused ? 'Resume Orbit' : 'Pause Orbit'}
            </button>
            {focusPlanet && (
              <button
                type="button"
                onClick={() => setFocusPlanet(null)}
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(10, 15, 29, 0.85)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: '#60a5fa',
                  padding: '7px 13px',
                  cursor: 'pointer',
                }}
              >
                Overview
              </button>
            )}
          </div>
        </div>

        {/* 3D Solar System Canvas */}
        <div className="mission-planet-layout">
          <div className="mission-planet-layout__scene">
            <SolarSystemScene
              paused={paused}
              panelCollapsed={panelCollapsed}
              shipFile={shipFile}
            />
          </div>
          {activePlanetObj && (
            <MissionPlanetInspection
              key={activePlanetObj.name}
              body={activePlanetObj}
              onClose={closeInspection}
              onOpenTestbench={() => {
                setPanelCollapsed(false);
                setActiveTab('whatif');
              }}
            />
          )}
        </div>

        {/* Bottom-Right Copilot Pill when Chat is Closed */}
        {!chatOpen && (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              zIndex: 25,
              padding: '9px 16px',
              borderRadius: '9999px',
              background: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
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
            <span>Ask Heimdall Copilot</span>
          </button>
        )}
      </div>
    </div>
  );
}
