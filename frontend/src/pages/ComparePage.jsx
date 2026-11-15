import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COMPARISON_MATRIX, CROSS_FINDINGS, EARTH_APPLICATIONS } from '../services/mockData.js';
import { api } from '../services/api.js';
import AppArchitectureMindMap from '../components/ui/AppArchitectureMindMap.jsx';

const panelStyle = {
  background: '#0d1321',
  border: '1px solid #1c2640',
  borderRadius: '8px',
  overflow: 'hidden',
};

function normalizeKey(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getComparisonRecord(row, investigations) {
  const name = normalizeKey(row.name);
  const id = normalizeKey(row.id);
  return investigations.find((item) => {
    const acronym = normalizeKey(item.acronym);
    const psiId = normalizeKey(item.psiId);
    return acronym === name || acronym === id || psiId.endsWith(id);
  });
}

function formatOxygenRange(conditions = {}) {
  const min = conditions.oxygenMinPct ?? conditions.oxygenPct ?? conditions.oxygenMaxPct;
  const max = conditions.oxygenMaxPct ?? conditions.oxygenPct ?? conditions.oxygenMinPct;
  if (min == null && max == null) return null;
  return min !== max ? `${min}% → ${max}% O₂ (nominal ${conditions.oxygenPct ?? max}%)` : `${min}% O₂`;
}

const FINDING_SUMMARIES = [
  {
    badge: 'Gravity Bounds',
    accent: '#38bdf8',
    summary: '0g and 1g experiments bracket intermediate Moon (0.165g) and Mars (0.38g) fire risk.',
    bullets: [
      'No partial-gravity PSI datasets exist yet (LUCI / FM2 pending).',
      'Microgravity (0g) & Earth (1g) act as safety bounds.',
      'E-FIELD Flames mimics gravity forces using electric fields.',
    ],
  },
  {
    badge: 'Oxygen Regimes',
    accent: '#f59e0b',
    summary: 'Moon habitats use ~30%+ O2 at reduced pressure (≤10.2 psi), raising material flammability.',
    bullets: [
      'Spacesuits run 100% O2 at 4.3 psi; ISS stays near 21% O2 / 14.7 psi.',
      'Higher O2 reduces astronaut pre-breathing time before EVAs.',
      'PSI high-O2 tests (up to 85% in CFI-G) map ignition margins.',
    ],
  },
  {
    badge: 'Hardware & Fuel',
    accent: '#34d399',
    summary: 'Modular ISS racks let researchers compare solid, liquid, and gas flames on shared rigs.',
    bullets: [
      'CIR / MDCA: FLEX, FLEX-2, and CFI liquid droplet tests.',
      'CIR / ACME: 6 gaseous flame studies using modular hardware.',
      'MSG Flow Duct: BASS, BASS-II, SPICE, and SLICE solid/gas tests.',
    ],
  },
];

const EARTH_SUMMARY_MAP = {
  'water-mist': {
    badge: 'Fire Suppression',
    accent: '#38bdf8',
    summary: 'Microgravity droplet kinetics power cleaner fine-water-mist extinguishers on Earth.',
    bullets: [
      'Replaces ozone-depleting halon systems.',
      'Fine mist absorbs heat quickly with minimal water damage.',
    ],
  },
  'smoke-detection': {
    badge: 'Smoke Detection',
    accent: '#a78bfa',
    summary: 'ISS aerosol light-scattering studies cut false alarms in smart terrestrial detectors.',
    bullets: [
      'Distinguishes toxic smoke from dust or steam aerosols.',
      'Derived from SAME, SAME-R, and DAFT optical instruments.',
    ],
  },
  'material-screening': {
    badge: 'Material Flammability',
    accent: '#34d399',
    summary: 'Zero-buoyancy burn tests guide flame-resistant textiles for firefighters and hospitals.',
    bullets: [
      'Tests true flammability limits without upward heat drafts.',
      'Grounded in BASS, BASS-II, and Saffire solid-fuel metrics.',
    ],
  },
};

export default function ComparePage() {
  const [highlightDiff, setHighlightDiff] = useState(true);
  const [investigations, setInvestigations] = useState([]);
  const [dataSource, setDataSource] = useState('loading');
  const spinoffSectionRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api.listInvestigations().then((result) => {
      if (cancelled) return;
      setInvestigations(result.items ?? []);
      setDataSource(result.source ?? 'api');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollToSpinoff = () => {
    spinoffSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleExportCsv = () => {
    const headers = [
      'Study',
      'Testbed',
      'Orbit',
      'Oxygen Range',
      'Ambient Pressure',
      'Fuel',
      'Key Behavior',
    ];
    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = COMPARISON_MATRIX.studies.map((study) => [
      study.name,
      study.testbed,
      study.orbit,
      study.o2Range,
      study.pressure,
      study.fuel,
      study.behavior,
    ]);
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nasa-psi-comparison-matrix.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
        gap: '24px',
        background: '#060a14',
      }}
    >
      {/* ── Top Header Bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            aria-hidden="true"
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '9999px',
              background: '#38bdf8',
              boxShadow: '0 0 8px rgba(56, 189, 248, 0.7)',
            }}
          />
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#8892a8' }}>
            EARTH COMPARISON &amp; SYSTEM ARCHITECTURE // NASA PSI ARCHIVE
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
          <span
            style={{
              background: '#111827',
              border: '1px solid #1c2640',
              padding: '3px 8px',
              borderRadius: '4px',
              color: '#34d399',
            }}
          >
            STUDENT MIND MAP
          </span>
          <span
            style={{
              background: '#111827',
              border: '1px solid #1c2640',
              padding: '3px 8px',
              borderRadius: '4px',
              color: '#8892a8',
            }}
          >
            SPACE-TO-EARTH TRANSFER
          </span>
        </div>
      </div>

      {/* ── Interactive Animated App Architecture & Science Mind Map ── */}
      <AppArchitectureMindMap onJumpToSection={scrollToSpinoff} />

      {/* ── Matrix Section Title ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#38bdf8', marginBottom: '4px' }}>
            CORRELATED SPACE FLIGHT ARCHIVES · PSI STUDY COMPARISON
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px 0' }}>
            MICROGRAVITY EXPERIMENT COMPARISON MATRIX
          </h1>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, maxWidth: '800px' }}>
            Parametric variance highlighting critical flammability boundary deviations in oxygen concentration,
            atmospheric pressure, and combustion fuel geometry.
          </p>
        </div>

        <button
          onClick={() => setHighlightDiff(!highlightDiff)}
          aria-pressed={highlightDiff}
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            background: highlightDiff ? 'rgba(56, 189, 248, 0.12)' : '#111827',
            border: highlightDiff ? '1px solid #38bdf8' : '1px solid #1c2640',
            color: highlightDiff ? '#38bdf8' : '#8892a8',
            padding: '5px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          Highlight differences
        </button>
      </div>

      {/* ── Comparison Matrix Table ── */}
      <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '-16px' }}>
        {dataSource === 'loading'
          ? 'LOADING PSI RECORDS…'
          : dataSource === 'api'
            ? 'STUDY CONDITIONS: API RECORDS'
            : 'STUDY CONDITIONS: LOCAL PROCESSED PSI FALLBACK'}
      </div>
      <div
        style={{
          background: '#0d1321',
          border: '1px solid #1c2640',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#111827', borderBottom: '1px solid #1c2640' }}>
              <th style={{ padding: '12px 16px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                STUDY & TESTBED
              </th>
              <th style={{ padding: '12px 16px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                OXYGEN CONC. (% O₂)
              </th>
              <th style={{ padding: '12px 16px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                AMBIENT PRESSURE
              </th>
              <th style={{ padding: '12px 16px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                FUEL & GEOMETRY
              </th>
              <th style={{ padding: '12px 16px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                CRITICAL REGIME BEHAVIOR
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_MATRIX.studies.map((study, idx) => {
              const record = getComparisonRecord(study, investigations);
              const conditions = record?.conditions ?? {};
              const oxygenRange = record ? formatOxygenRange(conditions) : null;
              return (
              <tr
                key={study.id}
                style={{
                  borderBottom: idx < COMPARISON_MATRIX.studies.length - 1 ? '1px solid #1c2640' : 'none',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(17, 24, 39, 0.4)',
                }}
              >
                {/* Col 1 */}
                <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => navigate(`/study/${study.id}`)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#f8fafc',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {study.name}
                    </button>
                    {study.tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: '9px',
                          fontFamily: 'var(--font-mono)',
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          color: '#38bdf8',
                          padding: '1px 5px',
                          borderRadius: '3px',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{record?.hardware ?? study.testbed}</div>
                  <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginTop: '2px' }}>
                    {study.orbit}
                  </div>
                </td>

                {/* Col 2 */}
                <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 700, color: highlightDiff ? '#38bdf8' : '#e2e8f0', fontFamily: 'var(--font-mono)' }}>
                    {oxygenRange ?? study.o2Range}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>{study.o2Note}</div>
                </td>

                {/* Col 3 */}
                <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 700, color: highlightDiff ? '#fb7185' : '#e2e8f0', fontFamily: 'var(--font-mono)' }}>
                    {conditions.pressurePsi == null ? study.pressure : `${conditions.pressurePsi} psi`}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>{study.pressureNote}</div>
                </td>

                {/* Col 4 */}
                <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>{record?.fuel ?? study.fuel}</div>
                  {!record && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{study.fuelNote}</div>}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                    {study.fuelTags.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: '9px',
                          fontFamily: 'var(--font-mono)',
                          background: '#111827',
                          border: '1px solid #1c2640',
                          color: '#a78bfa',
                          padding: '1px 5px',
                          borderRadius: '3px',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </td>

                {/* Col 5 */}
                <td style={{ padding: '14px 16px', verticalAlign: 'top', maxWidth: '300px' }}>
                  <div style={{ color: '#cbd5e1', lineHeight: 1.4 }}>{record?.objective ?? study.behavior}</div>
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#f59e0b', marginTop: '4px' }}>
                    {study.behaviorNote}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '14px', color: '#f8fafc', margin: 0 }}>Cross-study findings</h2>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
            HOVER OR FOCUS A CARD FOR KEY DETAILS
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '10px', alignItems: 'start' }}>
          {CROSS_FINDINGS.map((finding, idx) => {
            const id = `finding-${idx}`;
            const meta = FINDING_SUMMARIES[idx] ?? {
              badge: 'Insight',
              accent: '#38bdf8',
              summary: finding.text,
              bullets: [],
            };
            return (
              <article
                key={id}
                tabIndex={0}
                className="compare-hover-card"
                style={{ ...panelStyle, '--card-accent': meta.accent, padding: '14px 16px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: meta.accent, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>{finding.title}</span>
                  </span>
                  <span
                    style={{
                      fontSize: '9px',
                      fontFamily: 'var(--font-mono)',
                      color: meta.accent,
                      background: `${meta.accent}18`,
                      border: `1px solid ${meta.accent}44`,
                      borderRadius: '4px',
                      padding: '3px 7px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {meta.badge}
                  </span>
                </div>

                <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
                  {meta.summary}
                </p>

                <div className="compare-hover-card__hint" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b', marginTop: '8px' }}>
                  Hover to inspect breakdown
                </div>

                <div className="compare-hover-card__body">
                  <div className="compare-hover-card__inner">
                    <ul style={{ margin: '10px 0 0', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {meta.bullets.map((bullet) => (
                        <li key={bullet} style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.45 }}>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Earth Spin-Off Applications Section ── */}
      <div ref={spinoffSectionRef}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#34d399', marginBottom: '2px' }}>
              TERRESTRIAL TECHNOLOGY DEPLOYMENT · NASA TECHNOLOGY TRANSFER
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              EARTH SPIN-OFF APPLICATIONS
            </h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
              How microgravity combustion research improves everyday fire protection on Earth. Hover any card to view metrics.
            </p>
          </div>

          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
            HOVER CARDS FOR KEY METRICS
          </div>
        </div>

        {/* 3 Spin-Off Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '10px', alignItems: 'start' }}>
          {EARTH_APPLICATIONS.map((app) => {
            const meta = EARTH_SUMMARY_MAP[app.id] ?? {
              badge: app.category || 'Spin-Off',
              accent: '#34d399',
              summary: app.description,
              bullets: [],
            };
            return (
              <article
                key={app.id}
                tabIndex={0}
                className="compare-hover-card"
                style={{ ...panelStyle, '--card-accent': meta.accent, padding: '14px 16px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: meta.accent, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>{app.title}</span>
                  </span>
                  <span
                    style={{
                      fontSize: '9px',
                      fontFamily: 'var(--font-mono)',
                      color: meta.accent,
                      background: `${meta.accent}18`,
                      border: `1px solid ${meta.accent}44`,
                      borderRadius: '4px',
                      padding: '3px 7px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {meta.badge}
                  </span>
                </div>

                <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
                  {meta.summary}
                </p>

                <div className="compare-hover-card__hint" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b', marginTop: '8px' }}>
                  Hover to inspect metrics &amp; PSI origin
                </div>

                <div className="compare-hover-card__body">
                  <div className="compare-hover-card__inner">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '10px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>{app.code}</span>
                      <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>{app.taxonomy}</span>
                    </div>

                    {meta.bullets.length > 0 && (
                      <ul style={{ margin: '0 0 10px', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {meta.bullets.map((bullet) => (
                          <li key={bullet} style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.45 }}>
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: '8px',
                        background: '#111827',
                        padding: '9px 10px',
                        borderRadius: '6px',
                        border: '1px solid #1c2640',
                        marginBottom: '8px',
                      }}
                    >
                      {app.stats.map((stat) => (
                        <div key={stat.label}>
                          <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                            {stat.label.toUpperCase()}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              color: stat.color === 'green' ? '#34d399' : stat.color === 'amber' ? '#f59e0b' : stat.color === 'rose' ? '#fb7185' : '#38bdf8',
                            }}
                          >
                            {stat.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                      Standard: <span style={{ color: '#94a3b8' }}>{app.standard}</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: '#0d1321',
          border: '1px solid #1c2640',
          borderRadius: '8px',
          padding: '12px 18px',
          marginTop: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" />
          </svg>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc' }}>
              PSI Study Comparison &amp; Earth Transfer
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
              Record conditions are API-backed when available; findings and spin-off summaries are curated reference content.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExportCsv}
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              background: '#111827',
              border: '1px solid #1c2640',
              color: '#cbd5e1',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            EXPORT CSV MATRIX
          </button>
          <button
            type="button"
            onClick={() => navigate('/flame')}
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              background: '#4f8ef7',
              border: 'none',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
            OPEN FIREHAZR 3D LAB
          </button>
        </div>
      </div>
    </div>
  );
}
