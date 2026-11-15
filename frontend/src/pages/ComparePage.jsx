import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COMPARISON_MATRIX, CROSS_FINDINGS, EARTH_APPLICATIONS } from '../services/mockData.js';
import { api } from '../services/api.js';

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

function PanelHeader({ id, title, badge, expanded, onClick }) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={id}
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        background: 'transparent',
        border: 'none',
        color: '#f8fafc',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 700 }}>{title}</span>
        <span
          style={{
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            color: '#38bdf8',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '4px',
            padding: '3px 7px',
            whiteSpace: 'nowrap',
          }}
        >
          {badge}
        </span>
      </span>
      <span aria-hidden="true" style={{ fontSize: '16px', color: '#38bdf8', lineHeight: 1 }}>
        {expanded ? '−' : '+'}
      </span>
    </button>
  );
}

export default function ComparePage() {
  const [highlightDiff, setHighlightDiff] = useState(true);
  const [investigations, setInvestigations] = useState([]);
  const [dataSource, setDataSource] = useState('loading');
  const [openPanels, setOpenPanels] = useState({});
  const navigate = useNavigate();
  const panelIds = [
    ...CROSS_FINDINGS.map((_, idx) => `finding-${idx}`),
    ...EARTH_APPLICATIONS.map((application) => `application-${application.id}`),
  ];
  const allExpanded = panelIds.every((id) => openPanels[id]);

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

  const togglePanel = (id) => {
    setOpenPanels((current) => ({ ...current, [id]: !current[id] }));
  };
  const toggleAllPanels = () => {
    const expanded = !allExpanded;
    setOpenPanels(Object.fromEntries(panelIds.map((id) => [id, expanded])));
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        background: '#060a14',
      }}
    >
      {/* ── Top Header Bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#38bdf8', fontSize: '13px' }}>●</span>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#8892a8' }}>
            MULTI-STUDY COMPARISON // NASA PSI ARCHIVE RECORDS
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
            PSI STUDY RECORDS
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
            CURATED CROSS-STUDY CONTEXT
          </span>
        </div>
      </div>

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
                      onClick={() => navigate(`/study/${s.id}`)}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <h2 style={{ fontSize: '14px', color: '#f8fafc', margin: 0 }}>Cross-study findings</h2>
          <button
            type="button"
            onClick={toggleAllPanels}
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#94a3b8',
              background: 'transparent',
              border: '1px solid #1c2640',
              borderRadius: '4px',
              padding: '6px 9px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '10px' }}>
          {CROSS_FINDINGS.map((finding, idx) => {
            const id = `finding-${idx}`;
            const expanded = Boolean(openPanels[id]);
            const badge = ['Límites de Gravedad', 'Regímenes de Oxígeno', 'Hardware y Combustible'][idx];
            return (
              <article key={id} style={panelStyle}>
                <PanelHeader
                  id={`${id}-content`}
                  title={finding.title}
                  badge={badge}
                  expanded={expanded}
                  onClick={() => togglePanel(id)}
                />
                <div
                  id={`${id}-content`}
                  aria-hidden={!expanded}
                  inert={!expanded}
                  style={{
                    display: 'grid',
                    gridTemplateRows: expanded ? '1fr' : '0fr',
                    opacity: expanded ? 1 : 0,
                    transition: 'grid-template-rows 180ms ease, opacity 180ms ease',
                  }}
                >
                  <div style={{ minHeight: 0, overflow: 'hidden' }}>
                    <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.5, margin: '0 16px 14px' }}>
                      {finding.text}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Earth Spin-Off Applications Section ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#34d399', marginBottom: '2px' }}>
              TERRESTRIAL TECHNOLOGY DEPLOYMENT · NASA TECHNOLOGY TRANSFER & PUBLIC SAFETY ARCHIVE
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              EARTH SPIN-OFF APPLICATIONS
            </h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Translating microgravity combustion kinetics and extinction bounds into terrestrial life-safety engineering.
            </p>
          </div>

          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
            ● FLIGHT DATA TO MUNICIPAL CODE DIRECT COUPLING
          </div>
        </div>

        {/* 3 Spin-Off Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '10px' }}>
          {EARTH_APPLICATIONS.map((app) => {
            const id = `application-${app.id}`;
            const expanded = Boolean(openPanels[id]);
            const category = app.id === 'water-mist'
              ? 'Supresión de Incendios'
              : app.id === 'smoke-detection'
                ? 'Detección de Humo'
                : 'Inflamabilidad de Materiales';
            return (
              <article key={app.id} style={panelStyle}>
                <PanelHeader
                  id={`${id}-content`}
                  title={app.title}
                  badge={category}
                  expanded={expanded}
                  onClick={() => togglePanel(id)}
                />
                <div
                  id={`${id}-content`}
                  aria-hidden={!expanded}
                  inert={!expanded}
                  style={{
                    display: 'grid',
                    gridTemplateRows: expanded ? '1fr' : '0fr',
                    opacity: expanded ? 1 : 0,
                    transition: 'grid-template-rows 180ms ease, opacity 180ms ease',
                  }}
                >
                  <div style={{ minHeight: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '0 16px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>{app.code}</span>
                        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>{app.category}</span>
                      </div>
                      <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '6px' }}>
                        {app.taxonomy}
                      </div>
                      <p style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 12px' }}>
                        {app.description}
                      </p>
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
          background: '#0d1321',
          border: '1px solid #1c2640',
          borderRadius: '8px',
          padding: '12px 18px',
          marginTop: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px', color: '#38bdf8' }}>☲</span>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc' }}>
              PSI Study Comparison
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
              Record conditions are API-backed when available; findings and spin-off summaries are curated reference content.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => alert('Exporting full matrix as CSV...')}
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              background: '#111827',
              border: '1px solid #1c2640',
              color: '#cbd5e1',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            📥 EXPORT CSV MATRIX
          </button>
          <button
            onClick={() => alert('Simulating Terrestrial Transition with boundary equations...')}
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
            }}
          >
            ⚡ SIMULATE TERRESTRIAL TRANSITION
          </button>
        </div>
      </div>
    </div>
  );
}
