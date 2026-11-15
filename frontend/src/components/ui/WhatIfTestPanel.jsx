import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FlameVisualization from '../three/FlameVisualization.jsx';
import { SCENARIOS } from '../../context/ScenarioContext.jsx';
import { api } from '../../services/api.js';
import { checkConditionCoverage } from '../../services/ranking.js';

const FUEL_OPTIONS = [
  { value: 'all', label: 'All Fuel Types' },
  { value: 'solid', label: 'Solid (PMMA, SIBAL, Nomex)' },
  { value: 'gas', label: 'Gas (ACME, SPICE, SLICE)' },
  { value: 'droplet', label: 'Liquid Droplet (FLEX, CFI)' },
  { value: 'aerosol', label: 'Smoke / Dust (SAME, DAFT)' },
];

export default function WhatIfTestPanel({
  scenarioKey = 'moon',
  weights = {},
  compact = false,
}) {
  const navigate = useNavigate();
  const activeScenario = SCENARIOS[scenarioKey] ?? SCENARIOS.moon;

  const [oxygenPct, setOxygenPct] = useState(activeScenario.oxygenPct ?? 30);
  const [pressurePsi, setPressurePsi] = useState(activeScenario.pressurePsi ?? 10.2);
  const [flowVelocity, setFlowVelocity] = useState(activeScenario.flowVelocity ?? 0.1);
  const [gravityMode, setGravityMode] = useState(
    activeScenario.partialGravity
      ? 'scenario'
      : activeScenario.gravity === '1g'
        ? '1g'
        : 'microgravity'
  );
  const [fuelType, setFuelType] = useState('all');
  const [flameShape, setFlameShape] = useState('astronaut');
  const [suitState, setSuitState] = useState('auto');
  const [rankedResults, setRankedResults] = useState([]);

  useEffect(() => {
    const s = SCENARIOS[scenarioKey] ?? SCENARIOS.moon;
    setOxygenPct(s.oxygenPct ?? 30);
    setPressurePsi(s.pressurePsi ?? 10.2);
    setFlowVelocity(s.flowVelocity ?? 0.1);
    const nextG = s.partialGravity
      ? 'scenario'
      : s.gravity === '1g'
        ? '1g'
        : 'microgravity';
    setGravityMode(nextG);
    setSuitState('auto');
  }, [scenarioKey]);

  const effectiveGravity =
    gravityMode === 'microgravity'
      ? 'microgravity'
      : gravityMode === '1g'
        ? '1g'
        : activeScenario.gravity;

  const isPartialGravity =
    effectiveGravity === 'lunar' ||
    effectiveGravity === 'martian' ||
    (gravityMode === 'scenario' && activeScenario.partialGravity);

  useEffect(() => {
    let cancelled = false;
    const queryScenario = {
      ...activeScenario,
      oxygenPct,
      pressurePsi,
      flowVelocity,
      gravity: effectiveGravity,
      fuelType,
    };
    api.rank(queryScenario, weights).then((res) => {
      if (!cancelled) {
        setRankedResults(res.results ?? []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeScenario, oxygenPct, pressurePsi, flowVelocity, effectiveGravity, fuelType, weights]);

  const coverage = checkConditionCoverage({
    oxygenPct,
    pressurePsi,
    flowVelocity,
    fuelType,
  });

  // Compute an intuitive qualitative Fire Hazard Index for visual feedback
  const hazardIndex = Math.min(
    100,
    Math.max(
      8,
      Math.round(
        (oxygenPct - 12) * 1.45 +
          flowVelocity * 42 +
          (14.7 - Math.min(14.7, pressurePsi)) * 0.8
      )
    )
  );
  const hazardStatus =
    oxygenPct >= 35
      ? { label: 'CRITICAL O₂ FLAMMABILITY', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' }
      : oxygenPct >= 26
        ? { label: 'ELEVATED HABITAT HAZARD', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' }
        : { label: 'NOMINAL CABIN ENVELOPE', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };

  const topResults = rankedResults.slice(0, compact ? 4 : 6);

  return (
    <div
      className="whatif-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {/* Top Bar: Fire Hazard Simulator Header + Quick Presets */}
      <div
        className="tri-card"
        style={{
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#38bdf8',
                fontWeight: 600,
                letterSpacing: '0.06em',
              }}
            >
              FIRE HAZARD SIMULATOR · {activeScenario.label.toUpperCase()}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Test habitat O₂, pressure, airflow & gravity against empirical NASA PSI bounds.
            </div>
          </div>

          <span
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              fontWeight: 600,
              color: hazardStatus.color,
              background: hazardStatus.bg,
              border: `1px solid ${hazardStatus.color}44`,
            }}
          >
            {hazardStatus.label} ({hazardIndex}%)
          </span>
        </div>

        {/* Hazard Progress Bar */}
        <div
          style={{
            width: '100%',
            height: '5px',
            borderRadius: '9999px',
            background: 'rgba(15, 23, 42, 0.9)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${hazardIndex}%`,
              height: '100%',
              background: hazardStatus.color,
              borderRadius: '9999px',
              transition: 'width 0.2s ease, background-color 0.2s ease',
            }}
          />
        </div>

        {/* Preset Buttons */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { label: 'Nominal Suit (21% O₂)', o2: 21, p: 14.7, flow: 0.1, shape: 'astronaut', suit: 'normal', g: 'microgravity' },
            { label: 'Suit in Flames (35% O₂)', o2: 35, p: 10.2, flow: 0.15, shape: 'astronaut', suit: 'flames', g: 'scenario' },
            { label: 'Burned Suit (85% O₂)', o2: 85, p: 4.3, flow: 0.45, shape: 'astronaut', suit: 'burned', g: 'microgravity' },
            { label: 'Earth 1g Plume (21% O₂)', o2: 21, p: 14.7, flow: 0.05, shape: 'teardrop', suit: 'normal', g: '1g' },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setOxygenPct(preset.o2);
                setPressurePsi(preset.p);
                setFlowVelocity(preset.flow);
                setFlameShape(preset.shape);
                setSuitState(preset.suit);
                setGravityMode(preset.g);
              }}
              style={{
                padding: '4px 9px',
                borderRadius: '6px',
                fontSize: '10.5px',
                fontFamily: 'var(--font-mono)',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid var(--border-subtle)',
                color: '#cbd5e1',
                cursor: 'pointer',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3D Low-Poly Triangulated Flame Viewport */}
      <div
        className="tri-card"
        style={{
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: '#f8fafc',
            }}
          >
            3D Low-Poly Flame Morphology
          </span>

          <div
            style={{
              display: 'flex',
              gap: '4px',
              padding: '3px',
              borderRadius: '8px',
              background: 'rgba(5, 8, 17, 0.8)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => setFlameShape('astronaut')}
              style={{
                fontSize: '10.5px',
                fontFamily: 'var(--font-mono)',
                padding: '4px 9px',
                borderRadius: '6px',
                border: 'none',
                background:
                  flameShape === 'astronaut' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                color: flameShape === 'astronaut' ? '#34d399' : '#94a3b8',
                cursor: 'pointer',
                fontWeight: flameShape === 'astronaut' ? 600 : 400,
              }}
            >
              3D Astronaut Suit
            </button>
            <button
              type="button"
              onClick={() => setFlameShape('spherical')}
              style={{
                fontSize: '10.5px',
                fontFamily: 'var(--font-mono)',
                padding: '4px 9px',
                borderRadius: '6px',
                border: 'none',
                background:
                  flameShape === 'spherical' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                color: flameShape === 'spherical' ? '#38bdf8' : '#94a3b8',
                cursor: 'pointer',
                fontWeight: flameShape === 'spherical' ? 600 : 400,
              }}
            >
              Micro-g Sphere
            </button>
            <button
              type="button"
              onClick={() => setFlameShape('teardrop')}
              style={{
                fontSize: '10.5px',
                fontFamily: 'var(--font-mono)',
                padding: '4px 9px',
                borderRadius: '6px',
                border: 'none',
                background:
                  flameShape === 'teardrop' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                color: flameShape === 'teardrop' ? '#fbbf24' : '#94a3b8',
                cursor: 'pointer',
                fontWeight: flameShape === 'teardrop' ? 600 : 400,
              }}
            >
              Buoyant Plume (1g)
            </button>
          </div>
        </div>

        <div
          style={{
            height: compact ? '190px' : '230px',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
            position: 'relative',
          }}
        >
          <FlameVisualization
            type={flameShape}
            oxygen={oxygenPct}
            airflow={flowVelocity}
            suitState={suitState}
          />
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '10px',
              display: 'flex',
              gap: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
            }}
          >
            <span
              style={{
                padding: '2px 7px',
                borderRadius: '4px',
                background: 'rgba(10, 15, 29, 0.82)',
                border: '1px solid var(--border-subtle)',
                color: '#38bdf8',
              }}
            >
              {oxygenPct}% O₂
            </span>
            <span
              style={{
                padding: '2px 7px',
                borderRadius: '4px',
                background: 'rgba(10, 15, 29, 0.82)',
                border: '1px solid var(--border-subtle)',
                color: '#e2e8f0',
              }}
            >
              {pressurePsi.toFixed(1)} psi
            </span>
            <span
              style={{
                padding: '2px 7px',
                borderRadius: '4px',
                background: 'rgba(10, 15, 29, 0.82)',
                border: '1px solid var(--border-subtle)',
                color: '#34d399',
              }}
            >
              {flowVelocity.toFixed(2)} m/s
            </span>
          </div>
          <span
            style={{
              position: 'absolute',
              bottom: '6px',
              right: '8px',
              fontSize: '9.5px',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(5, 8, 17, 0.82)',
              color: '#64748b',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            Illustrative low-poly morphology · Drag to rotate
          </span>
        </div>
      </div>

      {/* Parameter Sliders Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '10px',
        }}
      >
        {/* 1. O2 % */}
        <label
          className="tri-card"
          style={{
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: '#94a3b8' }}>O₂ CONC.</span>
            <strong style={{ color: '#38bdf8' }}>{oxygenPct}%</strong>
          </div>
          <input
            type="range"
            aria-label="Habitat Oxygen Percentage"
            min="10"
            max="100"
            step="1"
            value={oxygenPct}
            onChange={(e) => {
              setOxygenPct(Number(e.target.value));
              setSuitState('auto');
            }}
            style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
            <span>10%</span>
            <span>21% ISS</span>
            <span>30% Moon</span>
            <span>85% Max</span>
          </div>
        </label>

        {/* 2. Pressure psi */}
        <label
          className="tri-card"
          style={{
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: '#94a3b8' }}>PRESSURE</span>
            <strong style={{ color: '#fb7185' }}>{pressurePsi.toFixed(1)} psi</strong>
          </div>
          <input
            type="range"
            aria-label="Habitat Pressure psi"
            min="3.0"
            max="25.0"
            step="0.1"
            value={pressurePsi}
            onChange={(e) => setPressurePsi(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#fb7185', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
            <span>4.3 Suit</span>
            <span>10.2 Moon</span>
            <span>14.7 ISS</span>
            <span>25 psi</span>
          </div>
        </label>

        {/* 3. Airflow velocity */}
        <label
          className="tri-card"
          style={{
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: '#94a3b8' }}>AIRFLOW</span>
            <strong style={{ color: '#34d399' }}>{flowVelocity.toFixed(2)} m/s</strong>
          </div>
          <input
            type="range"
            aria-label="Cabin Airflow Velocity"
            min="0.0"
            max="0.6"
            step="0.01"
            value={flowVelocity}
            onChange={(e) => setFlowVelocity(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#34d399', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
            <span>0.00 Still</span>
            <span>0.20 Saffire</span>
            <span>0.60 m/s</span>
          </div>
        </label>

        {/* 4. Fuel Type + Gravity */}
        <div
          className="tri-card"
          style={{
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: '#94a3b8' }}>FUEL & GRAVITY</span>
          </div>
          <select
            aria-label="Fuel Type"
            className="tri-select"
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value)}
            style={{ width: '100%', padding: '5px 26px 5px 8px', fontSize: '11px' }}
          >
            {FUEL_OPTIONS.map((f) => (
              <option key={f.value} value={f.value} style={{ background: '#0f172a' }}>
                {f.label}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { id: 'microgravity', label: '0g' },
              { id: 'scenario', label: activeScenario.partialGravity ? `${activeScenario.gravityG}g` : 'Scenario' },
              { id: '1g', label: '1g' },
            ].map((opt) => {
              const active = gravityMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setGravityMode(opt.id);
                    if (opt.id === '1g') setFlameShape('teardrop');
                    if (opt.id === 'microgravity') setFlameShape('spherical');
                  }}
                  style={{
                    flex: 1,
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    padding: '3px 4px',
                    borderRadius: '5px',
                    border: active
                      ? '1px solid rgba(167, 139, 250, 0.5)'
                      : '1px solid var(--border-subtle)',
                    background: active ? 'rgba(167, 139, 250, 0.16)' : 'rgba(10, 15, 29, 0.7)',
                    color: active ? '#e9d5ff' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Out-of-bounds warning: "No measured data in this region" */}
      {!coverage.covered && (
        <div
          role="alert"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '8px',
            padding: '10px 12px',
            color: '#fecaca',
            fontSize: '11.5px',
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#f87171', marginBottom: '3px' }}>
            No measured data in this region
          </div>
          <div>
            {coverage.detail}. Highest O₂ tested in PSI is <strong>CFI-G (ACME)</strong> up to <strong>85% O₂</strong>.
          </div>
        </div>
      )}

      {/* Nearest PSI Experiments Ranked Transparently */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#94a3b8', fontWeight: 600 }}>
            MATCHING PSI EXPERIMENTS
          </span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
            {rankedResults.length} records
          </span>
        </div>

        {topResults.map(({ investigation: inv, score }) => (
          <div
            key={inv.psiId ?? inv.id}
            onClick={() => navigate(`/study/${inv.id}`)}
            className="tri-card"
            style={{
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div>
                <strong style={{ fontSize: '13px', color: '#f8fafc' }}>{inv.acronym}</strong>{' '}
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>· {inv.hardware}</span>
              </div>
              <span
                style={{
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: '#34d399',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '2px 7px',
                  borderRadius: '5px',
                  whiteSpace: 'nowrap',
                }}
              >
                {isPartialGravity
                  ? `${Math.max(10, Math.round(score * 100) - 7)}%–${Math.min(100, Math.round(score * 100) + 5)}%`
                  : `${(score * 100).toFixed(0)}% match`}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
              <span>O₂: {inv.oxygenRange}</span>
              <span>·</span>
              <span>P: {inv.ambientPressure}</span>
              <span>·</span>
              <span>Flow: {inv.flowVelocity}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
