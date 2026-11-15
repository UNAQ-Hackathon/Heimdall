import { useState } from 'react';
import FlameVisualization, { TEST_SUBJECT_OPTIONS } from '../components/three/FlameVisualization.jsx';
import FireHazRPage from './FireHazRPage.jsx';
import { FLAME_COMPARISON } from '../services/mockData.js';

const SUBJECT_3D_OPTIONS = TEST_SUBJECT_OPTIONS.filter((item) => item.kind !== 'flame');

const CHAMBER_PRESETS = [
  {
    id: 'normal',
    label: 'Preset: Nominal Suit (21% O₂)',
    oxygen: 21.0,
    airflow: 0.05,
    gravityIndex: 0,
    suitState: 'normal',
    color: '#10b981',
  },
  {
    id: 'flames',
    label: 'Preset: Suit in Flames (35% O₂)',
    oxygen: 35.0,
    airflow: 0.14,
    gravityIndex: 1,
    suitState: 'flames',
    color: '#f59e0b',
  },
  {
    id: 'burned',
    label: 'Preset: Burned Suit / Flashover (85% O₂)',
    oxygen: 85.0,
    airflow: 0.25,
    gravityIndex: 0,
    suitState: 'burned',
    color: '#ef4444',
  },
];

export default function Flame3DPage() {
  const [oxygen, setOxygen] = useState(30.0);
  const [airflow, setAirflow] = useState(0.05);
  const [gravityIndex, setGravityIndex] = useState(0);
  const [suitState, setSuitState] = useState('auto');
  const [subjectType, setSubjectType] = useState('astronaut');

  const gravities = [
    { label: '0g ISS', g: 0.0, name: '0.00 g (Microgravity)' },
    { label: '0.166g Moon', g: 0.166, name: '0.166 g (Lunar Regolith)' },
    { label: '0.38g Mars', g: 0.38, name: '0.38 g (Martian Basin)' },
    { label: '1g Earth', g: 1.0, name: '1.00 g (Terrestrial Sea-Level)' },
  ];

  const resetBaseline = () => {
    setOxygen(21.0);
    setAirflow(0.05);
    setGravityIndex(0);
    setSuitState('normal');
  };

  const applyPreset = (preset) => {
    setOxygen(preset.oxygen);
    setAirflow(preset.airflow);
    setGravityIndex(preset.gravityIndex);
    setSuitState(preset.suitState);
  };

  const resolvedSuitState =
    suitState !== 'auto'
      ? suitState
      : oxygen >= 60
        ? 'burned'
        : oxygen >= 25
          ? 'flames'
          : 'normal';

  const zeroG = FLAME_COMPARISON.zeroG;
  const oneG = FLAME_COMPARISON.oneG;
  const activeSubject = SUBJECT_3D_OPTIONS.find((item) => item.id === subjectType) ?? SUBJECT_3D_OPTIONS[0];

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        padding: '20px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: '#060a14',
      }}
    >
      {/* ── Sub-Nav & Calibration Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#4f8ef7', fontSize: '13px' }}>☲</span>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#94a3b8', letterSpacing: '0.5px' }}>
            COMBUSTION MORPHOLOGY // 3D EVA SUIT & FLAME DYNAMICS TESTBENCH
          </span>
        </div>

        {/* One-Click Presets for Normal, Flames, and Burned Suit */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {CHAMBER_PRESETS.map((preset) => {
            const active = resolvedSuitState === preset.suitState;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                style={{
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: active ? 700 : 500,
                  background: active ? `${preset.color}22` : '#111827',
                  border: active ? `1px solid ${preset.color}` : '1px solid #1c2640',
                  color: active ? preset.color : '#cbd5e1',
                  padding: '5px 11px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Three Columns: 0G Flame vs 1G Flame vs 3D EVA Astronaut Suit Test ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '18px' }}>
        {/* ── 01. 3D EVA Astronaut Suit Flammability Chamber ── */}
        <div
          style={{
            background: '#0d1321',
            border: '1px solid #1c2640',
            borderRadius: '8px',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                  3D EVA Astronaut Suit Test
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    color:
                      resolvedSuitState === 'burned'
                        ? '#ef4444'
                        : resolvedSuitState === 'flames'
                          ? '#f59e0b'
                          : '#10b981',
                    background:
                      resolvedSuitState === 'burned'
                        ? 'rgba(239, 68, 68, 0.14)'
                        : resolvedSuitState === 'flames'
                          ? 'rgba(245, 158, 11, 0.14)'
                          : 'rgba(16, 185, 129, 0.14)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {resolvedSuitState === 'burned'
                    ? 'BURNED / CHARRED'
                    : resolvedSuitState === 'flames'
                      ? 'ACTIVE FLAMES'
                      : 'NOMINAL SUIT'}
                </span>
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b', marginTop: '2px' }}>
                {activeSubject.label} Material Response ({oxygen.toFixed(0)}% O₂)
              </div>
            </div>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
              CAM-SUIT-3D
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {SUBJECT_3D_OPTIONS.map((opt) => {
              const active = opt.id === subjectType;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSubjectType(opt.id)}
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    padding: '4px 9px',
                    borderRadius: '5px',
                    border: active ? '1px solid #38bdf8' : '1px solid #1c2640',
                    background: active ? 'rgba(56, 189, 248, 0.14)' : '#080f1c',
                    color: active ? '#e0f2fe' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div
            style={{
              height: '240px',
              borderRadius: '6px',
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid #1c2640',
            }}
          >
            <FlameVisualization
              type={subjectType}
              oxygen={oxygen}
              airflow={airflow}
              suitState={resolvedSuitState}
            />
          </div>

          <p style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.45, margin: 0 }}>
            {resolvedSuitState === 'burned'
              ? 'At ≥50% O₂ (e.g. pure-O₂ EVA suit conditions), rapid flashover chars the outer Ortho-Fabric layer, shatters the visor, and leaves glowing embers.'
              : resolvedSuitState === 'flames'
                ? 'At 26%–49% O₂ (enriched lunar/Mars habitat atmosphere), elevated oxygen partial pressure sustains active flame propagation across the suit.'
                : 'At <26% O₂ (nominal ISS / Earth cabin air), the EVA suit material remains self-extinguishing and nominal.'}
          </p>
        </div>

        {/* ── 02. 0G Flame Panel ── */}
        <div
          style={{
            background: '#0d1321',
            border: '1px solid #1c2640',
            borderRadius: '8px',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                  {zeroG.label}
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    color: '#38bdf8',
                    background: 'rgba(56, 189, 248, 0.12)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {zeroG.isoLabel}
                </span>
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b', marginTop: '2px' }}>
                {zeroG.regime}
              </div>
            </div>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
              {zeroG.cameraId}
            </span>
          </div>

          <div
            style={{
              height: '240px',
              borderRadius: '6px',
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid #1c2640',
            }}
          >
            <FlameVisualization type="spherical" oxygen={oxygen} airflow={airflow} />
          </div>

          <p style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.45, margin: 0 }}>
            {zeroG.description}
          </p>
        </div>

        {/* ── 03. 1G Flame Panel ── */}
        <div
          style={{
            background: '#0d1321',
            border: '1px solid #1c2640',
            borderRadius: '8px',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                  {oneG.label}
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    color: '#f59e0b',
                    background: 'rgba(245, 158, 11, 0.12)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {oneG.isoLabel}
                </span>
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b', marginTop: '2px' }}>
                {oneG.regime}
              </div>
            </div>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
              {oneG.cameraId}
            </span>
          </div>

          <div
            style={{
              height: '240px',
              borderRadius: '6px',
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid #1c2640',
            }}
          >
            <FlameVisualization type="teardrop" oxygen={oxygen} airflow={airflow} />
          </div>

          <p style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.45, margin: 0 }}>
            {oneG.description}
          </p>
        </div>
      </div>

      {/* ── Aerospace Testbench Parameters & Convection Controls ── */}
      <div
        style={{
          background: '#0d1321',
          border: '1px solid #1c2640',
          borderRadius: '8px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
            ⚙ AEROSPACE TESTBENCH PARAMETERS & SUIT STATE CONTROLS
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={resetBaseline}
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                background: '#111827',
                border: '1px solid #1c2640',
                color: '#cbd5e1',
                padding: '4px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ⟳ RESET BASELINE
            </button>
          </div>
        </div>

        {/* 3 Control sliders / pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {/* 01. Oxygen Concentration (15% to 100% so Burned Suit >=50% is reachable via slider too!) */}
          <div style={{ background: '#111827', padding: '12px 14px', borderRadius: '6px', border: '1px solid #1c2640' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
              <span style={{ color: '#64748b' }}>01. OXYGEN CONCENTRATION</span>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>{oxygen.toFixed(1)}% O₂</span>
            </div>
            <input
              type="range"
              min="15"
              max="100"
              step="1"
              value={oxygen}
              onChange={(e) => {
                setOxygen(parseFloat(e.target.value));
                setSuitState('auto');
              }}
              style={{ width: '100%', accentColor: '#38bdf8' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginTop: '4px' }}>
              <span>21% Nominal</span>
              <span>35% Flames</span>
              <span>85% Burned Suit</span>
            </div>
          </div>

          {/* 02. Forced Ventilation (Airflow) */}
          <div style={{ background: '#111827', padding: '12px 14px', borderRadius: '6px', border: '1px solid #1c2640' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
              <span style={{ color: '#64748b' }}>02. FORCED VENTILATION (AIRFLOW)</span>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>{airflow.toFixed(2)} m/s</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.30"
              step="0.01"
              value={airflow}
              onChange={(e) => setAirflow(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#38bdf8' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginTop: '4px' }}>
              <span>0.00 m/s (Still)</span>
              <span>0.05 m/s (Nominal Cabin)</span>
              <span>0.30 m/s (Turbulent)</span>
            </div>
          </div>

          {/* 03. Gravity Vector Field */}
          <div style={{ background: '#111827', padding: '12px 14px', borderRadius: '6px', border: '1px solid #1c2640' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
              <span style={{ color: '#64748b' }}>03. GRAVITY VECTOR FIELD</span>
              <span style={{ color: '#34d399', fontWeight: 700 }}>{gravities[gravityIndex].name}</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              {gravities.map((item, idx) => {
                const active = gravityIndex === idx;
                return (
                  <button
                    key={item.label}
                    onClick={() => setGravityIndex(idx)}
                    style={{
                      flex: 1,
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      padding: '6px 4px',
                      borderRadius: '4px',
                      border: active ? '1px solid #34d399' : '1px solid #1c2640',
                      background: active ? 'rgba(52, 211, 153, 0.15)' : '#0d1321',
                      color: active ? '#34d399' : '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Full FireHazR Lab Panel ── */}
      <FireHazRPage embedded />
    </div>
  );
}
