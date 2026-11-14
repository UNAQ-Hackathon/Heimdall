import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import SolarSystemScene from '../components/three/SolarSystemScene.jsx';
import ScenarioHUD from '../components/ui/ScenarioHUD.jsx';
import CopilotChat from '../components/ui/CopilotChat.jsx';
import { useApp } from '../context/AppContext.jsx';
import { rankInvestigations, PLANETS } from '../services/mockData.js';

export default function MissionHub() {
  const {
    scenarioKey,
    scenario,
    audience,
    category,
    setCategory,
    focusPlanet,
    setFocusPlanet,
    weights,
    setWeights,
  } = useApp();

  const [paused, setPaused] = useState(false);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const navigate = useNavigate();

  const ranked = useMemo(() => {
    return rankInvestigations(scenarioKey, weights, category);
  }, [scenarioKey, weights, category]);

  return (
    <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 80px)', overflow: 'hidden', position: 'relative' }}>
      {/* ── Left Analytical Panel (Slidable Container) ── */}
      <div
        style={{
          width: panelCollapsed ? '0px' : '480px',
          minWidth: panelCollapsed ? '0px' : '440px',
          maxWidth: '540px',
          height: '100%',
          flexShrink: 0,
          position: 'relative',
          transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 25,
        }}
      >
        {/* Inner Content with Translate-X Slide Animation */}
        <div
          style={{
            width: '480px',
            height: '100%',
            overflowY: 'auto',
            padding: '20px 24px',
            borderRight: '1px solid #1c2640',
            background: '#0a0f1e',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            transform: panelCollapsed ? 'translateX(-100%)' : 'translateX(0)',
            opacity: panelCollapsed ? 0 : 1,
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
            pointerEvents: panelCollapsed ? 'none' : 'auto',
          }}
        >
          {/* Regime Telemetry Header */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: '#4f8ef7',
                letterSpacing: '0.8px',
                marginBottom: '4px',
              }}
            >
              <span>● REGIME TELEMETRY PROFILE // {scenario.code}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#8892a8' }}>SYS_ID: {scenario.sysId}</span>
                <button
                  onClick={() => setPanelCollapsed(true)}
                  title="Hide analytical panel"
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    background: '#111827',
                    border: '1px solid #1c2640',
                    color: '#94a3b8',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                  onPointerOver={(e) => {
                    e.currentTarget.style.borderColor = '#4f8ef7';
                    e.currentTarget.style.color = '#38bdf8';
                  }}
                  onPointerOut={(e) => {
                    e.currentTarget.style.borderColor = '#1c2640';
                    e.currentTarget.style.color = '#94a3b8';
                  }}
                >
                  <span>«</span>
                  <span>Hide Panel</span>
                </button>
              </div>
            </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.3px', margin: '2px 0 6px 0' }}>
            {scenario.label} Regime
          </h1>
          <div style={{ fontSize: '12px', color: '#8892a8', fontFamily: 'var(--font-mono)' }}>
            Target Environment: <span style={{ color: '#e2e8f0' }}>{scenario.gravity}</span> · Ambient Pressure:{' '}
            <span style={{ color: '#e2e8f0' }}>{scenario.pressurePsi} psi</span> ·{' '}
            <span style={{ color: '#f59e0b' }}>Elevated O₂ ({scenario.oxygenPct}%)</span>
          </div>
        </div>

        {/* Scientific Notice Banner */}
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '6px',
            padding: '10px 14px',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
          }}
        >
          <span style={{ color: '#f59e0b', fontSize: '15px', lineHeight: 1 }}>⚠</span>
          <div>
            <div
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: '#f59e0b',
                letterSpacing: '1px',
                marginBottom: '2px',
              }}
            >
              SCIENTIFIC NOTICE // CALIBRATION LIMIT
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
              NASA PSI lacks partial-gravity data. Predictive flame results are strictly bounded between 0g (orbital) and 1g
              (terrestrial) limits.
            </div>
          </div>
        </div>

        {/* Category Filter Pills & Weight Toggler */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'all', label: 'ALL' },
              { id: 'prevention', label: 'PREVENTION' },
              { id: 'detection', label: 'DETECTION' },
              { id: 'suppression', label: 'SUPPRESSION' },
            ].map((cat) => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: active ? '1px solid rgba(79, 142, 247, 0.4)' : '1px solid #1c2640',
                    background: active ? 'rgba(79, 142, 247, 0.15)' : '#111827',
                    color: active ? '#93c5fd' : '#8892a8',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setWeightsOpen(!weightsOpen)}
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              background: '#111827',
              border: '1px solid #1c2640',
              color: '#cbd5e1',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            ⚙ WEIGHTS {weightsOpen ? '▲' : '▼'}
          </button>
        </div>

        {/* Expandable Weights Control */}
        {weightsOpen && (
          <div
            style={{
              background: '#111827',
              border: '1px solid #1c2640',
              borderRadius: '6px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#8892a8' }}>
              ALGORITHM REGIME WEIGHTS (% BIAS)
            </span>
            {Object.entries(weights).map(([wKey, val]) => (
              <div key={wKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#cbd5e1', textTransform: 'capitalize' }}>{wKey.replace(/([A-Z])/g, ' $1')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={val}
                    onChange={(e) => setWeights({ ...weights, [wKey]: Number(e.target.value) })}
                    style={{ width: '80px', accentColor: '#4f8ef7' }}
                  />
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#4f8ef7', width: '28px', textAlign: 'right' }}>
                    {val}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Database query status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#8892a8', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: '#38bdf8' }}>☲</span>
          <span>Querying: 14 Spacecraft Fire Safety Datasets (NASA PSI EST_MATCH: HIGH)</span>
        </div>

        {/* Ranked Investigations List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {ranked.map((inv) => (
            <div
              key={inv.id}
              style={{
                background: '#0d1321',
                border: '1px solid #1c2640',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'border-color 0.2s ease',
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>{inv.name}</span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      background: 'rgba(255,255,255,0.06)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                    }}
                  >
                    {inv.facility}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  ● {inv.matchScore}% Match
                </span>
              </div>

              {/* Subtitle */}
              <div
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: '#64748b',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                {inv.subtitle}
              </div>

              {/* Stacked Score Breakdown Bar */}
              <div style={{ marginTop: '2px' }}>
                <div
                  style={{
                    height: '5px',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    display: 'flex',
                    background: '#151d2e',
                  }}
                >
                  <div style={{ width: `${inv.scores.geometry || 35}%`, background: '#38bdf8' }} />
                  <div style={{ width: `${inv.scores.o2Conc || 40}%`, background: '#fb7185' }} />
                  <div style={{ width: `${inv.scores.flowVel || 25}%`, background: '#a78bfa' }} />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    color: '#64748b',
                    marginTop: '4px',
                  }}
                >
                  <span>Geometry: {inv.scores.geometry || 32}%</span>
                  <span>O₂ Conc: {inv.scores.o2Conc || 38}%</span>
                  <span>Flow Vel: {inv.scores.flowVel || 24}%</span>
                </div>
              </div>

              {/* AI Summary */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(79, 142, 247, 0.1)',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  fontSize: '11.5px',
                  color: '#cbd5e1',
                  lineHeight: 1.45,
                }}
              >
                <span style={{ color: '#60a5fa', fontWeight: 600 }}>AI Summary: </span>
                {audience === 'Engineer' ? inv.aiSummary.engineer : inv.aiSummary.student}
              </div>

              {/* Card Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                  Archived Runs: {inv.runsArchived} Tests
                </span>
                <button
                  onClick={() => navigate(`/study/${inv.id}`)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#60a5fa',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  INSPECT DATASET →
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Panel Footer */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '12px',
            borderTop: '1px solid #1c2640',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: '#64748b',
          }}
        >
          <span>MODEL: NEURAL_COMBUSTION_v4.2</span>
          <span style={{ color: '#34d399' }}>● CONFIDENCE: 98.4%</span>
        </div>
      </div>
    </div>

      {/* ── Right 3D Visualization Area ── */}
      <div style={{ flex: 1, position: 'relative', height: '100%', background: '#040711', transition: 'width 0.4s ease' }}>
        {/* Discreet Edge Tab Button to toggle the analytical panel */}
        <button
          onClick={() => setPanelCollapsed(!panelCollapsed)}
          title={panelCollapsed ? "Show Telemetry Panel" : "Hide Analytical Panel"}
          style={{
            position: 'absolute',
            top: '76px',
            left: '0px',
            zIndex: 35,
            background: 'rgba(13, 19, 33, 0.94)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #1c2640',
            borderLeft: 'none',
            borderRadius: '0 6px 6px 0',
            padding: '8px 5px',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '3px 0 12px rgba(0,0,0,0.6)',
            transition: 'all 0.2s ease',
          }}
          onPointerOver={(e) => {
            e.currentTarget.style.borderColor = '#38bdf8';
            e.currentTarget.style.color = '#38bdf8';
          }}
          onPointerOut={(e) => {
            e.currentTarget.style.borderColor = '#1c2640';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <span style={{ fontSize: '13px', color: '#38bdf8', lineHeight: 1 }}>{panelCollapsed ? '»' : '«'}</span>
          <span
            style={{
              fontSize: '8px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              writingMode: 'vertical-rl',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            {panelCollapsed ? 'Telemetry' : 'Hide Panel'}
          </span>
        </button>

        {/* Top Floating Simulation Controls */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '20px',
            right: '20px',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            pointerEvents: 'none',
          }}
        >
          {/* Main header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Show Telemetry button when panel is collapsed */}
              {panelCollapsed && (
                <button
                  onClick={() => setPanelCollapsed(false)}
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    background: 'rgba(13, 19, 33, 0.92)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid #38bdf8',
                    color: '#38bdf8',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 0 12px rgba(56, 189, 248, 0.25)',
                    pointerEvents: 'auto',
                    transition: 'all 0.15s ease',
                  }}
                  onPointerOver={(e) => {
                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)';
                  }}
                  onPointerOut={(e) => {
                    e.currentTarget.style.background = 'rgba(13, 19, 33, 0.92)';
                  }}
                >
                  <span>»</span>
                  <span>Show Telemetry</span>
                </button>
              )}

              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(13, 19, 33, 0.8)',
                  backdropFilter: 'blur(8px)',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #1c2640',
                }}
              >
                <span>●</span> SYSTEM SIMULATION: 3D HELIORADIAL PLANETARY DYNAMICS [SKETCH]
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
              <button
                onClick={() => setPaused(!paused)}
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(13, 19, 33, 0.85)',
                  border: '1px solid #1c2640',
                  color: '#e2e8f0',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {paused ? '▶ Resume Orbit' : '⏸ Pause Orbit'}
              </button>
              <button
                onClick={() => setFocusPlanet(null)}
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  background: focusPlanet ? 'rgba(79, 142, 247, 0.25)' : 'rgba(13, 19, 33, 0.85)',
                  border: focusPlanet ? '1px solid #4f8ef7' : '1px solid #1c2640',
                  color: focusPlanet ? '#93c5fd' : '#e2e8f0',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                ⟳ Reset View / Zoom Out
              </button>
            </div>
          </div>

          {/* Planet Selection Chips */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              pointerEvents: 'auto',
              background: 'rgba(13, 19, 33, 0.75)',
              backdropFilter: 'blur(8px)',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #1c2640',
              width: 'fit-content',
            }}
          >
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b', alignSelf: 'center', marginRight: '4px' }}>
              PLANETS:
            </span>
            {PLANETS.filter((p) => p.name !== 'Sol').map((p) => {
              const active = focusPlanet === p.name;
              return (
                <button
                  key={p.name}
                  onClick={() => setFocusPlanet((prev) => (prev === p.name ? null : p.name))}
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: active ? '1px solid #4f8ef7' : '1px solid #1c2640',
                    background: active ? 'rgba(79, 142, 247, 0.2)' : '#111827',
                    color: active ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.color }} />
                  {p.name.toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* Environment Telemetry Bar */}
          <div
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#8892a8',
              background: 'rgba(13, 19, 33, 0.6)',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(28, 38, 64, 0.6)',
              width: 'fit-content',
            }}
          >
            <span style={{ color: '#38bdf8' }}>●</span> ENVIRONMENT TELEMETRY: SOLAR OVERVIEW | 0.00g – 2.53g Range | Vacuum &
            Multi-Atmosphere
          </div>
        </div>

        {/* 3D Solar System Canvas with dynamic width & camera centering */}
        <SolarSystemScene paused={paused} panelCollapsed={panelCollapsed} />

        {/* Center overlay hint */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: focusPlanet ? '#38bdf8' : '#475569',
            letterSpacing: '1px',
            pointerEvents: 'none',
            background: focusPlanet ? 'rgba(13, 19, 33, 0.7)' : 'transparent',
            padding: focusPlanet ? '4px 12px' : '0',
            borderRadius: '4px',
            border: focusPlanet ? '1px solid rgba(56, 189, 248, 0.25)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          {focusPlanet
            ? `● FOCUSING: ${focusPlanet.toUpperCase()} · CLICK PLANET OR CHIP AGAIN TO ZOOM OUT`
            : 'CLICK PLANET OR CHIP TO ENGAGE ORBITAL CAMERA LERPS'}
        </div>

        {/* Floating Scenario HUD (bottom-left) */}
        <ScenarioHUD />

        {/* Floating Copilot Chat (bottom-right inline) */}
        <CopilotChat inline />
      </div>
    </div>
  );
}
