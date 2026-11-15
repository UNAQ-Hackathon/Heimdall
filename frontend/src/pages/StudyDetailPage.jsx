import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FlammabilityChart from '../components/charts/FlammabilityChart.jsx';
import TimeSeriesChart from '../components/charts/TimeSeriesChart.jsx';
import { INVESTIGATIONS } from '../services/mockData.js';
import { api } from '../services/api.js';

const cardStyle = {
  background: '#0d1321',
  border: '1px solid #1c2640',
  borderRadius: '8px',
  padding: '18px 20px',
};

function formatOxygen(conditions = {}) {
  const min = conditions.oxygenMinPct ?? conditions.oxygenPct ?? conditions.oxygenMaxPct;
  const max = conditions.oxygenMaxPct ?? conditions.oxygenPct ?? conditions.oxygenMinPct;
  if (min == null && max == null) return 'Not reported';
  return min !== max ? `${min}%–${max}%` : `${min}%`;
}

function getTelemetrySeries(series = []) {
  const temperature = series.find((item) => /temp|thermocouple/i.test(item.name ?? ''));
  const radiantFlux = series.find((item) => /flux|radiant|heat/i.test(item.name ?? ''));
  const matched = [
    temperature && { series: temperature, key: 'tc' },
    radiantFlux && { series: radiantFlux, key: 'flux' },
  ].filter(Boolean);
  const pointsByTime = new Map();

  matched.forEach(({ series: telemetry, key }) => {
    telemetry.samples?.forEach((sample) => {
      if (!Array.isArray(sample) || sample.length < 2) return;
      const time = Number(sample[0]);
      const value = Number(sample[1]);
      if (!Number.isFinite(time) || !Number.isFinite(value)) return;
      const point = pointsByTime.get(time) ?? { time };
      point[key] = value;
      pointsByTime.set(time, point);
    });
  });

  const data = [...pointsByTime.values()].sort((a, b) => a.time - b.time);
  return data.length ? { data } : null;
}

function MetricCard({ label, value, detail }) {
  return (
    <div
      style={{
        background: '#0d1321',
        border: '1px solid #1c2640',
        borderRadius: '8px',
        padding: '14px 16px',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', lineHeight: 1.15 }}>{value}</div>
      {detail && <div style={{ fontSize: '10px', color: '#8892a8', marginTop: '5px' }}>{detail}</div>}
    </div>
  );
}

function SpecCard({ label, children }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1c2640', borderRadius: '6px', padding: '14px 16px' }}>
      <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '7px' }}>
        {label}
      </div>
      <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

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
      ) || null
  );
  const [loadError, setLoadError] = useState('');
  const [overlay1g, setOverlay1g] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError('');
    api.getInvestigation(id).then((doc) => {
      if (!cancelled && doc) setStudy(doc);
    }).catch((error) => {
      if (!cancelled) setLoadError(error.message);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loadError && !study) {
    return <div style={{ padding: '40px', color: '#fb7185' }}>Unable to load study: {loadError}</div>;
  }
  if (!study) {
    return <div style={{ padding: '40px', color: '#8892a8' }}>Loading study telemetry...</div>;
  }

  const conditions = study.conditions ?? {};
  const gravity = String(study.gravityLevel ?? 'Not reported').replace('-', ' ');
  const sourceUrl = study.sourceUrl ?? 'https://psi.nasa.gov/';
  const telemetryData = getTelemetrySeries(study.series);

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        padding: '24px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        background: '#060a14',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#4f8ef7', letterSpacing: '0.8px', marginBottom: '6px' }}>
            NASA PSI ARCHIVE // {study.psiId ?? study.archiveCode}
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px' }}>
            {study.acronym ?? study.name}: {study.title ?? study.subtitle}
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
            Verified experimental record · {study.category ?? 'combustion study'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate('/studies')}
            style={{
              fontSize: '10.5px',
              fontFamily: 'var(--font-mono)',
              color: '#cbd5e1',
              background: '#111827',
              border: '1px solid #1e293b',
              padding: '7px 11px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            ← PSI Catalog
          </button>
          <select
            aria-label="Select PSI Investigation"
            className="tri-select"
            value={study.id}
            onChange={(event) => navigate(`/study/${event.target.value}`)}
            style={{ border: '1px solid #1e293b', color: '#e2e8f0', fontSize: '11.5px', padding: '7px 10px', borderRadius: '4px' }}
          >
            {INVESTIGATIONS.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.acronym} — {inv.title}
              </option>
            ))}
          </select>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '7px 10px',
              borderRadius: '4px',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            NASA PSI ↗
          </a>
        </div>
      </header>

      <section aria-label="Critical experimental conditions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '12px' }}>
        <MetricCard label="O₂ CONCENTRATION" value={formatOxygen(conditions)} detail="Measured test envelope" />
        <MetricCard label="PRESSURE" value={conditions.pressurePsi == null ? 'Not reported' : `${conditions.pressurePsi} psi`} detail={conditions.ambient} />
        <MetricCard label="FLOW" value={conditions.flowVelocity == null ? 'Not reported' : `${conditions.flowVelocity} m/s`} detail="Forced ventilation" />
        <MetricCard label="GRAVITY REGIME" value={gravity} detail="As recorded in PSI" />
      </section>

      <section aria-label="Study charts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 430px), 1fr))', gap: '16px' }}>
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
              ILLUSTRATIVE FLAMMABILITY ENVELOPE (O₂ VS. FLOW)
            </div>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
              Schematic curves · Not study-specific measurements
            </div>
          </div>
          <FlammabilityChart />
        </div>

        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                {telemetryData ? 'MEASURED TELEMETRY PROFILE' : 'ILLUSTRATIVE TELEMETRY PROFILE'}
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                {telemetryData
                  ? `Record series: ${study.variables?.join(', ') || 'temperature / radiant flux'}`
                  : 'No matching measured series; showing illustrative profile'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '10px', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
              <span style={{ color: '#38bdf8' }}>— Temperature (°C)</span>
              <span style={{ color: '#fb7185' }}>-- Radiant Flux (kW/m²)</span>
            </div>
          </div>
          <TimeSeriesChart data={telemetryData ?? undefined} />
        </div>
      </section>

      <section style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#38bdf8', marginBottom: '4px' }}>
            PSI RECORD METADATA // VERIFIED EXPERIMENTAL ENVELOPE
          </div>
          <h2 style={{ fontSize: '16px', color: '#f8fafc', margin: 0 }}>Study specifications</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))', gap: '10px' }}>
          <SpecCard label="MISSION OBJECTIVE">{study.objective ?? study.synthesis?.missionObjective ?? 'Not reported in PSI record.'}</SpecCard>
          <SpecCard label="FUEL & GEOMETRY">{study.fuel ?? study.synthesis?.fuelAndGeometry ?? 'Not reported in PSI record.'}</SpecCard>
          <SpecCard label="HARDWARE / TESTBED">{study.hardware ?? 'Not reported in PSI record.'}</SpecCard>
          <SpecCard label="SENSORS">{study.sensors?.length ? study.sensors.join(' · ') : 'Not reported in PSI record.'}</SpecCard>
          <SpecCard label="MEASURED VARIABLES">{study.variables?.length ? study.variables.join(' · ') : 'Not reported in PSI record.'}</SpecCard>
          {study.earthApplications?.length > 0 && (
            <SpecCard label="EARTH SPIN-OFF APPLICATIONS">{study.earthApplications.join(' · ')}</SpecCard>
          )}
        </div>
        {study.aiInsight && (
          <div style={{ background: 'rgba(79, 142, 247, 0.08)', border: '1px solid rgba(79, 142, 247, 0.25)', borderRadius: '6px', padding: '10px 14px' }}>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4f8ef7', marginBottom: '4px' }}>
              HEIMDALL INSIGHT
            </div>
            <div style={{ fontSize: '11.5px', color: '#e2e8f0', lineHeight: 1.45 }}>{study.aiInsight}</div>
          </div>
        )}
      </section>

      <section style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '850px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '7px' }}>
            <span style={{ color: '#f59e0b', fontSize: '16px' }}>⚠</span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f59e0b' }}>
              SCIENTIFIC NOTICE // PARTIAL-GRAVITY BOUNDARIES (0G ↔ 1G)
            </span>
          </div>
          <p style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
            PSI contains no direct partial-gravity (0.165g Moon or 0.38g Mars) data. Habitat results are bounded between microgravity and 1g baselines; E-FIELD Flames is an experimental body-force proxy.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/flame-3d')}
            style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600, background: '#4f8ef7', border: 'none', color: '#fff', padding: '9px 12px', borderRadius: '6px', cursor: 'pointer' }}
          >
            Open What-If & 3D Testbench →
          </button>
          <button
            onClick={() => setOverlay1g(!overlay1g)}
            aria-pressed={overlay1g}
            style={{
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              background: overlay1g ? 'rgba(251, 113, 133, 0.15)' : '#111827',
              border: overlay1g ? '1px solid #fb7185' : '1px solid #1c2640',
              color: overlay1g ? '#fb7185' : '#8892a8',
              padding: '8px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {overlay1g ? '✓ 1G BASELINE BOUND' : 'COMPARE WITH 1G'}
          </button>
        </div>
      </section>
    </div>
  );
}
