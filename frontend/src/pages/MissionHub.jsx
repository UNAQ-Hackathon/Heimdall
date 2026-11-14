import { useState, useMemo, useRef, useCallback } from 'react';
import MissionPlanetInspection from '../components/ui/MissionPlanetInspection.jsx';
import { useNavigate } from 'react-router-dom';
import SolarSystemScene, { SHIP_CATALOG } from '../components/three/SolarSystemScene.jsx';
import { SCENARIOS, useApp } from '../context/AppContext.jsx';
import { rankInvestigations, PLANETS } from '../services/mockData.js';

const SCENARIO_TO_PLANET = {
  iss: 'Earth',
  lunarBase: 'Moon',
  rover: 'Moon',
  spacesuit: 'Earth',
  mars: 'Mars',
};

const selectStyle = {
  width: '100%',
  border: '1px solid #1e293b',
  color: '#f1f5f9',
  fontSize: '12px',
  fontWeight: 500,
  padding: '7px 10px',
  cursor: 'pointer',
  outline: 'none',
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

  const [paused, setPaused] = useState(false);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [shipFile, setShipFile] = useState('Nave_Azul_LowPoly.glb');
  const navigate = useNavigate();
  const targetRef = useRef(null);
  const closeInspection = useCallback(() => {
    setFocusPlanet(null);
    targetRef.current?.focus({ preventScroll: true });
  }, [setFocusPlanet]);

  const ranked = useMemo(() => {
    return rankInvestigations(scenarioKey, weights, category);
  }, [scenarioKey, weights, category]);

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
    <div
      className="mission-hub"
      style={{
        display: 'flex',
        width: '100%',
        height: 'calc(100vh - 80px)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ── Left Minimalist Low-Poly Analytical Panel ── */}
      <div
        className="mission-hub__studies"
        style={{
          width: panelCollapsed ? '0px' : '420px',
          minWidth: panelCollapsed ? '0px' : '400px',
          height: '100%',
          flexShrink: 0,
          position: 'relative',
          transition: 'width 0.35s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 25,
        }}
      >
        <div
          className="lowpoly-surface mission-hub__studies-content"
          style={{
            width: '420px',
            height: '100%',
            overflowY: 'auto',
            padding: '18px 20px',
            borderRight: '1px solid #18263e',
            backgroundColor: '#070b15',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            transform: panelCollapsed ? 'translateX(-100%)' : 'translateX(0)',
            opacity: panelCollapsed ? 0 : 1,
            transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
            pointerEvents: panelCollapsed ? 'none' : 'auto',
          }}
        >
          {/* NASA Mission Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#64748b',
                letterSpacing: '0.8px',
              }}
            >
              <span style={{ color: '#60a5fa', fontWeight: 600 }}>
                ▲ NASA PSI // {scenario.sysId}
              </span>
              <span>0g–1g BOUNDED</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h1
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#f8fafc',
                  margin: 0,
                  letterSpacing: '-0.2px',
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
                ▲ {ranked.length} studies
              </span>
            </div>

            {/* Faceted Environment Telemetry Pills */}
            <details className="mission-disclosure">
              <summary>Mission environment</summary>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
              <span
                className="tri-pill"
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  background: '#0d1424',
                  border: '1px solid #1e293b',
                  color: '#cbd5e1',
                  padding: '3px 9px',
                }}
              >
                ▸ {scenario.gravity}
              </span>
              <span
                className="tri-pill"
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  background: '#0d1424',
                  border: '1px solid #1e293b',
                  color: '#cbd5e1',
                  padding: '3px 9px',
                }}
              >
                ▸ {scenario.pressurePsi} psi
              </span>
              <span
                className="tri-pill"
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(252, 61, 33, 0.12)',
                  border: '1px solid rgba(252, 61, 33, 0.35)',
                  color: '#fca5a5',
                  padding: '3px 9px',
                }}
              >
                {scenario.oxygenPct}% O₂
              </span>
            </div>
            </details>
          </div>

          {/* ── Dropdown Filters Row ── */}
          <details className="mission-disclosure">
            <summary>Filters and ranking</summary>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr auto',
              gap: '8px',
              alignItems: 'end',
              paddingTop: '8px',
              borderTop: '1px solid #152036',
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: '#64748b',
                }}
              >
                ▲ MISSION SCENARIO
              </span>
              <select
                className="tri-select"
                value={scenarioKey}
                onChange={(e) => handleScenarioChange(e.target.value)}
                style={selectStyle}
              >
                {Object.values(SCENARIOS).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.oxygenPct}% O₂)
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: '#64748b',
                }}
              >
                ▲ CATEGORY
              </span>
              <select
                className="tri-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={selectStyle}
              >
                <option value="all">All Categories</option>
                <option value="prevention">Prevention</option>
                <option value="detection">Detection</option>
                <option value="suppression">Suppression</option>
              </select>
            </label>

            <button
              type="button"
              className="tri-pill"
              onClick={() => setWeightsOpen(!weightsOpen)}
              title="Adjust ranking weights"
              style={{
                height: '33px',
                padding: '0 10px',
                background: weightsOpen ? 'rgba(11, 61, 145, 0.4)' : '#0b1324',
                border: weightsOpen ? '1px solid #4f8ef7' : '1px solid #1e293b',
                color: '#cbd5e1',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              ▲ %
            </button>
          </div>

          {/* Expandable Weights Drawer */}
          {weightsOpen && (
            <div
              className="tri-card"
              style={{
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                ▲ RANKING WEIGHTS
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
                  <span style={{ color: '#cbd5e1', textTransform: 'capitalize' }}>
                    {wKey.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      value={val}
                      onChange={(e) => setWeights({ ...weights, [wKey]: Number(e.target.value) })}
                      style={{ width: '80px', accentColor: '#4f8ef7' }}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: '#60a5fa',
                        width: '28px',
                        textAlign: 'right',
                      }}
                    >
                      {val}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          </details>

          {/* ── Minimalist Faceted Ranked Investigations List ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ranked.map((inv) => (
              <details key={inv.id} className="tri-card mission-study">
                {/* Header */}
                <summary>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#4f8ef7', fontSize: '10px' }}>▲</span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                      {inv.name}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        color: '#64748b',
                      }}
                    >
                      {inv.facility}
                    </span>
                  </div>
                  <span
                    className="tri-pill"
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: '#34d399',
                      background: 'rgba(52, 211, 153, 0.1)',
                      border: '1px solid rgba(52, 211, 153, 0.22)',
                      padding: '2px 7px',
                    }}
                  >
                    {inv.matchScore}% match
                  </span>
                </div>

                </summary>
                <div className="mission-study__body">
                {/* Key Telemetry Metadata */}
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono)',
                    color: '#94a3b8',
                  }}
                >
                  <span>▸ {inv.oxygenRange}</span>
                  <span>·</span>
                  <span>{inv.ambientPressure}</span>
                  <span>·</span>
                  <span>{inv.fuelGeometry}</span>
                </div>

                {/* Concise Summary */}
                <p
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    color: '#cbd5e1',
                    lineHeight: 1.45,
                  }}
                >
                  {audience === 'Engineer' ? inv.aiSummary.engineer : inv.aiSummary.student}
                </p>

                {/* Subtle Footer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono)',
                    color: '#64748b',
                    paddingTop: '2px',
                  }}
                >
                  <span>{inv.runsArchived} flight runs</span>
                  <button type="button" className="mission-study__link" onClick={() => navigate(`/study/${inv.id}`)}>Inspect study</button>
                </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right 3D Solar System Area ── */}
      <div
        className="mission-hub__explorer"
        style={{
          flex: 1,
          position: 'relative',
          height: '100%',
          background: '#040711',
        }}
      >
        {/* Single Clean Faceted Collapse Handle */}
        <button
          onClick={() => setPanelCollapsed(!panelCollapsed)}
          title={panelCollapsed ? 'Open PSI Studies Panel' : 'Collapse Panel'}
          style={{
            position: 'absolute',
            top: '50%',
            left: '0px',
            transform: 'translateY(-50%)',
            zIndex: 35,
            background: 'rgba(11, 18, 33, 0.92)',
            border: '1px solid #1e293b',
            borderLeft: 'none',
            clipPath: 'polygon(0 0, 100% 6px, 100% calc(100% - 6px), 0 100%)',
            padding: '12px 6px',
            color: '#94a3b8',
            cursor: 'pointer',
          }}
        >
          {panelCollapsed ? '▸' : '◂'}
        </button>

        {/* Minimalist Top Bar Over 3D Scene (Dropdown + Orbit Distance + Controls) */}
        <div
          style={{
            position: 'absolute',
            top: '14px',
            left: '16px',
            right: '16px',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'none',
          }}
        >
          {/* Target Body Dropdown */}
          <div
            className="tri-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 12px',
              pointerEvents: 'auto',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#fc3d21',
              }}
            >
              ▲
            </span>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#64748b',
              }}
            >
              ORBIT TARGET:
            </span>
            <select
              ref={targetRef}
              aria-label="Planet to explore"
              value={focusPlanet ?? ''}
              onChange={(e) => setFocusPlanet(e.target.value || null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f8fafc',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="" style={{ background: '#0b1221' }}>
                Solar System Overview (0–30.1 AU)
              </option>
              {PLANETS.map((p) => (
                <option key={p.name} value={p.name} style={{ background: '#0b1221' }}>
                  {p.name === 'Sol' ? 'Sun (Sol)' : p.name} · {p.au}
                </option>
              ))}
            </select>
            {activePlanetObj && (
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: '#38bdf8',
                  borderLeft: '1px solid #1e293b',
                  paddingLeft: '8px',
                }}
              >
                {activePlanetObj.au}
              </span>
            )}

            {SHIP_CATALOG.length > 0 && (
              <>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: '#64748b',
                    borderLeft: '1px solid #1e293b',
                    paddingLeft: '8px',
                  }}
                >
                  CRAFT:
                </span>
                <select
                  value={shipFile}
                  onChange={(e) => setShipFile(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#93c5fd',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {SHIP_CATALOG.map((ship) => (
                    <option
                      key={ship.id}
                      value={ship.id}
                      style={{ background: '#0b1221' }}
                    >
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
              className="tri-pill"
              onClick={() => setPaused(!paused)}
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                background: 'rgba(11, 18, 33, 0.9)',
                border: '1px solid #1e293b',
                color: '#cbd5e1',
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              {paused ? '▸ Resume Orbit' : '⏸ Pause Orbit'}
            </button>
            {focusPlanet && (
              <button
                className="tri-pill"
                onClick={() => setFocusPlanet(null)}
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(11, 61, 145, 0.5)',
                  border: '1px solid #4f8ef7',
                  color: '#f8fafc',
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
              >
                ▲ Overview
              </button>
            )}
          </div>
        </div>

        {/* 3D Solar System Canvas */}
        <SolarSystemScene
          paused={paused}
          panelCollapsed={panelCollapsed}
          shipFile={shipFile}
        />

        {/* Subtle Faceted Bottom-Right Copilot Pill when Chat is Closed */}
        {!chatOpen && (
          <button
            type="button"
            className="tri-card"
            onClick={() => setChatOpen(true)}
            style={{
              position: 'absolute',
              bottom: '18px',
              right: '20px',
              zIndex: 25,
              padding: '8px 16px',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            <span style={{ color: '#fc3d21', fontSize: '10px' }}>▲</span>
            <span>Ask Heimdall Copilot</span>
          </button>
        )}
      </div>
    </div>
  );
}
