import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FlammabilityChart from '../components/charts/FlammabilityChart.jsx';
import TimeSeriesChart from '../components/charts/TimeSeriesChart.jsx';
import { INVESTIGATIONS } from '../services/mockData.js';
import { api } from '../services/api.js';

export default function StudyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [study, setStudy] = useState(
    () =>
      INVESTIGATIONS.find(
        (item) =>
          item.id === id ||
          String(item.psiId ?? '').toLowerCase() === String(id ?? '').toLowerCase() ||
          String(item.acronym ?? '').toLowerCase() === String(id ?? '').toLowerCase()
      ) || INVESTIGATIONS[0]
  );
  const [overlay1g, setOverlay1g] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getInvestigation(id).then((doc) => {
      if (!cancelled && doc) setStudy(doc);
    });
    return () => {
      cancelled = true;
    };
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
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
            NASA PSI ARCHIVE // {study.psiId ?? study.archiveCode} · HARDWARE: {study.hardware ?? 'ISS Facility'} · CATEGORY:{' '}
            {(study.category ?? 'prevention').toUpperCase()}
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px 0' }}>
            {study.acronym ?? study.name}: {study.title ?? study.subtitle}
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '800px' }}>
            {study.objective ?? study.description}
          </p>

          {/* Tags */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
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
              Fuel: {study.fuel ?? 'null'}
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
              Gravity: {study.gravityLevel}
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
              Hardware: {study.hardware ?? 'null'}
            </span>
            <a
              href={study.sourceUrl ?? 'https://psi.nasa.gov/'}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38bdf8',
                padding: '3px 8px',
                borderRadius: '4px',
                textDecoration: 'none',
              }}
            >
              Source: {study.sourceUrl ?? 'https://psi.nasa.gov/'} ↗
            </a>
          </div>
        </div>

        {/* Study switcher & Verified badge */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
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
            <span>●</span> {study.verifiedLabel || 'NASA PSI ARCHIVE RECORD'}
          </div>
          <select
            aria-label="Select PSI Investigation"
            className="tri-select"
            value={study.id}
            onChange={(e) => navigate(`/study/${e.target.value}`)}
            style={{
              border: '1px solid #1e293b',
              color: '#e2e8f0',
              fontSize: '11.5px',
              padding: '5px 10px',
              borderRadius: '4px',
            }}
          >
            {INVESTIGATIONS.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.acronym} — {inv.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Upper Grid: Extracted PSI Metadata + Flammability Boundary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left: PSI Record Envelope */}
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
              ✦ PSI RECORD METADATA // VERIFIED EXPERIMENTAL ENVELOPE
            </span>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.1)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(56, 189, 248, 0.2)',
              }}
            >
              {study.psiId}
            </span>
          </div>

          {/* 4 Quadrants */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: '#111827', padding: '10px 12px', borderRadius: '6px', border: '1px solid #1c2640' }}>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '4px' }}>
                01 // MISSION OBJECTIVE
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                {study.synthesis?.missionObjective}
              </div>
            </div>

            <div style={{ background: '#111827', padding: '10px 12px', borderRadius: '6px', border: '1px solid #1c2640' }}>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '4px' }}>
                02 // FUEL & HARDWARE
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                {study.synthesis?.fuelAndGeometry} ({study.hardware ?? 'null'})
              </div>
            </div>

            <div style={{ background: '#111827', padding: '10px 12px', borderRadius: '6px', border: '1px solid #1c2640' }}>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '4px' }}>
                03 // MEASURED CONDITIONS
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4, fontFamily: 'var(--font-mono)' }}>
                O₂: {study.conditions?.oxygenPct ?? 'null'}% | P: {study.conditions?.pressurePsi ?? 'null'} psi | Flow:{' '}
                {study.conditions?.flowVelocity ?? 'null'} m/s
              </div>
            </div>

            <div style={{ background: '#111827', padding: '10px 12px', borderRadius: '6px', border: '1px solid #1c2640' }}>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '4px' }}>
                04 // SENSORS & VARIABLES
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                Sensors: {study.sensors?.join(', ') || 'null'}
              </div>
            </div>
          </div>

          {/* Earth Applications */}
          {study.earthApplications?.length > 0 && (
            <div
              style={{
                background: 'rgba(52, 211, 153, 0.08)',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                borderRadius: '6px',
                padding: '10px 14px',
                fontSize: '11.5px',
                color: '#d1fae5',
              }}
            >
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#34d399', display: 'block', marginBottom: '2px' }}>
                EARTH SPIN-OFF APPLICATIONS:
              </strong>
              {study.earthApplications.join(' · ')}
            </div>
          )}

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
                Microgravity Regime Map · Bounded Envelope Analysis
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
              ● BOUNDED INTERPOLATION
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
                ILLUSTRATIVE TELEMETRY PROFILE (TEMPERATURE & RADIANT FLUX)
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                Variables tracked: {study.variables?.join(', ') || 'None'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: '#38bdf8' }}>— Temperature (°C)</span>
              <span style={{ color: '#fb7185' }}>-- Radiant Flux (kW/m²)</span>
            </div>
          </div>

          <TimeSeriesChart />
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
                SCIENTIFIC NOTICE // PARTIAL-GRAVITY BOUNDARIES (0G ↔ 1G)
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
              PSI contains no direct partial-gravity (0.165g Moon or 0.38g Mars) data. Results for lunar and Martian habitats are presented strictly as a bounded range between microgravity and 1g baselines. E-FIELD Flames (ACME) serves as a partial-gravity body-force proxy, and CFI-G (ACME) provides the highest-O₂ tests (up to 85% O₂ from the burner).
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
              <span>⚡ Open Interactive What-If & 3D Flame Testbench</span>
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
              {overlay1g ? '✓ COMPARING WITH 1G BASELINE BOUND' : '● COMPARE WITH 1G BASELINE BOUND'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
