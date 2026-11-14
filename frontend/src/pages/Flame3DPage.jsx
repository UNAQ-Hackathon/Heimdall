import { useState } from 'react';
import FlameVisualization from '../components/three/FlameVisualization.jsx';
import FireHazRPage from './FireHazRPage.jsx';
import { FLAME_COMPARISON } from '../services/mockData.js';


export default function Flame3DPage() {
  const [oxygen, setOxygen] = useState(30.0);
  const [airflow, setAirflow] = useState(0.05);
  const [gravityIndex, setGravityIndex] = useState(0);

  const gravities = [
    { label: '0g ISS', g: 0.0, name: '0.00 g (Microgravity)' },
    { label: '0.166g Moon', g: 0.166, name: '0.166 g (Lunar Regolith)' },
    { label: '0.38g Mars', g: 0.38, name: '0.38 g (Martian Basin)' },
    { label: '1g Earth', g: 1.0, name: '1.00 g (Terrestrial Sea-Level)' },
  ];

  const resetBaseline = () => {
    setOxygen(30.0);
    setAirflow(0.05);
    setGravityIndex(0);
  };

  const zeroG = FLAME_COMPARISON.zeroG;
  const oneG = FLAME_COMPARISON.oneG;

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: '#060a14',
      }}
    >
      {/* ── Sub-Nav & Calibration Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#4f8ef7', fontSize: '13px' }}>☲</span>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#94a3b8', letterSpacing: '0.5px' }}>
            COMBUSTION MORPHOLOGY // FLAME DYNAMICS EXTINCTION CHAMBER
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              background: '#111827',
              border: '1px solid #1c2640',
              color: '#64748b',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            TELEMETRY SYNTHESIS [BETA-CHAMBER-2]
          </span>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              color: '#f59e0b',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            ● QUALITATIVE ILLUSTRATION — NOT A PHYSICS SIMULATION
          </span>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              background: '#111827',
              border: '1px solid #1c2640',
              color: '#34d399',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            ● INTERACTIVE TESTBENCH // DUAL CHAMBER
          </span>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              background: '#111827',
              border: '1px solid #1c2640',
              color: '#64748b',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            10MM HUD
          </span>
        </div>
      </div>

      {/* ── Two Columns: Microgravity vs Earth Flame ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* ── 0G Flame Panel ── */}
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
          {/* Header */}
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

          {/* Quick Metrics */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#94a3b8',
              background: '#111827',
              padding: '6px 10px',
              borderRadius: '4px',
              border: '1px solid #1c2640',
            }}
          >
            <span>Buoyancy Vector: <strong style={{ color: '#38bdf8' }}>{zeroG.buoyancy}</strong></span>
            <span>Soot Radiation: <strong style={{ color: '#38bdf8' }}>{zeroG.sootRadiation}</strong></span>
            <span>Quenching Zone: <strong style={{ color: '#e2e8f0' }}>{zeroG.quenchingZone}</strong></span>
          </div>

          {/* 3D Flame Canvas Area */}
          <div
            style={{
              height: '240px',
              borderRadius: '6px',
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid #1c2640',
            }}
          >
            {/* Overlay labels */}
            <div
              style={{
                position: 'absolute',
                top: '10px',
                left: '12px',
                zIndex: 10,
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#94a3b8',
                background: 'rgba(13, 19, 33, 0.7)',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              RADIAL EXPANSION: {(17.7 * (oxygen / 30)).toFixed(1)} mm
            </div>
            <div
              style={{
                position: 'absolute',
                top: '10px',
                right: '12px',
                zIndex: 10,
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.1)',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(56, 189, 248, 0.2)',
              }}
            >
              FLOW REGIME: {zeroG.flowRegime}
            </div>

            <FlameVisualization type="spherical" oxygen={oxygen} airflow={airflow} />
          </div>

          {/* Spectral Sub-stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
            <span>● {zeroG.emission}</span>
            <span>SYM-RATIO: {zeroG.symRatio}</span>
          </div>

          {/* Text Description */}
          <p style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.45, margin: 0 }}>
            {zeroG.description}
          </p>

          {/* 3 Columns Stats Bottom */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '8px',
              borderTop: '1px solid #1c2640',
              paddingTop: '10px',
            }}
          >
            <div>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>PEAK CORE TEMP</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#38bdf8' }}>{zeroG.peakCoreTemp}</div>
              <div style={{ fontSize: '9px', color: '#94a3b8' }}>{zeroG.peakLabel}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>QUENCH RADIUS</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>{zeroG.quenchRadius}</div>
              <div style={{ fontSize: '9px', color: '#94a3b8' }}>{zeroG.quenchLabel}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>SPECTRAL MODE</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa' }}>{zeroG.spectralMode}</div>
              <div style={{ fontSize: '9px', color: '#94a3b8' }}>{zeroG.spectralLabel}</div>
            </div>
          </div>
        </div>

        {/* ── 1G Flame Panel ── */}
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
          {/* Header */}
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

          {/* Quick Metrics */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#94a3b8',
              background: '#111827',
              padding: '6px 10px',
              borderRadius: '4px',
              border: '1px solid #1c2640',
            }}
          >
            <span>Buoyancy Vector: <strong style={{ color: '#f59e0b' }}>{oneG.buoyancy}</strong></span>
            <span>Soot Radiation: <strong style={{ color: '#f59e0b' }}>{oneG.sootRadiation}</strong></span>
            <span>Upward Draft: <strong style={{ color: '#e2e8f0' }}>{oneG.upwardDraft}</strong></span>
          </div>

          {/* 3D Flame Canvas Area */}
          <div
            style={{
              height: '240px',
              borderRadius: '6px',
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid #1c2640',
            }}
          >
            {/* Overlay labels */}
            <div
              style={{
                position: 'absolute',
                top: '10px',
                left: '12px',
                zIndex: 10,
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#94a3b8',
                background: 'rgba(13, 19, 33, 0.7)',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              FLAME HEIGHT: {(25.5 * (1 + airflow * 2)).toFixed(1)} mm
            </div>
            <div
              style={{
                position: 'absolute',
                top: '10px',
                right: '12px',
                zIndex: 10,
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.1)',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              }}
            >
              FLOW REGIME: {oneG.flowRegime}
            </div>

            <FlameVisualization type="teardrop" oxygen={oxygen} airflow={airflow} />
          </div>

          {/* Spectral Sub-stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
            <span>● {oneG.emission}</span>
            <span>ASPECT: {oneG.aspectRatio}</span>
          </div>

          {/* Text Description */}
          <p style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.45, margin: 0 }}>
            {oneG.description}
          </p>

          {/* 3 Columns Stats Bottom */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '8px',
              borderTop: '1px solid #1c2640',
              paddingTop: '10px',
            }}
          >
            <div>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>PEAK CORE TEMP</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#f59e0b' }}>{oneG.peakCoreTemp}</div>
              <div style={{ fontSize: '9px', color: '#94a3b8' }}>{oneG.peakLabel}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>FLAME HEIGHT</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>{oneG.flameHeightStat}</div>
              <div style={{ fontSize: '9px', color: '#94a3b8' }}>{oneG.flameHeightLabel}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>ASPECT RATIO</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fb923c' }}>{oneG.aspectRatioStat}</div>
              <div style={{ fontSize: '9px', color: '#94a3b8' }}>{oneG.aspectRatioLabel}</div>
            </div>
          </div>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
            ⚙ AEROSPACE TESTBENCH PARAMETERS & CONVECTION CONTROLS
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
            <button
              onClick={() => alert('Exporting telemetry payload HDF5...')}
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                background: '#4f8ef7',
                border: 'none',
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              📥 EXPORT TELEMETRY (HDF5)
            </button>
          </div>
        </div>

        {/* 3 Control sliders / pills */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '16px' }}>
          {/* 01. Oxygen Concentration */}
          <div style={{ background: '#111827', padding: '12px 14px', borderRadius: '6px', border: '1px solid #1c2640' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
              <span style={{ color: '#64748b' }}>01. OXYGEN CONCENTRATION</span>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>{oxygen.toFixed(1)}% O₂</span>
            </div>
            <input
              type="range"
              min="15"
              max="40"
              step="0.5"
              value={oxygen}
              onChange={(e) => setOxygen(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#38bdf8' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginTop: '4px' }}>
              <span>15.0% (Hypoxic)</span>
              <span>30.0% (Lunar/Spacecraft)</span>
              <span>40.0% (Max)</span>
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

        {/* Status Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: '#64748b',
            borderTop: '1px solid #1c2640',
            paddingTop: '8px',
          }}
        >
          <span>● QUALITATIVE ILLUSTRATION — NOT A PHYSICS SIMULATION</span>
          <span>BOUNDED REGIME: MICRO-G (0g) ↔ 1G</span>
          <span>PARTIAL-G PROXY: E-FIELD FLAMES (ACME) · MAX O₂: CFI-G (85%)</span>
        </div>
      </div>

      {/* ── Full What-If Scenario Test Panel ── */}
      <FireHazRPage />
    </div>
  );
}
