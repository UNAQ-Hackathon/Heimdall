import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CartesianGrid,
  Cell,
  ReferenceDot,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { COMPARISON_MATRIX, CROSS_FINDINGS, EARTH_APPLICATIONS, INVESTIGATIONS } from '../services/mockData.js';
import { api } from '../services/api.js';
import {
  buildPsiDatasetCsv,
  CATEGORY_STYLE,
  getHardwareFamily,
  summarizeInvestigationDifferences,
} from '../services/psi-catalog.js';
import '../styles/compare-earth.css';

const COMPARATOR_PRESETS = [
  { label: 'Solids (BASS-II · Saffire-III · SoFIE)', ids: ['BASS-II', 'Saffire-III', 'SoFIE'] },
  { label: 'Suppression & High O₂ (FLEX · FLEX-2 · CFI-G)', ids: ['FLEX', 'FLEX-2', 'CFI-G'] },
  { label: 'Partial-g & Moon Gap (E-FIELD · LUCI · FM2)', ids: ['E-FIELD Flames', 'LUCI', 'FM2'] },
  { label: 'Smoke & Dust (SAME · SAME-R · DAFT)', ids: ['SAME', 'SAME-R', 'DAFT'] },
];

const VIEW_TABS = [
  { id: 'all', label: 'All Sections' },
  { id: 'comparator', label: 'Side-by-Side' },
  { id: 'matrix', label: 'Conditions Matrix' },
  { id: 'earth', label: 'Earth Spin-Offs' },
];

const EARTH_STUDY_LINKS = {
  'water-mist': ['FLEX', 'FLEX-2'],
  'smoke-detection': ['SAME', 'SAME-R', 'DAFT'],
  'material-screening': ['BASS-II', 'Saffire-III', 'E-FIELD Flames'],
};

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
    summary: 'Moon habitats use ≥30% O₂ at reduced pressure (≤10.2 psi), raising material flammability.',
    bullets: [
      'Spacesuits run 100% O₂ at 4.3 psi; ISS stays near 21% O₂ / 14.7 psi.',
      'Higher O₂ reduces astronaut pre-breathing time before EVAs.',
      'PSI high-O₂ tests (up to 85% in CFI-G) map ignition margins.',
    ],
  },
  {
    badge: 'Hardware & Fuel',
    accent: '#34d399',
    summary: 'Modular ISS racks compare solid, liquid, and gas flames on shared testbeds.',
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
    summary: 'Microgravity droplet kinetics inform cleaner fine-water-mist and inert-gas extinguishers on Earth.',
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

function getOxygenBounds(conditions = {}) {
  const min = conditions.oxygenMinPct ?? conditions.oxygenPct ?? conditions.oxygenMaxPct;
  const max = conditions.oxygenMaxPct ?? conditions.oxygenPct ?? conditions.oxygenMinPct;
  if (min == null && max == null) return null;
  const lo = Math.max(0, Math.min(100, Number(min)));
  const hi = Math.max(lo, Math.min(100, Number(max)));
  return { lo, hi, nominal: conditions.oxygenPct ?? hi };
}

function formatOxygenRange(conditions = {}) {
  const bounds = getOxygenBounds(conditions);
  if (!bounds) return null;
  return bounds.lo !== bounds.hi
    ? `${bounds.lo}% → ${bounds.hi}% O₂ (nominal ${bounds.nominal}%)`
    : `${bounds.lo}% O₂`;
}

const REGIME_MARKERS = [
  { x: 14.7, y: 21, label: 'ISS CABIN', color: '#7dd3fc', anchor: 'top' },
  { x: 10.2, y: 30, label: 'LUNAR HAB', color: '#fbbf24', anchor: 'right' },
  { x: 4.3, y: 100, label: 'EVA SUIT', color: '#fb7185', anchor: 'bottom' },
];

function RegimeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="compare-chart-tooltip">
      <div style={{ fontWeight: 700, color: '#f8fafc' }}>{p.name}</div>
      <div>O₂ tested: {p.o2Range}</div>
      <div>Chamber pressure: {p.pressure} psi</div>
    </div>
  );
}

function OxygenBar({ minPct, maxPct }) {
  if (minPct == null || maxPct == null) return null;
  const left = Math.max(0, Math.min(100, Number(minPct)));
  const right = Math.max(left, Math.min(100, Number(maxPct)));
  const width = Math.max(4, right - left);
  return (
    <div className="compare-o2-bar" title={`Measured O₂ range: ${left}% to ${right}% (white tick = 21% Earth air)`}>
      <div className="compare-o2-track">
        <div className="compare-o2-fill" style={{ left: `${left}%`, width: `${width}%` }} />
        <div className="compare-o2-earth" />
      </div>
    </div>
  );
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ComparePage() {
  const { audience } = useApp();
  const isStudent = audience === 'Student';
  const [activeView, setActiveView] = useState('all');
  const [highlightDiff, setHighlightDiff] = useState(true);
  const [diffRowsOnly, setDiffRowsOnly] = useState(false);
  const [matrixQuery, setMatrixQuery] = useState('');
  const [investigations, setInvestigations] = useState(INVESTIGATIONS);
  const [compareIds, setCompareIds] = useState(['BASS-II', 'Saffire-III', 'SoFIE']);
  const [dataSource, setDataSource] = useState('loading');
  const navigate = useNavigate();
  const comparatorRef = useRef(null);
  const matrixRef = useRef(null);
  const earthRef = useRef(null);

  useEffect(() => {
    if (activeView === 'all') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const target = { comparator: comparatorRef, matrix: matrixRef, earth: earthRef }[activeView]?.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeView]);

  useEffect(() => {
    let cancelled = false;
    api.listInvestigations().then((result) => {
      if (cancelled) return;
      if (Array.isArray(result.items) && result.items.length > 0) {
        setInvestigations(result.items);
      }
      setDataSource(result.source ?? 'api');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedStudies = useMemo(
    () =>
      compareIds
        .map((key) =>
          investigations.find(
            (item) =>
              item.acronym === key ||
              item.psiId === key ||
              item.id === key ||
              normalizeKey(item.acronym) === normalizeKey(key)
          )
        )
        .filter(Boolean),
    [compareIds, investigations]
  );

  const comparisonDigest = useMemo(
    () => summarizeInvestigationDifferences(selectedStudies),
    [selectedStudies]
  );

  const regimePoints = useMemo(
    () =>
      investigations
        .filter((s) => s?.dataAvailable !== false && s?.conditions?.pressurePsi != null)
        .map((s) => {
          const bounds = getOxygenBounds(s.conditions);
          if (!bounds) return null;
          return {
            name: s.acronym ?? s.psiId ?? s.title,
            category: s.category ?? 'prevention',
            pressure: Number(s.conditions.pressurePsi),
            o2: bounds.nominal ?? (bounds.lo + bounds.hi) / 2,
            o2Range: bounds.lo !== bounds.hi ? `${bounds.lo}–${bounds.hi}%` : `${bounds.lo}%`,
          };
        })
        .filter(Boolean),
    [investigations]
  );

  const o2Envelope = useMemo(
    () =>
      investigations
        .map((s) => ({ study: s, bounds: s?.dataAvailable !== false ? getOxygenBounds(s.conditions) : null }))
        .filter((entry) => entry.bounds)
        .sort((a, b) => b.bounds.hi - a.bounds.hi || a.bounds.lo - b.bounds.lo),
    [investigations]
  );

  const filteredMatrix = useMemo(() => {
    const q = matrixQuery.trim().toLowerCase();
    if (!q) return COMPARISON_MATRIX.studies;
    return COMPARISON_MATRIX.studies.filter((study) =>
      [study.name, study.testbed, study.fuel, study.orbit, study.o2Range, study.behavior, ...(study.tags ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [matrixQuery]);

  const handleExportSelectedCsv = () => {
    downloadBlob(
      buildPsiDatasetCsv(selectedStudies),
      'nasa-psi-side-by-side-comparison.csv',
      'text/csv;charset=utf-8;'
    );
  };

  const handleExportCsv = () => {
    const headers = ['Study', 'Testbed', 'Orbit', 'Oxygen Range', 'Ambient Pressure', 'Fuel', 'Key Behavior'];
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
    downloadBlob(csv, 'nasa-psi-comparison-matrix.csv', 'text/csv;charset=utf-8;');
  };

  const comparisonRows = useMemo(() => {
    const rows = [
      {
        key: 'pillar',
        label: 'Safety Pillar',
        getCompareVal: (s) => String(s.category ?? 'unclassified').toLowerCase(),
        render: (s) => (
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#7dd3fc',
              textTransform: 'capitalize',
            }}
          >
            {s.category ?? 'N/A'}
          </span>
        ),
      },
      {
        key: 'hardware',
        label: 'Hardware / Rack',
        getCompareVal: (s) => getHardwareFamily(s.hardware),
        render: (s) => <span style={{ color: '#e2e8f0' }}>{getHardwareFamily(s.hardware)}</span>,
      },
      {
        key: 'fuel',
        label: 'Fuel & Samples',
        getCompareVal: (s) => s.fuel ?? 'N/A',
        render: (s) => <span style={{ color: '#cbd5e1' }}>{s.fuel ?? 'Not reported'}</span>,
      },
      {
        key: 'oxygen',
        label: 'O₂ Envelope',
        getCompareVal: (s) => (s.dataAvailable === false ? 'upcoming' : formatOxygenRange(s.conditions) ?? 'N/A'),
        render: (s) => {
          if (s.dataAvailable === false) {
            return <span style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>No PSI data yet</span>;
          }
          const bounds = getOxygenBounds(s.conditions);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {formatOxygenRange(s.conditions) ?? 'Not reported'}
              </span>
              {bounds && <OxygenBar minPct={bounds.lo} maxPct={bounds.hi} />}
            </div>
          );
        },
      },
      {
        key: 'pressure',
        label: 'Pressure & Flow',
        getCompareVal: (s) =>
          `${s.conditions?.pressurePsi ?? 'na'}-${s.conditions?.flowVelocity ?? 'na'}`,
        render: (s) => {
          const c = s.conditions ?? {};
          return (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: '#cbd5e1' }}>
              {c.pressurePsi != null ? `${c.pressurePsi} psi` : 'No pressure data'} ·{' '}
              {c.flowVelocity != null ? `${c.flowVelocity} m/s` : 'Quiescent / N/R'}
            </span>
          );
        },
      },
      {
        key: 'gravity',
        label: 'Gravity Regime',
        getCompareVal: (s) => s.gravityLevel ?? 'N/A',
        render: (s) => <span style={{ color: '#e2e8f0' }}>{s.gravityLevel ?? 'Not reported'}</span>,
      },
      {
        key: 'series',
        label: 'Empirical Series',
        getCompareVal: (s) =>
          Array.isArray(s.series) ? s.series.reduce((acc, x) => acc + (x?.samples?.length ?? 0), 0) : 0,
        render: (s) => {
          const pts = Array.isArray(s.series) ? s.series.reduce((acc, x) => acc + (x?.samples?.length ?? 0), 0) : 0;
          return (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: pts > 0 ? '#34d399' : '#64748b' }}>
              {pts > 0 ? `${pts} measured samples` : 'Metadata / summary only'}
            </span>
          );
        },
      },
      {
        key: 'variables',
        label: isStudent ? 'Plain-Language Takeaway' : 'Test Variables',
        getCompareVal: (s) => (isStudent ? s.aiSummary?.student ?? s.objective ?? '' : (s.variables ?? []).join('|')),
        render: (s) =>
          isStudent ? (
            <span style={{ color: '#e2e8f0', lineHeight: 1.5 }}>
              {s.aiSummary?.student ?? s.objective}
            </span>
          ) : (
            <span style={{ color: '#94a3b8', lineHeight: 1.45 }}>
              {s.variables?.length ? s.variables.join(', ') : 'None published yet'}
            </span>
          ),
      },
      ...(!isStudent
        ? [
            {
              key: 'sensors',
              label: 'Sensors',
              getCompareVal: (s) => (s.sensors ?? []).join('|'),
              render: (s) => (
                <span style={{ color: '#94a3b8', lineHeight: 1.45 }}>
                  {s.sensors?.length ? s.sensors.join(', ') : 'None published yet'}
                </span>
              ),
            },
            {
              key: 'objective',
              label: 'Objective',
              getCompareVal: (s) => s.objective ?? '',
              render: (s) => <span style={{ color: '#cbd5e1', lineHeight: 1.45 }}>{s.objective}</span>,
            },
          ]
        : []),
    ];

    if (!diffRowsOnly || selectedStudies.length < 2) return rows;
    return rows.filter((row) => new Set(selectedStudies.map(row.getCompareVal)).size > 1);
  }, [diffRowsOnly, isStudent, selectedStudies]);

  const showComparator = activeView === 'all' || activeView === 'comparator';
  const showMatrix = activeView === 'all' || activeView === 'matrix';
  const showEarth = activeView === 'all' || activeView === 'earth';

  const openStudyByKey = (key) => {
    const match = investigations.find(
      (item) => normalizeKey(item.acronym) === normalizeKey(key) || normalizeKey(item.psiId) === normalizeKey(key)
    );
    navigate(`/study/${match?.id ?? match?.psiId ?? key}`);
  };

  return (
    <div className="compare-page">
      <div className="compare-page__inner">
        {/* Clean Hero & Section Switcher */}
        <header className="compare-hero">
          <div>
            <div className="compare-hero__eyebrow">
              <span className="compare-hero__dot" aria-hidden="true" />
              NASA PSI ARCHIVE · {isStudent ? 'STUDENT GUIDED LEARNING VIEW' : 'ENGINEER PARAMETRIC VIEW'}
            </div>
            <h1>PSI Cross-Study Parametric Analysis</h1>
            <p>
              {isStudent
                ? 'Explore plain-language takeaways explaining what each space fire test studied and how those discoveries protect homes and firefighters on Earth.'
                : 'Align PSI investigations row-by-row, map tested O₂/pressure envelopes against habitat &amp; suit regimes, and trace microgravity findings to terrestrial fire standards.'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
            <div className="compare-tabs" role="tablist" aria-label="Compare page sections">
              {VIEW_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className="compare-tab"
                  aria-selected={activeView === tab.id}
                  onClick={() => setActiveView(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="compare-btn compare-btn--active"
              onClick={() => navigate('/flame')}
            >
              Open FireHazR 3D Lab →
            </button>
          </div>
        </header>

        {/* 1. Side-by-Side Aligned Comparator */}
        {showComparator && (
          <section ref={comparatorRef} className="compare-section" aria-label="Interactive side-by-side study comparator">
            <div data-tour="compare-controls" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="compare-section__head">
                <div>
                  <div className="compare-section__eyebrow">
                    ALIGNED COMPARATOR ({investigations.length} STUDIES)
                  </div>
                  <h2 className="compare-section__title">Side-by-Side PSI Study Comparison</h2>
                  <p className="compare-section__sub">
                    Pick a challenge preset or choose any 2–3 studies to inspect shared bounds and differences row by row.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`compare-btn${diffRowsOnly ? ' compare-btn--active' : ''}`}
                    aria-pressed={diffRowsOnly}
                    onClick={() => setDiffRowsOnly((v) => !v)}
                  >
                    {diffRowsOnly ? 'Showing Differences Only' : 'Show Differences Only'}
                  </button>
                  {compareIds.length < 3 && (
                    <button
                      type="button"
                      className="compare-btn"
                      onClick={() => setCompareIds([...compareIds, 'FLEX'])}
                    >
                      + Add 3rd Study
                    </button>
                  )}
                  <button
                    type="button"
                    className="compare-btn compare-btn--primary"
                    disabled={selectedStudies.length === 0}
                    onClick={handleExportSelectedCsv}
                  >
                    Export Selected CSV ({selectedStudies.length})
                  </button>
                </div>
              </div>

              <div className="compare-presets">
                {COMPARATOR_PRESETS.map((preset) => {
                  const active =
                    compareIds.length === preset.ids.length &&
                    preset.ids.every((id, idx) => compareIds[idx] === id);
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      className="compare-preset"
                      aria-pressed={active}
                      onClick={() => setCompareIds(preset.ids)}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="compare-slots">
              {compareIds.map((selectedId, slotIdx) => (
                <div key={slotIdx} className="compare-slot">
                  <div className="compare-slot__top">
                    <span>STUDY {slotIdx + 1}</span>
                    {compareIds.length > 2 && (
                      <button
                        type="button"
                        aria-label={`Remove study ${slotIdx + 1}`}
                        onClick={() => setCompareIds(compareIds.filter((_, idx) => idx !== slotIdx))}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          fontSize: '12px',
                          padding: 0,
                        }}
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>
                  <select
                    aria-label={`Study ${slotIdx + 1}`}
                    value={selectedId}
                    onChange={(e) => {
                      const next = [...compareIds];
                      next[slotIdx] = e.target.value;
                      setCompareIds(next);
                    }}
                  >
                    {investigations.map((item) => (
                      <option key={item.psiId ?? item.acronym} value={item.acronym ?? item.psiId}>
                        {item.acronym} — {item.title}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="compare-table-wrap">
              <table className="compare-align-table">
                <thead>
                  <tr>
                    <th>Attribute</th>
                    {selectedStudies.map((study, idx) => (
                      <th key={`${study.psiId ?? study.acronym}-${idx}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div>
                            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                              {study.psiId}
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                              {study.acronym}
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 400, color: '#94a3b8', marginTop: '2px' }}>
                              {study.title}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="compare-chip-link"
                            onClick={() => openStudyByKey(study.acronym ?? study.psiId)}
                          >
                            Details →
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{row.label}</th>
                      {selectedStudies.map((study, idx) => (
                        <td key={`${row.key}-${study.psiId ?? study.acronym}-${idx}`}>
                          {row.render(study)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(comparisonDigest.similarities.length > 0 || comparisonDigest.differences.length > 0) && (
              <div className="compare-digest-grid">
                <div className="compare-digest-card" style={{ borderColor: 'rgba(52, 211, 153, 0.35)' }}>
                  <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#34d399', marginBottom: '6px' }}>
                    VERIFIED SIMILARITIES
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '5px', fontSize: '12.5px', color: '#cbd5e1' }}>
                    {comparisonDigest.similarities.length > 0 ? (
                      comparisonDigest.similarities.map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li style={{ color: '#64748b' }}>No overlapping categorical bounds across this selection.</li>
                    )}
                  </ul>
                </div>
                <div className="compare-digest-card" style={{ borderColor: 'rgba(245, 158, 11, 0.35)' }}>
                  <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#fbbf24', marginBottom: '6px' }}>
                    KEY EXPERIMENTAL DIFFERENCES
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '5px', fontSize: '12.5px', color: '#cbd5e1' }}>
                    {comparisonDigest.differences.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 2. Parametric Conditions Matrix */}
        {showMatrix && (
          <section ref={matrixRef} className="compare-section" aria-label="Microgravity experiment comparison matrix">
            <div className="compare-section__head">
              <div>
                <div className="compare-section__eyebrow" style={{ color: '#38bdf8' }}>
                  {dataSource === 'loading'
                    ? 'LOADING PSI RECORDS…'
                    : dataSource === 'api'
                      ? 'API-BACKED STUDY REGIMES'
                      : 'LOCAL PROCESSED PSI REGIMES'}
                </div>
                <h2 className="compare-section__title">Parametric Flammability Matrix</h2>
                <p className="compare-section__sub">
                  Compare O₂ concentration bands, ambient chamber pressures, and fuel geometries across flagship missions.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="search"
                  aria-label="Filter comparison matrix"
                  placeholder="Filter study, fuel, hardware…"
                  value={matrixQuery}
                  onChange={(e) => setMatrixQuery(e.target.value)}
                  style={{
                    padding: '7px 11px',
                    borderRadius: '8px',
                    border: '1px solid #263449',
                    background: '#080d1a',
                    color: '#f8fafc',
                    fontSize: '12px',
                    minWidth: 'min(100%, 210px)',
                    flex: '1 1 210px',
                  }}
                />
                <button
                  type="button"
                  className={`compare-btn${highlightDiff ? ' compare-btn--active' : ''}`}
                  aria-pressed={highlightDiff}
                  onClick={() => setHighlightDiff(!highlightDiff)}
                >
                  Highlight Extremes
                </button>
                <button type="button" className="compare-btn" onClick={handleExportCsv}>
                  Export Matrix CSV
                </button>
              </div>
            </div>

            <div className="compare-table-wrap">
              <table className="compare-align-table">
                <thead>
                  <tr>
                    <th>Study &amp; Testbed</th>
                    <th>Oxygen Range (% O₂)</th>
                    <th>Ambient Pressure</th>
                    <th>Fuel &amp; Geometry</th>
                    <th>Critical Regime Behavior</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatrix.map((study) => {
                    const record = getComparisonRecord(study, investigations);
                    const conditions = record?.conditions ?? {};
                    const bounds = getOxygenBounds(conditions);
                    const oxygenRange = record ? formatOxygenRange(conditions) : null;
                    return (
                      <tr key={study.id}>
                        <td style={{ minWidth: '185px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => openStudyByKey(study.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                fontSize: '14px',
                                fontWeight: 700,
                                color: '#f8fafc',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                textDecorationColor: 'rgba(56, 189, 248, 0.4)',
                                textUnderlineOffset: '3px',
                              }}
                            >
                              {study.name}
                            </button>
                            {study.tags.map((t) => (
                              <span
                                key={t}
                                style={{
                                  fontSize: '9.5px',
                                  fontFamily: 'var(--font-mono)',
                                  background: 'rgba(56, 189, 248, 0.1)',
                                  border: '1px solid rgba(56, 189, 248, 0.25)',
                                  color: '#7dd3fc',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                            {record?.hardware ?? study.testbed}
                          </div>
                          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b', marginTop: '2px' }}>
                            {study.orbit}
                          </div>
                        </td>

                        <td style={{ minWidth: '175px' }}>
                          <div style={{ fontWeight: 700, color: highlightDiff ? '#38bdf8' : '#e2e8f0', fontFamily: 'var(--font-mono)', marginBottom: '5px' }}>
                            {oxygenRange ?? study.o2Range}
                          </div>
                          {bounds && <OxygenBar minPct={bounds.lo} maxPct={bounds.hi} />}
                          <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '5px' }}>{study.o2Note}</div>
                        </td>

                        <td style={{ minWidth: '140px' }}>
                          <div style={{ fontWeight: 700, color: highlightDiff ? '#fb7185' : '#e2e8f0', fontFamily: 'var(--font-mono)' }}>
                            {conditions.pressurePsi == null ? study.pressure : `${conditions.pressurePsi} psi`}
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px' }}>{study.pressureNote}</div>
                        </td>

                        <td style={{ minWidth: '170px' }}>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>{record?.fuel ?? study.fuel}</div>
                          {!record && <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>{study.fuelNote}</div>}
                          <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                            {study.fuelTags.map((t) => (
                              <span
                                key={t}
                                style={{
                                  fontSize: '9.5px',
                                  fontFamily: 'var(--font-mono)',
                                  background: '#111827',
                                  border: '1px solid #263449',
                                  color: '#c4b5fd',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td style={{ minWidth: '240px', maxWidth: '340px' }}>
                          <div style={{ color: '#cbd5e1', lineHeight: 1.45 }}>{record?.objective ?? study.behavior}</div>
                          <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#fbbf24', marginTop: '5px' }}>
                            {study.behaviorNote}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredMatrix.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                        No matrix studies match &ldquo;{matrixQuery}&rdquo;.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 3. Earth Spin-Off Applications & Cross-Study Findings (All Details Visible) */}
        {showEarth && (
          <>
            <section ref={earthRef} className="compare-section" aria-label="Oxygen and pressure regime map">
              <div className="compare-section__head">
                <div>
                  <div className="compare-section__eyebrow" style={{ color: '#f59e0b' }}>
                    PARAMETRIC ENVELOPE · MEASURED PSI CONDITIONS
                  </div>
                  <h2 className="compare-section__title">O₂–Pressure Regime Map &amp; Tested Envelopes</h2>
                  <p className="compare-section__sub">
                    Each point is a PSI investigation plotted at its tested oxidizer fraction and chamber pressure. Dashed markers show
                    the ISS cabin norm (21% O₂ / 14.7 psi), the lunar-habitat regime (≥30% O₂ / ≤10.2 psi), and the EVA suit loop (100% O₂ / 4.3 psi).
                  </p>
                </div>
              </div>

              <div className="compare-chart-grid">
                <div className="compare-chart-card">
                  <div className="compare-chart-card__label">OXIDIZER FRACTION vs CHAMBER PRESSURE</div>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart margin={{ top: 16, right: 26, bottom: 8, left: 0 }}>
                      <CartesianGrid stroke="#162036" />
                      <XAxis
                        type="number"
                        dataKey="pressure"
                        domain={[0, 16]}
                        name="Pressure"
                        unit=" psi"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: '#263449' }}
                        label={{ value: 'Chamber pressure (psi)', position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 10.5 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="o2"
                        domain={[0, 100]}
                        name="O₂"
                        unit="%"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: '#263449' }}
                        label={{ value: 'O₂ (%)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10.5 }}
                      />
                      <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#334155' }} content={<RegimeTooltip />} />
                      <Scatter data={regimePoints} isAnimationActive={false}>
                        {regimePoints.map((point) => (
                          <Cell
                            key={point.name}
                            fill={CATEGORY_STYLE[point.category]?.color ?? '#38bdf8'}
                            fillOpacity={0.85}
                          />
                        ))}
                      </Scatter>
                      {REGIME_MARKERS.map((marker) => (
                        <ReferenceDot
                          key={marker.label}
                          x={marker.x}
                          y={marker.y}
                          r={5}
                          fill="none"
                          stroke={marker.color}
                          strokeWidth={1.6}
                          strokeDasharray="3 3"
                          label={{
                            value: marker.label,
                            position: marker.anchor,
                            fill: marker.color,
                            fontSize: 9.5,
                            fontFamily: 'var(--font-mono)',
                          }}
                        />
                      ))}
                    </ScatterChart>
                  </ResponsiveContainer>
                  <div className="compare-chart-card__legend">
                    {Object.entries(CATEGORY_STYLE).map(([key, meta]) => (
                      <span key={key}>
                        <span className="compare-chart-dot" style={{ background: meta.color }} />
                        {meta.label}
                      </span>
                    ))}
                    <span style={{ color: '#64748b' }}>Nominal O₂ per study · hover for tested span</span>
                  </div>
                </div>

                <div className="compare-chart-card">
                  <div className="compare-chart-card__label">TESTED O₂ ENVELOPE PER STUDY (min → max)</div>
                  <div className="compare-o2-list">
                    {o2Envelope.map(({ study, bounds }) => (
                      <div key={study.psiId ?? study.acronym} className="compare-o2-list__row">
                        <span className="compare-o2-list__name" title={study.title}>{study.acronym ?? study.psiId}</span>
                        <OxygenBar minPct={bounds.lo} maxPct={bounds.hi} />
                        <span className="compare-o2-list__val">
                          {bounds.lo === bounds.hi ? `${bounds.lo}%` : `${bounds.lo}–${bounds.hi}%`}
                        </span>
                      </div>
                    ))}
                    {o2Envelope.length === 0 && (
                      <span style={{ color: '#64748b', fontSize: '12px' }}>No measured O₂ envelopes in this dataset.</span>
                    )}
                  </div>
                  <div className="compare-chart-card__legend">
                    <span style={{ color: '#64748b' }}>White tick = 21% Earth sea-level air reference</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="compare-section" aria-label="Earth spin-off applications">
              <div className="compare-section__head">
                <div>
                  <div className="compare-section__eyebrow">
                    NASA TECHNOLOGY TRANSFER · SPACE TO EARTH
                  </div>
                  <h2 className="compare-section__title">Earth Spin-Off Fire Safety Applications</h2>
                  <p className="compare-section__sub">
                    How ISS microgravity flame, aerosol, and suppression research improves terrestrial fire protection.
                  </p>
                </div>
              </div>

              <div className="compare-card-grid">
                {EARTH_APPLICATIONS.map((app) => {
                  const meta = EARTH_SUMMARY_MAP[app.id] ?? {
                    badge: app.category || 'Spin-Off',
                    accent: '#34d399',
                    summary: app.description,
                    bullets: [],
                  };
                  const linkedKeys = EARTH_STUDY_LINKS[app.id] ?? [];

                  return (
                    <article
                      key={app.id}
                      className="compare-info-card"
                      style={{ '--card-accent': meta.accent }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                            {app.code}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontFamily: 'var(--font-mono)',
                              color: meta.accent,
                              background: `${meta.accent}1a`,
                              border: `1px solid ${meta.accent}44`,
                              borderRadius: '9999px',
                              padding: '2px 9px',
                            }}
                          >
                            {meta.badge}
                          </span>
                        </div>

                        <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: '#f8fafc' }}>
                          {app.title}
                        </h3>

                        <p style={{ margin: 0, fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.5 }}>
                          {meta.summary}
                        </p>

                        {meta.bullets.length > 0 && (
                          <ul style={{ margin: 0, paddingLeft: '17px', display: 'grid', gap: '4px', fontSize: '12px', color: '#94a3b8' }}>
                            {meta.bullets.map((b) => (
                              <li key={b}>{b}</li>
                            ))}
                          </ul>
                        )}

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                            gap: '8px',
                            background: '#060a14',
                            border: '1px solid #1c2640',
                            borderRadius: '8px',
                            padding: '10px 12px',
                          }}
                        >
                          {app.stats.map((stat) => (
                            <div key={stat.label}>
                              <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                                {stat.label.toUpperCase()}
                              </div>
                              <div
                                style={{
                                  fontSize: '12px',
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: 700,
                                  marginTop: '2px',
                                  color:
                                    stat.color === 'green'
                                      ? '#34d399'
                                      : stat.color === 'amber'
                                        ? '#fbbf24'
                                        : stat.color === 'rose'
                                          ? '#fb7185'
                                          : '#38bdf8',
                                }}
                              >
                                {stat.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid #162036' }}>
                        <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
                          Standard: <span style={{ color: '#e2e8f0' }}>{app.standard}</span>
                        </div>
                        {linkedKeys.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {linkedKeys.map((studyKey) => (
                              <button
                                key={studyKey}
                                type="button"
                                className="compare-chip-link"
                                onClick={() => openStudyByKey(studyKey)}
                              >
                                {studyKey} →
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="compare-section" aria-label="Cross-study synthesis findings">
              <div className="compare-section__head">
                <div>
                  <div className="compare-section__eyebrow" style={{ color: '#a78bfa' }}>
                    CROSS-STUDY SYNTHESIS
                  </div>
                  <h2 className="compare-section__title">Mission Exploration Findings</h2>
                </div>
              </div>

              <div className="compare-card-grid">
                {CROSS_FINDINGS.map((finding, idx) => {
                  const meta = FINDING_SUMMARIES[idx] ?? {
                    badge: 'Insight',
                    accent: '#38bdf8',
                    summary: finding.text,
                    bullets: [],
                  };
                  return (
                    <article
                      key={finding.title}
                      className="compare-info-card"
                      style={{ '--card-accent': meta.accent }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.accent }} />
                            <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: '#f8fafc' }}>
                              {finding.title}
                            </h3>
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontFamily: 'var(--font-mono)',
                              color: meta.accent,
                              background: `${meta.accent}1a`,
                              border: `1px solid ${meta.accent}44`,
                              borderRadius: '9999px',
                              padding: '2px 8px',
                            }}
                          >
                            {meta.badge}
                          </span>
                        </div>

                        <p style={{ margin: 0, fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.5 }}>
                          {meta.summary}
                        </p>

                        <ul style={{ margin: 0, paddingLeft: '17px', display: 'grid', gap: '5px', fontSize: '12px', color: '#94a3b8' }}>
                          {meta.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
