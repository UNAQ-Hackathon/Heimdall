import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COMPARISON_MATRIX, CROSS_FINDINGS, EARTH_APPLICATIONS } from '../services/mockData.js';

export default function ComparePage() {
  const [highlightDiff, setHighlightDiff] = useState(true);
  const navigate = useNavigate();

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
            MULTI-STUDY CORRELATION // REGIME DIFFERENTIAL ANALYSIS / ARCHIVE REPOSITORIES: GRC-EXP-14
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
            CORRELATION CONFIDENCE: 98.4%
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
            CROSS-CALIBRATED: NASA-STD-6001B
          </span>
        </div>
      </div>

      {/* ── Matrix Section Title ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#38bdf8', marginBottom: '4px' }}>
            CORRELATED SPACE FLIGHT ARCHIVES · 3 DATASETS SYNCHRONIZED
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
          <span>●</span> Differential Highlight Active
        </button>
      </div>

      {/* ── Comparison Matrix Table ── */}
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
            {COMPARISON_MATRIX.studies.map((s, idx) => (
              <tr
                key={s.id}
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
                      {s.name}
                    </button>
                    {s.tags.map((t) => (
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
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{s.testbed}</div>
                  <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginTop: '2px' }}>
                    {s.orbit}
                  </div>
                </td>

                {/* Col 2 */}
                <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 700, color: highlightDiff ? '#38bdf8' : '#e2e8f0', fontFamily: 'var(--font-mono)' }}>
                    {s.o2Range}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>{s.o2Note}</div>
                </td>

                {/* Col 3 */}
                <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 700, color: highlightDiff ? '#fb7185' : '#e2e8f0', fontFamily: 'var(--font-mono)' }}>
                    {s.pressure}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>{s.pressureNote}</div>
                </td>

                {/* Col 4 */}
                <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>{s.fuel}</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{s.fuelNote}</div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                    {s.fuelTags.map((t) => (
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
                  <div style={{ color: '#cbd5e1', lineHeight: 1.4 }}>{s.behavior}</div>
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#f59e0b', marginTop: '4px' }}>
                    {s.behaviorNote}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 3 Cross-Findings Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        {CROSS_FINDINGS.map((cf, idx) => (
          <div
            key={idx}
            style={{
              background: '#0d1321',
              border: '1px solid #1c2640',
              borderRadius: '8px',
              padding: '14px 16px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
            }}
          >
            <span style={{ fontSize: '16px', color: idx === 0 ? '#38bdf8' : idx === 1 ? '#a78bfa' : '#f59e0b' }}>
              {idx === 0 ? '☲' : idx === 1 ? '✛' : '◎'}
            </span>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: '#f8fafc',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}
              >
                {cf.title}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.45 }}>
                {cf.text}
              </div>
            </div>
          </div>
        ))}
      </div>

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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          {EARTH_APPLICATIONS.map((app) => (
            <div
              key={app.id}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '16px', color: '#38bdf8' }}>☼</span>
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                    {app.code}
                  </span>
                </div>

                <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '4px' }}>
                  {app.taxonomy}
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: '0 0 8px 0' }}>
                  {app.title}
                </h3>

                <p style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
                  {app.description}
                </p>
              </div>

              <div>
                {/* Stats row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    background: '#111827',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #1c2640',
                    marginBottom: '8px',
                  }}
                >
                  {app.stats.map((st, i) => (
                    <div key={i}>
                      <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                        {st.label.toUpperCase()}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: st.color === 'green' ? '#34d399' : st.color === 'amber' ? '#f59e0b' : st.color === 'rose' ? '#fb7185' : '#38bdf8',
                        }}
                      >
                        {st.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                  Standard: <span style={{ color: '#94a3b8' }}>{app.standard}</span>
                </div>
              </div>
            </div>
          ))}
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
              Cross-Correlator Database Version 4.8.2
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
              Validated against 142 microgravity burns and 8,900+ 1G terrestrial calibration runs
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
