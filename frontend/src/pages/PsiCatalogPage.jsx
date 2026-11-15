import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { INVESTIGATIONS } from '../services/mockData.js';
import { api } from '../services/api.js';
import {
  CATALOG_CATEGORIES,
  CATALOG_FUEL_TYPES,
  CATALOG_HARDWARE_FILTERS,
  CATEGORY_STYLE,
  filterPsiInvestigations,
  summarizeCatalogMetrics,
} from '../services/psi-catalog.js';

function FilterPillRow({ label, options, value, onChange, activeColor = '#38bdf8' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span
        style={{
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          color: '#64748b',
          minWidth: '72px',
          letterSpacing: '0.4px',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.id)}
              style={{
                padding: '6px 11px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: active ? 700 : 500,
                background: active ? `${activeColor}1f` : '#080f1c',
                border: active ? `1px solid ${activeColor}` : '1px solid #1c2640',
                color: active ? '#f8fafc' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PsiCatalogPage() {
  const navigate = useNavigate();
  const { audience } = useApp();
  const [investigations, setInvestigations] = useState(INVESTIGATIONS);
  const [dataSource, setDataSource] = useState('local-processed');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [fuelType, setFuelType] = useState('all');
  const [hardware, setHardware] = useState('all');

  useEffect(() => {
    let cancelled = false;
    api.listInvestigations().then((res) => {
      if (!cancelled && Array.isArray(res?.items) && res.items.length > 0) {
        setInvestigations(res.items);
        setDataSource(res.source ?? 'local-processed');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => filterPsiInvestigations(investigations, { query, category, fuelType, hardware }),
    [investigations, query, category, fuelType, hardware]
  );

  const metrics = useMemo(() => summarizeCatalogMetrics(filtered), [filtered]);
  const hasFilters = Boolean(query.trim() || category !== 'all' || fuelType !== 'all' || hardware !== 'all');

  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setFuelType('all');
    setHardware('all');
  };

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        padding: '24px 32px 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        background: '#060a14',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#4f8ef7',
              letterSpacing: '0.8px',
              marginBottom: '6px',
            }}
          >
            NASA PHYSICAL SCIENCES INFORMATICS // COMBUSTION ARCHIVE ({investigations.length} STUDIES)
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px' }}>
            NASA PSI Investigation Catalog
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '78ch', lineHeight: 1.5 }}>
            Search and filter verified ISS and Cygnus combustion studies by safety pillar, fuel state, and hardware
            rack (`CIR/ACME`, `CIR/MDCA`, `MSG`, `Saffire`, `SAME`). Select any record for telemetry and curves.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: dataSource === 'api' ? '#34d399' : '#94a3b8',
              background: '#0d1321',
              border: '1px solid #1c2640',
              borderRadius: '6px',
              padding: '6px 10px',
            }}
          >
            SOURCE: {dataSource === 'api' ? 'MONGODB / API' : 'VERIFIED PSI ARCHIVE'}
          </span>
          <Link
            to="/?tab=ranking"
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: '#cbd5e1',
              background: '#111827',
              border: '1px solid #1c2640',
              borderRadius: '6px',
              padding: '6px 11px',
            }}
          >
            Mission Ranking ↗
          </Link>
        </div>
      </header>

      {/* Metrics Strip */}
      <section
        aria-label="Filtered archive summary"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '12px',
        }}
      >
        <div style={{ background: '#0d1321', border: '1px solid #1c2640', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '6px' }}>
            MATCHING STUDIES
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>
            {metrics.count} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>/ {investigations.length}</span>
          </div>
        </div>
        <div style={{ background: '#0d1321', border: '1px solid #1c2640', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '6px' }}>
            REPORTED O₂ ENVELOPE
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#38bdf8' }}>
            {metrics.oxygenMinPct != null
              ? metrics.oxygenMinPct === metrics.oxygenMaxPct
                ? `${metrics.oxygenMinPct}% O₂`
                : `${metrics.oxygenMinPct}% – ${metrics.oxygenMaxPct}%`
              : 'Not reported'}
          </div>
        </div>
        <div style={{ background: '#0d1321', border: '1px solid #1c2640', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '6px' }}>
            HARDWARE PLATFORMS
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#a78bfa' }}>{metrics.hardwareCount}</div>
        </div>
        <div style={{ background: '#0d1321', border: '1px solid #1c2640', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748b', marginBottom: '6px' }}>
            EARTH SPIN-OFF LINKS
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#34d399' }}>{metrics.earthApplicationsCount}</div>
        </div>
      </section>

      {/* Search & Filters */}
      <section
        style={{
          background: '#0d1321',
          border: '1px solid #1c2640',
          borderRadius: '8px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="search"
            aria-label="Search PSI investigations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by acronym (Saffire, FLEX, CFI-G, BRE), fuel, sensor, hardware, or keyword…"
            style={{
              flex: '1 1 280px',
              minWidth: 0,
              padding: '9px 12px',
              borderRadius: '7px',
              border: '1px solid #263449',
              background: '#080f1c',
              color: '#f1f5f9',
              fontSize: '12.5px',
            }}
          />
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              style={{
                padding: '9px 12px',
                borderRadius: '7px',
                border: '1px solid #334155',
                background: '#111827',
                color: '#cbd5e1',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        <FilterPillRow label="PILLAR" options={CATALOG_CATEGORIES} value={category} onChange={setCategory} activeColor="#38bdf8" />
        <FilterPillRow label="FUEL" options={CATALOG_FUEL_TYPES} value={fuelType} onChange={setFuelType} activeColor="#f59e0b" />
        <FilterPillRow label="HARDWARE" options={CATALOG_HARDWARE_FILTERS} value={hardware} onChange={setHardware} activeColor="#a78bfa" />
      </section>

      {/* Study Grid */}
      {filtered.length === 0 ? (
        <div
          style={{
            background: '#0d1321',
            border: '1px solid #1c2640',
            borderRadius: '8px',
            padding: '28px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '13px',
          }}
        >
          No PSI investigations match these filters.{' '}
          <button
            type="button"
            onClick={resetFilters}
            style={{
              marginLeft: '8px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #3b82f6',
              background: '#17273c',
              color: '#f8fafc',
              cursor: 'pointer',
            }}
          >
            Show all {investigations.length} studies
          </button>
        </div>
      ) : (
        <section
          aria-label="PSI investigation list"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '14px',
          }}
        >
          {filtered.map((inv) => {
            const catMeta = CATEGORY_STYLE[inv.category] ?? {
              label: String(inv.category ?? 'PSI').toUpperCase(),
              color: '#94a3b8',
              bg: 'rgba(148, 163, 184, 0.12)',
            };
            const summary =
              audience === 'Student'
                ? inv.aiSummary?.student ?? inv.objective
                : inv.objective;
            const earthApp = inv.earthApplications?.[0];

            return (
              <article
                key={inv.id}
                style={{
                  background: '#0d1321',
                  border: '1px solid #1c2640',
                  borderRadius: '8px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                      {inv.psiId ?? inv.archiveCode}
                    </span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '9px',
                          fontFamily: 'var(--font-mono)',
                          color: catMeta.color,
                          background: catMeta.bg,
                          padding: '2px 7px',
                          borderRadius: '4px',
                        }}
                      >
                        {catMeta.label}
                      </span>
                      <span
                        style={{
                          fontSize: '9px',
                          fontFamily: 'var(--font-mono)',
                          color: '#cbd5e1',
                          background: '#111827',
                          border: '1px solid #1c2640',
                          padding: '2px 7px',
                          borderRadius: '4px',
                        }}
                      >
                        {String(inv.fuelType ?? 'mixed').toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: '0 0 3px' }}>
                      {inv.acronym} — {inv.title}
                    </h2>
                    <div style={{ fontSize: '11px', color: '#7dd3fc', fontFamily: 'var(--font-mono)' }}>
                      {inv.hardware}
                    </div>
                  </div>

                  <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
                    {summary}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: '6px',
                      background: '#080f1c',
                      border: '1px solid #1c2640',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '10.5px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>O₂ RANGE</div>
                      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{inv.oxygenRange}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>PRESSURE</div>
                      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{inv.ambientPressure}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>SENSORS</div>
                      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{inv.sensors?.length ?? 0} instruments</div>
                    </div>
                  </div>

                  {earthApp && (
                    <div style={{ fontSize: '11px', color: '#86efac', lineHeight: 1.4 }}>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '9.5px', color: '#34d399' }}>
                        EARTH APPLICATION:{' '}
                      </strong>
                      {earthApp}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/study/${inv.id}`)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(59, 130, 246, 0.45)',
                        background: 'rgba(33, 71, 119, 0.45)',
                        color: '#f8fafc',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Inspect Study Telemetry →
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
