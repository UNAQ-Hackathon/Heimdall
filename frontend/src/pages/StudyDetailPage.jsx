import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FlammabilityChart from '../components/charts/FlammabilityChart.jsx';
import TimeSeriesChart from '../components/charts/TimeSeriesChart.jsx';
import { INVESTIGATIONS, api } from '../services/mockData.js';
import { useApp } from '../context/AppContext.jsx';

export default function StudyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { audience } = useApp();
  const [study, setStudy] = useState(null);
  const [overlay1g, setOverlay1g] = useState(false);

  useEffect(() => {
    const found = INVESTIGATIONS.find((item) => item.id === id) || INVESTIGATIONS[0];
    setStudy(found);
  }, [id]);

  if (!study) {
    return <div style={{ padding: '40px', color: '#8892a8' }}>Loading study telemetry...</div>;
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        background: '#060a14',
      }}
    >
      {/* ── Top Header Area ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: '#4f8ef7',
              letterSpacing: '0.8px',
              marginBottom: '6px',
            }}
          >
            DATASET ARCHIVE // {study.archiveCode || 'EXP-SAFFIRE-03'} · {study.vehicle || 'Cygnus OA-5 Mission'} · MET:{' '}
            {study.missionDuration || '+142:08:14'}
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px 0' }}>
            {study.name}: {study.subtitle}
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '800px' }}>
            {study.description}
          </p>

          {/* Tags */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                background: '#111827',
                border: '1px solid #1c2640',
                color: '#cbd5e1',
                padding: '3px 8px',
                borderRadius: '4px',
              }}
            >
              PMMA Solid Sample (0.4m × 1.0m)
            </span>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                background: '#111827',
                border: '1px solid #1c2640',
                color: '#cbd5e1',
                padding: '3px 8px',
                borderRadius: '4px',
              }}
            >
              Microgravity (10⁻⁴ g)
            </span>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                background: '#111827',
                border: '1px solid #1c2640',
                color: '#cbd5e1',
                padding: '3px 8px',
                borderRadius: '4px',
              }}
            >
              Forced Convection Duct
            </span>
          </div>
        </div>

        {/* Verified badge */}
        <div
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: '#34d399',
            background: 'rgba(52, 211, 153, 0.1)',
            border: '1px solid rgba(52, 211, 153, 0.25)',
            padding: '6px 12px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>●</span> {study.verifiedLabel || 'VERIFIED FLIGHT DATA (NASA GLENN RC)'}
        </div>
      </div>

      {/* ── Upper Grid: AI Synthesis + Flammability Boundary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left: AI Synthesis */}
        <div
          style={{
            background: '#0d1321',
            border: '1px solid #1c2640',
            borderRadius: '8px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.5px' }}>
              ✦ AI SYNTHESIS // EXTRACTED METRIC ENVELOPE
            </span>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#a78bfa',
                background: 'rgba(167, 139, 250, 0.1)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(167, 139, 250, 0.2)',
              }}
            >
              Confidence: {study.confidence || 96}%
            </span>
          </div>

          {/* 4 Quadrants */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: '#111827', padding: '10px 12px', borderRadius: '6px', border: '1px solid #1c2640' }}>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '4px' }}>
                01 // MISSION OBJECTIVE
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                {study.synthesis?.missionObjective || 'Investigate flame spread limits on practical-thickness PMMA slabs.'}
              </div>
            </div>

            <div style={{ background: '#111827', padding: '10px 12px', borderRadius: '6px', border: '1px solid #1c2640' }}>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '4px' }}>
                02 // FUEL & GEOMETRY
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                {study.synthesis?.fuelAndGeometry || 'PMMA, 50mm thick, 0.4 × 1.0 m sheet along axial flow tunnel.'}
              </div>
            </div>

            <div style={{ background: '#111827', padding: '10px 12px', borderRadius: '6px', border: '1px solid #1c2640' }}>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '4px' }}>
                03 // TEST CONDITIONS
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                {study.synthesis?.testConditions || 'O₂: 21% → 34% | Total P: 78 kPa (10.2 psi) | Forced Flow: 0.05 to 0.20 m/s.'}
              </div>
            </div>

            <div style={{ background: '#111827', padding: '10px 12px', borderRadius: '6px', border: '1px solid #1c2640' }}>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '4px' }}>
                04 // TELEMETRY ARRAY
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                {study.synthesis?.telemetryArray || '6 calibrated radiometers, 24 thermocouple arrays (Type K), high-speed dual UV/IR.'}
              </div>
            </div>
          </div>

          {/* Heimdall Insight callout */}
          <div
            style={{
              background: 'rgba(79, 142, 247, 0.08)',
              border: '1px solid rgba(79, 142, 247, 0.25)',
              borderRadius: '6px',
              padding: '10px 14px',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            }}
          >
            <span style={{ color: '#4f8ef7', fontSize: '14px' }}>⚡</span>
            <div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4f8ef7', marginBottom: '2px' }}>
                HEIMDALL INSIGHT:
              </div>
              <div style={{ fontSize: '11.5px', color: '#e2e8f0', lineHeight: 1.45 }}>
                {study.aiInsight}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Flammability Boundary Map */}
        <div
          style={{
            background: '#0d1321',
            border: '1px solid #1c2640',
            borderRadius: '8px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                REGIME FLAMMABILITY BOUNDARY (O₂ VS. FLOW VELOCITY)
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                Microgravity Regime Map · PMMA Concurrent Spread Limit Analysis
              </div>
            </div>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#34d399',
                background: 'rgba(52, 211, 153, 0.1)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              ● ACTIVE REGIME: CONCURRENT DUCT
            </span>
          </div>

          <FlammabilityChart />
        </div>
      </div>

      {/* ── Lower Grid: Time Series + Extrapolation Notice ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
        {/* Left: Time Series Chart */}
        <div
          style={{
            background: '#0d1321',
            border: '1px solid #1c2640',
            borderRadius: '8px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                RADIANT FLUX & PYROLYSIS TEMPERATURE VS TIME
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                Run ID: SF3-TC-RUN04 · Sample Rate: 10 Hz · Synchronized PIM Audio/Video
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: '#38bdf8' }}>— TC Array [0-12] (°C)</span>
              <span style={{ color: '#fb7185' }}>-- Radiant Flux (kW/m²)</span>
            </div>
          </div>

          <TimeSeriesChart />

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
            <span>• Dual-spectrum radiometer R2 aligned at 0.5m downstream</span>
            <span>Sampling Interval: 100ms ± 0.2ms</span>
          </div>
        </div>

        {/* Right: Extrapolation Warning & Simulation CTAs */}
        <div
          style={{
            background: '#0d1321',
            border: '1px solid #1c2640',
            borderRadius: '8px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: '#f59e0b', fontSize: '16px' }}>⚠</span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f59e0b' }}>
                SCIENTIFIC NOTICE // REDUCED-GRAVITY EXTRAPOLATION BOUNDARY
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
              Extrapolating 0g Cygnus flight data to Lunar (0.166g) introduces buoyant convection vectors absent in Saffire-III.
              Saffire results represent the upper flammability limit; real lunar flame spread is bounded between 0g (Saffire)
              and 1g (terrestrial standard NASA-STD-6001).
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => alert('Exporting HDF5 / CSV archive...')}
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                background: '#111827',
                border: '1px solid #1c2640',
                color: '#e2e8f0',
                padding: '8px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              📥 Download Raw Telemetry (HDF5 / CSV)
            </button>

            <button
              onClick={() => navigate('/flame-3d')}
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                background: '#4f8ef7',
                border: 'none',
                color: '#ffffff',
                padding: '9px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>⚡ Send Boundary to 3D Flame Simulation</span>
              <span>→</span>
            </button>

            <button
              onClick={() => setOverlay1g(!overlay1g)}
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                background: overlay1g ? 'rgba(251, 113, 133, 0.15)' : '#111827',
                border: overlay1g ? '1px solid #fb7185' : '1px solid #1c2640',
                color: overlay1g ? '#fb7185' : '#8892a8',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {overlay1g ? '✓ OVERLAYING TERRESTRIAL 1G BASELINE' : '● OVERLAY TERRESTRIAL 1G BASELINE'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Page Footer ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          color: '#64748b',
          borderTop: '1px solid #1c2640',
          paddingTop: '14px',
        }}
      >
        <span>
          FLIGHT LOG: {study.flightLog || 'NASA-CR-2017-SAFFIRE3'} &nbsp; CALIBRATION PROTOCOL:{' '}
          {study.calibrationProtocol || 'GRC-MICRO-FLAME-04'}
        </span>
        <span style={{ color: '#34d399' }}>● Heimdall Neural Model v4.12 · Bayesian Boundary Convergence: 99.4%</span>
      </div>
    </div>
  );
}
