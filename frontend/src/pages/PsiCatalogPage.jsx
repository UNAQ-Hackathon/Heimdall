import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../services/api.js';
import { INVESTIGATIONS } from '../services/mockData.js';
import {
  buildPsiDatasetCsv,
  CATALOG_DATA_OPTIONS,
  CATALOG_FUEL_OPTIONS,
  CATALOG_HARDWARE_OPTIONS,
  CATALOG_PILLAR_GUIDE,
  CATEGORY_STYLE,
  filterPsiInvestigations,
  getHardwareFamily,
  getStudyOxygenBounds,
  getStudySeriesStats,
  getStudyTelemetryTier,
  summarizeCatalogOverview,
} from '../services/psi-catalog.js';
import {
  buildStudyEnvelopeSeries,
  computeTelemetryKPIs,
  EARTH_BASELINE,
  filterTelemetryRuns,
  FLEX_FUEL_FILTERS,
  FLEX_MIX_FILTERS,
  getAllFlexRuns,
  isDropletTelemetryStudy,
} from '../services/telemetry-f1.js';
import '../styles/psi-catalog.css';

function triggerDownload(filename, content, mimeType) {
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

function getStudyRouteKey(inv) {
  return inv?.id || inv?.slug || inv?.psiId || inv?.acronym || 'bass';
}

function matchesStudyIdentifier(inv, target) {
  if (!inv || !target) return false;
  const q = String(target).trim().toLowerCase();
  return [inv.id, inv.slug, inv.psiId, inv.acronym]
    .filter(Boolean)
    .some((val) => String(val).toLowerCase() === q);
}

function OxygenEnvelopeBar({ minPct, maxPct, emptyLabel = 'Pending publication' }) {
  const hasRange = Number.isFinite(minPct) && Number.isFinite(maxPct);
  const leftPct = hasRange ? Math.max(0, Math.min(100, minPct)) : 0;
  const widthPct = hasRange ? Math.max(2, Math.min(100 - leftPct, maxPct - minPct)) : 0;

  return (
    <div className="psi-o2-track-wrap">
      <div className="psi-o2-track-header">
        <span className="psi-overview-kicker">Verified Oxygen Range</span>
        <span className="psi-o2-range-value">
          {hasRange
            ? minPct === maxPct
              ? `${minPct}% O₂`
              : `${minPct}% – ${maxPct}% O₂`
            : emptyLabel}
        </span>
      </div>
      <div className="psi-o2-track" aria-label="Oxygen test range from 0% to 100%">
        {hasRange && (
          <div
            className="psi-o2-fill"
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          />
        )}
        <div
          className="psi-o2-marker"
          style={{ left: '21%' }}
          title="Earth / ISS Nominal Air: 21% O₂"
        />
        <div
          className="psi-o2-marker psi-o2-marker--moon"
          style={{ left: '30%' }}
          title="Lunar Habitat Baseline: 30% O₂"
        />
      </div>
      <div className="psi-o2-scale">
        <span>0%</span>
        <span>21% Earth / ISS</span>
        <span>30% Moon Base</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function ArchiveOxygenComparisonChart({ studies, selectedKey, onSelectStudy }) {
  const chartData = useMemo(() => {
    const raw = buildStudyEnvelopeSeries(studies, selectedKey);
    return raw
      .filter((row) => Number.isFinite(row.o2Min) && Number.isFinite(row.o2Max))
      .map((row) => ({
        ...row,
        o2Base: row.o2Min,
        o2Span: Math.max(2.2, row.o2Max - row.o2Min),
        color: CATEGORY_STYLE[row.category]?.color ?? '#38bdf8',
      }));
  }, [studies, selectedKey]);

  if (chartData.length === 0) {
    return (
      <div className="psi-archive-chart-wrap" style={{ color: '#94a3b8', fontSize: '12.5px' }}>
        None of the filtered investigations have published oxygen concentration bounds yet.
      </div>
    );
  }

  return (
    <div className="psi-archive-chart-wrap">
      <div className="psi-chart-caption">
        <span>
          Floating bars show each study&apos;s verified O₂ test span compared against{' '}
          <strong style={{ color: '#f8fafc' }}>21% ISS</strong> and{' '}
          <strong style={{ color: '#fbbf24' }}>30% Moon Base</strong>. Click any bar to inspect that study.
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: '#64748b' }}>
          {chartData.length} studies with reported O₂ bounds
        </span>
      </div>

      <div className="psi-chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 16, left: -12, bottom: 24 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="acronym"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              interval={0}
              angle={-28}
              textAnchor="end"
              height={44}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 10.5 }}
              tickFormatter={(v) => `${v}%`}
            />
            <ReferenceLine
              y={21}
              stroke="#e2e8f0"
              strokeDasharray="4 4"
              label={{ value: '21% ISS', position: 'insideTopRight', fill: '#e2e8f0', fontSize: 10 }}
            />
            <ReferenceLine
              y={30}
              stroke="#fbbf24"
              strokeDasharray="4 4"
              label={{ value: '30% Moon', position: 'insideTopLeft', fill: '#fbbf24', fontSize: 10 }}
            />
            <Tooltip
              cursor={{ fill: 'rgba(56, 189, 248, 0.08)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload;
                return (
                  <div className="psi-chart-tooltip">
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>{row.acronym}</div>
                    <div>
                      O₂ Range:{' '}
                      <strong>
                        {row.o2Min === row.o2Max ? `${row.o2Min}%` : `${row.o2Min}% – ${row.o2Max}%`}
                      </strong>
                    </div>
                    <div>
                      Pressure: {row.pressurePsi != null ? `${row.pressurePsi} psi` : 'Not reported'}
                    </div>
                    <div>Sensors: {row.sensorCount}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="o2Base" stackId="o2" fill="transparent" isAnimationActive={false} />
            <Bar
              dataKey="o2Span"
              stackId="o2"
              radius={[4, 4, 4, 4]}
              cursor="pointer"
              onClick={(entry) => {
                const target = entry?.id ?? entry?.acronym;
                if (target) onSelectStudy(target);
              }}
            >
              {chartData.map((entry) => {
                const isSelected = (entry.id || entry.acronym) === selectedKey;
                return (
                  <Cell
                    key={entry.id || entry.acronym}
                    fill={entry.color}
                    fillOpacity={isSelected ? 1 : 0.65}
                    stroke={isSelected ? '#f8fafc' : 'none'}
                    strokeWidth={isSelected ? 1.5 : 0}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChamberBaselineChart({ study, kpis }) {
  const o2 = getStudyOxygenBounds(study);
  const hasO2 = Number.isFinite(o2.minPct) && Number.isFinite(o2.maxPct);
  const hasPressure = Number.isFinite(kpis.pressurePsi);

  if (!hasO2 && !hasPressure) {
    return (
      <div className="psi-telemetry-viz-card">
        <div className="psi-section-title" style={{ marginBottom: 0 }}>
          Chamber Telemetry Channels
        </div>
        <p style={{ fontSize: '12.5px', color: '#fde68a', margin: 0, lineHeight: 1.5 }}>
          Atmosphere pressure, oxygen limits, and flow velocity are pending lunar mission publication for{' '}
          <strong>{study.acronym}</strong>. No placeholder values are plotted.
        </p>
      </div>
    );
  }

  const comparisonData = [
    {
      regime: 'Earth / ISS',
      o2: EARTH_BASELINE.o2Pct,
      pressurePsi: EARTH_BASELINE.pressurePsi,
    },
    {
      regime: 'Moon Base (30%)',
      o2: 30,
      pressurePsi: 10.2,
    },
    {
      regime: `${study.acronym} Study`,
      o2: hasO2 ? o2.maxPct : 0,
      o2Min: hasO2 ? o2.minPct : null,
      pressurePsi: hasPressure ? kpis.pressurePsi : 0,
    },
  ];

  return (
    <div className="psi-telemetry-viz-card">
      <div className="psi-viz-header">
        <span className="psi-section-title" style={{ marginBottom: 0 }}>
          Peak Atmosphere Telemetry vs Spacecraft Baselines
        </span>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#7dd3fc' }}>
          Earth baseline: {EARTH_BASELINE.o2Pct}% O₂ · {EARTH_BASELINE.pressurePsi} psi
        </span>
      </div>

      <div className="psi-chart-frame" style={{ height: '215px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={comparisonData} margin={{ top: 10, right: 16, left: -12, bottom: 4 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="regime" tick={{ fill: '#cbd5e1', fontSize: 11.5 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10.5 }} />
            <Tooltip
              cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload;
                return (
                  <div className="psi-chart-tooltip">
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>{label}</div>
                    <div>
                      Peak O₂: <strong>{row.o2}%</strong>
                      {row.o2Min != null && row.o2Min !== row.o2 ? ` (Min: ${row.o2Min}%)` : ''}
                    </div>
                    <div>
                      Pressure: <strong>{row.pressurePsi > 0 ? `${row.pressurePsi} psi` : 'Not reported'}</strong>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="o2" name="Peak O₂ (%)" fill="#38bdf8" radius={[5, 5, 0, 0]} maxBarSize={46} />
            <Bar
              dataKey="pressurePsi"
              name="Pressure (psi)"
              fill="#34d399"
              radius={[5, 5, 0, 0]}
              maxBarSize={46}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EmpiricalBurnCurveChart({ study }) {
  const stats = useMemo(() => getStudySeriesStats(study), [study]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [study?.psiId, study?.acronym]);

  if (stats.sampleCount === 0) return null;
  const active = stats.seriesSummaries[activeIndex] ?? stats.seriesSummaries[0];

  return (
    <div className="psi-series-box">
      <div className="psi-overview-headline">
        <span className="psi-section-title" style={{ marginBottom: 0 }}>
          Empirical Burn Curves ({stats.seriesCount} curves · {stats.sampleCount} measured samples)
        </span>
        {study.seriesSource && (
          <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#6ee7b7' }}>
            {study.seriesSource}
          </span>
        )}
      </div>

      <div className="psi-series-tabs" role="tablist" aria-label="Measured telemetry curves">
        {stats.seriesSummaries.map((series, idx) => (
          <button
            key={series.name}
            type="button"
            role="tab"
            aria-selected={idx === activeIndex}
            className={`psi-series-tab ${idx === activeIndex ? 'psi-series-tab--active' : ''}`}
            onClick={() => setActiveIndex(idx)}
          >
            {series.label} ({series.count})
          </button>
        ))}
      </div>

      <div className="psi-chart-frame" style={{ height: '240px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 16, left: -8, bottom: 16 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={active.xLabel}
              tick={{ fill: '#94a3b8', fontSize: 10.5 }}
              domain={['auto', 'auto']}
              label={{
                value: active.xLabel,
                position: 'insideBottom',
                offset: -10,
                fill: '#64748b',
                fontSize: 10.5,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Burn Duration"
              tick={{ fill: '#94a3b8', fontSize: 10.5 }}
              tickFormatter={(v) => `${v}${active.unit}`}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: 'rgba(52, 211, 153, 0.45)' }}
              content={({ active: isActive, payload }) => {
                if (!isActive || !payload?.length) return null;
                const pt = payload[0]?.payload;
                return (
                  <div className="psi-chart-tooltip">
                    <div style={{ fontWeight: 700, color: '#6ee7b7' }}>{active.label}</div>
                    <div>
                      {active.xLabel}: <strong>{pt.x}</strong>
                    </div>
                    <div>
                      Measured Burn Duration: <strong>{pt.y} {active.unit}</strong>
                    </div>
                  </div>
                );
              }}
            />
            <Scatter name={active.label} data={active.points} fill="#34d399" fillOpacity={0.85} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="psi-series-meta-row">
        <span>
          Diameter span: {active.minX.toFixed(2)} – {active.maxX.toFixed(2)} mm
        </span>
        <span>
          Observed burn duration: {active.minY.toFixed(2)} – {active.maxY.toFixed(2)} {active.unit}
        </span>
      </div>
    </div>
  );
}

function FlexRunsExplorer({ runs }) {
  const [fuelFilter, setFuelFilter] = useState('all');
  const [mixFilter, setMixFilter] = useState('all');
  const [selectedRun, setSelectedRun] = useState(null);

  const filteredRuns = useMemo(
    () => filterTelemetryRuns(runs, { fuel: fuelFilter, mix: mixFilter }),
    [runs, fuelFilter, mixFilter]
  );

  useEffect(() => {
    if (filteredRuns.length === 0) {
      setSelectedRun(null);
      return;
    }
    const exists = selectedRun && filteredRuns.some((r) => r.runId === selectedRun.runId);
    if (!exists) {
      setSelectedRun(filteredRuns[0]);
    }
  }, [filteredRuns, selectedRun]);

  return (
    <div className="psi-telemetry-viz-card">
      <div className="psi-viz-header">
        <span className="psi-section-title" style={{ marginBottom: 0 }}>
          FLEX Droplet Matrix ({filteredRuns.length} of {runs.length} experimental runs)
        </span>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
          Click any point to inspect gas mixture
        </span>
      </div>

      <div className="psi-run-toolbar">
        <div className="psi-chip-group" role="group" aria-label="Filter FLEX runs by fuel">
          {FLEX_FUEL_FILTERS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`psi-series-tab ${fuelFilter === opt.id ? 'psi-series-tab--active' : ''}`}
              onClick={() => setFuelFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="psi-chip-group" role="group" aria-label="Filter FLEX runs by gas diluent">
          {FLEX_MIX_FILTERS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`psi-series-tab ${mixFilter === opt.id ? 'psi-series-tab--active' : ''}`}
              onClick={() => setMixFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="psi-chart-frame" style={{ height: '220px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 14, left: -10, bottom: 16 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="o2Pct"
              name="Oxygen %"
              domain={['auto', 'auto']}
              tick={{ fill: '#94a3b8', fontSize: 10.5 }}
              tickFormatter={(v) => `${v}%`}
              label={{ value: 'Chamber O₂ (%)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10.5 }}
            />
            <YAxis
              type="number"
              dataKey="diameterMm"
              name="Droplet Diameter"
              tick={{ fill: '#94a3b8', fontSize: 10.5 }}
              tickFormatter={(v) => `${v}mm`}
            />
            <ZAxis range={[36, 36]} />
            <ReferenceLine x={21} stroke="#e2e8f0" strokeDasharray="3 3" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: 'rgba(56, 189, 248, 0.4)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const run = payload[0]?.payload;
                return (
                  <div className="psi-chart-tooltip">
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                      {run.runId} · {run.fuel} ({run.mix})
                    </div>
                    <div>
                      O₂: <strong>{run.o2Pct}%</strong> · Pressure: <strong>{run.pressurePsi} psi</strong>
                    </div>
                    <div>
                      Diameter: <strong>{run.diameterMm} mm</strong>
                    </div>
                  </div>
                );
              }}
            />
            <Scatter
              name="FLEX Experimental Runs"
              data={filteredRuns}
              fill="#38bdf8"
              fillOpacity={0.75}
              cursor="pointer"
              onClick={(point) => {
                const target = point?.payload ?? point;
                if (target?.runId) setSelectedRun(target);
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {selectedRun && (
        <div className="psi-run-readout">
          <div className="psi-overview-headline">
            <strong style={{ fontSize: '12px', color: '#f8fafc' }}>
              Selected Run: {selectedRun.runId} ({selectedRun.fuel} · {selectedRun.mix})
            </strong>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#7dd3fc' }}>
              {selectedRun.pressureMmhg} mmHg ({selectedRun.pressurePsi} psi) · {selectedRun.diameterMm} mm droplet
            </span>
          </div>

          <div className="psi-gas-bar" aria-label="Chamber gas composition percentage bar">
            <div style={{ width: `${selectedRun.o2Pct}%`, background: '#38bdf8' }} title={`O₂: ${selectedRun.o2Pct}%`} />
            <div style={{ width: `${selectedRun.n2Pct}%`, background: '#64748b' }} title={`N₂: ${selectedRun.n2Pct}%`} />
            {selectedRun.co2Pct > 0 && (
              <div style={{ width: `${selectedRun.co2Pct}%`, background: '#34d399' }} title={`CO₂: ${selectedRun.co2Pct}%`} />
            )}
            {selectedRun.hePct > 0 && (
              <div style={{ width: `${selectedRun.hePct}%`, background: '#a78bfa' }} title={`He: ${selectedRun.hePct}%`} />
            )}
          </div>

          <div className="psi-gas-legend">
            <span style={{ color: '#38bdf8' }}>O₂ {selectedRun.o2Pct}%</span>
            <span style={{ color: '#cbd5e1' }}>N₂ {selectedRun.n2Pct}%</span>
            <span style={{ color: '#34d399' }}>CO₂ {selectedRun.co2Pct}%</span>
            <span style={{ color: '#a78bfa' }}>He {selectedRun.hePct}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StudyInspectorPanel({ study, audience, allFlexRuns, inspectorRef }) {
  const isStudent = audience === 'Student';
  const [vizTab, setVizTab] = useState('envelope');
  const seriesStats = useMemo(() => getStudySeriesStats(study), [study]);
  const isDropletStudy = useMemo(() => isDropletTelemetryStudy(study), [study]);

  useEffect(() => {
    if (seriesStats.sampleCount > 0) {
      setVizTab('curves');
    } else if (!isStudent && isDropletStudy && /flex/i.test(String(study?.acronym ?? ''))) {
      setVizTab('runs');
    } else {
      setVizTab('envelope');
    }
  }, [study?.psiId, study?.acronym, seriesStats.sampleCount, isDropletStudy, isStudent]);

  const kpis = useMemo(
    () =>
      computeTelemetryKPIs({
        study,
        runs: /flex/i.test(String(study?.acronym ?? '')) ? allFlexRuns : [],
      }),
    [study, allFlexRuns]
  );

  if (!study) return null;

  const catMeta = CATEGORY_STYLE[study.category] ?? {
    label: String(study.category ?? 'PSI').toUpperCase(),
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.12)',
  };
  const tier = getStudyTelemetryTier(study);
  const o2 = getStudyOxygenBounds(study);
  const cond = study.conditions ?? {};

  const pressureText =
    study.ambientPressure ||
    (Number.isFinite(cond.pressurePsi) ? `${cond.pressurePsi} psi` : 'Pending / unreported');
  const flowText = Number.isFinite(cond.flowVelocity)
    ? cond.flowVelocity === 0
      ? '0 m/s (quiescent)'
      : `${cond.flowVelocity} m/s`
    : 'Unreported';

  const summary = isStudent
    ? study.aiSummary?.student ?? study.objective
    : study.objective;

  const studentConceptTip =
    study.category === 'prevention'
      ? 'Why it matters in space: without gravity lifting hot exhaust, even plastics or gases that look safe in a classroom can stay burning in slow airflow or high-oxygen cabins.'
      : study.category === 'detection'
        ? 'Why it matters in space: smoke does not rise to a ceiling detector in zero gravity — spacecraft rely on air fans and particle sizing to spot invisible smoldering.'
        : 'Why it matters in space: putting out a fire with CO₂, nitrogen dilution, or reduced pressure works differently when buoyancy cannot pull fresh oxygen into the flame.';

  const studentOxygenSummary =
    o2.maxPct == null
      ? 'Waiting for Moon mission plan'
      : o2.maxPct > 25
        ? 'High oxygen — burns faster than Earth'
        : o2.minPct < 19
          ? 'Low oxygen — tests where flames go out'
          : 'Similar to Earth classroom air (21%)';

  const showRunsExplorer = !isStudent && isDropletStudy && /flex/i.test(String(study.acronym ?? ''));

  return (
    <article ref={inspectorRef} className="psi-inspector" aria-label={`Detailed telemetry for ${study.acronym}`}>
      <header className="psi-inspector-head">
        <div>
          <div className="psi-inspector-kicker">
            <span>{study.psiId ?? study.archiveCode ?? 'NASA PSI'}</span>
            <span className="psi-dir-badge" style={{ color: catMeta.color, background: catMeta.bg }}>
              {catMeta.label}
            </span>
            <span
              className="psi-dir-badge"
              style={{ color: '#cbd5e1', background: '#111827', border: '1px solid #1e293b' }}
            >
              {String(study.fuelType ?? 'mixed').toUpperCase()}
            </span>
          </div>
          <h2 className="psi-inspector-title">
            {study.acronym} — {study.title}
          </h2>
          <div className="psi-inspector-sub">
            {getHardwareFamily(study.hardware)} · {study.gravityLevel ?? 'microgravity'}
          </div>
        </div>
      </header>

      <div
        className={`psi-status-callout ${
          tier === 'empirical'
            ? 'psi-status-callout--empirical'
            : tier === 'upcoming'
              ? 'psi-status-callout--upcoming'
              : 'psi-status-callout--published'
        }`}
      >
        {tier === 'empirical' && (
          <>
            <strong>Empirical Telemetry Available:</strong> Includes {seriesStats.sampleCount} measured burn samples
            across {seriesStats.seriesCount} droplet curves extracted from NASA PSI artifacts.
          </>
        )}
        {tier === 'upcoming' && (
          <>
            <strong>Pending Lunar PSI Data Gap:</strong> Planned for partial-gravity lunar testing; experimental gas
            concentrations and telemetry curves are not published yet.
          </>
        )}
        {tier === 'published' && (
          <>
            <strong>Verified Experimental Envelope:</strong> Documents tested chamber limits, fuels, and sensor hardware
            from NASA PSI; sample-by-sample time-series arrays are not attached to this archive record.
          </>
        )}
      </div>

      <p className="psi-inspector-summary">{summary}</p>

      {isStudent && (
        <div
          style={{
            padding: '11px 14px',
            borderRadius: '9px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(52, 211, 153, 0.32)',
            fontSize: '12.5px',
            color: '#d1fae5',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: '#6ee7b7', display: 'block', marginBottom: '2px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            STUDENT PHYSICS CONCEPT
          </strong>
          {studentConceptTip}
        </div>
      )}

      {/* Audience-Adapted 4-Metric Strip */}
      {isStudent ? (
        <section className="psi-kpi-strip" aria-label="Student-friendly experiment summary">
          <div className="psi-kpi-cell">
            <span className="psi-kpi-label">AIR VS EARTH ROOM</span>
            <span className="psi-kpi-value">{o2.label}</span>
            <span className="psi-kpi-delta" style={{ color: '#6ee7b7' }}>{studentOxygenSummary}</span>
          </div>
          <div className="psi-kpi-cell">
            <span className="psi-kpi-label">GRAVITY SETTING</span>
            <span className="psi-kpi-value">
              {String(study.gravityLevel ?? 'microgravity').includes('partial') ? 'Moon 1/6 Gravity' : 'Weightless Orbit (0g)'}
            </span>
            <span className="psi-kpi-delta">{getHardwareFamily(study.hardware)}</span>
          </div>
          <div className="psi-kpi-cell">
            <span className="psi-kpi-label">WHAT TESTED BURNING</span>
            <span className="psi-kpi-value" style={{ fontSize: '12.5px', fontFamily: 'var(--font-sans)' }}>
              {study.fuel ?? 'Pending payload'}
            </span>
          </div>
          <div className="psi-kpi-cell">
            <span className="psi-kpi-label">EVIDENCE READY</span>
            <span className="psi-kpi-value">
              {tier === 'empirical' ? `${seriesStats.sampleCount} Space Runs` : tier === 'upcoming' ? 'Future Mission' : 'Verified Specs'}
            </span>
            <span className="psi-kpi-delta">
              {tier === 'upcoming' ? 'Real gap — no invented data' : 'NASA ISS / Cygnus record'}
            </span>
          </div>
        </section>
      ) : (
        <section className="psi-kpi-strip" aria-label="Key telemetry metrics versus Earth baseline">
          <div className="psi-kpi-cell">
            <span className="psi-kpi-label">OXYGEN ENVELOPE</span>
            <span className="psi-kpi-value">{o2.label}</span>
            <span
              className={`psi-kpi-delta ${
                kpis.o2DeltaEarth != null && kpis.o2DeltaEarth > 0 ? 'psi-kpi-delta--warn' : ''
              }`}
            >
              {kpis.o2DeltaEarth == null
                ? 'Pending publication'
                : kpis.o2DeltaEarth === 0
                  ? 'Matches 21% ISS nominal'
                  : `${kpis.o2DeltaEarth > 0 ? '+' : ''}${kpis.o2DeltaEarth}% nominal vs Earth`}
            </span>
          </div>

          <div className="psi-kpi-cell">
            <span className="psi-kpi-label">CABIN PRESSURE</span>
            <span className="psi-kpi-value">{pressureText}</span>
            <span className="psi-kpi-delta">
              {kpis.pressureMmhg != null ? `${kpis.pressureMmhg} mmHg` : 'Unreported'}
            </span>
          </div>

          <div className="psi-kpi-cell">
            <span className="psi-kpi-label">AIRFLOW VELOCITY</span>
            <span className="psi-kpi-value">{flowText}</span>
            <span className="psi-kpi-delta">{study.fuel ?? 'Fuel unspecified'}</span>
          </div>

          <div className="psi-kpi-cell">
            <span className="psi-kpi-label">TELEMETRY DEPTH</span>
            <span className="psi-kpi-value">
              {tier === 'empirical'
                ? `${seriesStats.sampleCount} runs`
                : tier === 'upcoming'
                  ? 'Lunar gap'
                  : `${study.sensors?.length ?? 0} sensors`}
            </span>
            <span className={`psi-kpi-delta ${tier === 'empirical' ? 'psi-kpi-delta--ok' : ''}`}>
              {tier === 'empirical'
                ? 'Empirical curves ready'
                : tier === 'upcoming'
                  ? 'Awaiting CLPS flight'
                  : 'Published condition bounds'}
            </span>
          </div>
        </section>
      )}

      {isStudent && Array.isArray(study.earthApplications) && study.earthApplications.length > 0 && (
        <section className="psi-earth-box" aria-label="Earth spin-off impact" style={{ borderTop: 'none', paddingTop: 0 }}>
          <div className="psi-section-title" style={{ color: '#34d399', marginBottom: '2px' }}>
            How This Space Test Protects People on Earth
          </div>
          <ul className="psi-list-clean">
            {study.earthApplications.map((app) => (
              <li key={app}>{app}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="psi-conditions-panel" aria-label="Atmosphere visual gauge">
        <OxygenEnvelopeBar
          minPct={o2.minPct}
          maxPct={o2.maxPct}
          emptyLabel={tier === 'upcoming' ? 'Pending lunar launch' : 'Not specified'}
        />
      </section>

      {/* Focused Telemetry Chart Switcher */}
      <section aria-label="Interactive study telemetry charts" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="psi-viz-header">
          <span className="psi-section-title" style={{ marginBottom: 0 }}>
            {isStudent ? 'Visual Comparison Chart' : 'Telemetry Visualization'}
          </span>
          <div className="psi-mode-switch" role="tablist" aria-label="Telemetry chart view">
            {seriesStats.sampleCount > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={vizTab === 'curves'}
                className={`psi-mode-btn ${vizTab === 'curves' ? 'psi-mode-btn--active' : ''}`}
                onClick={() => setVizTab('curves')}
              >
                Burn Curves ({seriesStats.sampleCount})
              </button>
            )}
            {showRunsExplorer && (
              <button
                type="button"
                role="tab"
                aria-selected={vizTab === 'runs'}
                className={`psi-mode-btn ${vizTab === 'runs' ? 'psi-mode-btn--active' : ''}`}
                onClick={() => setVizTab('runs')}
              >
                258 Gas Runs
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={vizTab === 'envelope'}
              className={`psi-mode-btn ${vizTab === 'envelope' ? 'psi-mode-btn--active' : ''}`}
              onClick={() => setVizTab('envelope')}
            >
              Chamber vs Baselines
            </button>
          </div>
        </div>

        {vizTab === 'curves' && seriesStats.sampleCount > 0 && (
          <EmpiricalBurnCurveChart study={study} />
        )}
        {vizTab === 'runs' && showRunsExplorer && <FlexRunsExplorer runs={allFlexRuns} />}
        {vizTab === 'envelope' && <ChamberBaselineChart study={study} kpis={kpis} />}
      </section>

      <section className="psi-detail-grid" aria-label="Measured variables and sensors">
        <div>
          <div className="psi-section-title">What NASA Measured</div>
          {Array.isArray(study.variables) && study.variables.length > 0 ? (
            <ul className="psi-list-clean">
              {study.variables.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <span style={{ fontSize: '12px', color: '#64748b' }}>No test variables listed yet.</span>
          )}
        </div>

        <div>
          <div className="psi-section-title">
            Onboard Instruments ({study.sensors?.length ?? 0})
          </div>
          {Array.isArray(study.sensors) && study.sensors.length > 0 ? (
            <div className="psi-tag-list">
              {study.sensors.map((sensor) => (
                <span key={sensor} className="psi-tag">
                  {sensor}
                </span>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: '12px', color: '#64748b' }}>Instrumentation list pending.</span>
          )}
        </div>
      </section>

      {!isStudent && Array.isArray(study.earthApplications) && study.earthApplications.length > 0 && (
        <section className="psi-earth-box" aria-label="Earth spin-off impact">
          <div className="psi-section-title" style={{ color: '#34d399', marginBottom: '2px' }}>
            Why It Matters on Earth
          </div>
          <ul className="psi-list-clean">
            {study.earthApplications.map((app) => (
              <li key={app}>{app}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="psi-inspector-footer">
        {study.sourceUrl ? (
          <a
            href={study.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="psi-external-link"
          >
            Official NASA PSI Source ↗
          </a>
        ) : (
          <span style={{ fontSize: '11.5px', color: '#64748b' }}>Source URL not listed</span>
        )}
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
          Strictly verified NASA PSI telemetry
        </span>
      </footer>
    </article>
  );
}

export default function PsiCatalogPage() {
  const { id: routeStudyId } = useParams();
  const { audience } = useApp();
  const [investigations, setInvestigations] = useState(INVESTIGATIONS);
  const [dataSource, setDataSource] = useState('local-processed');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [fuelType, setFuelType] = useState('all');
  const [hardware, setHardware] = useState('all');
  const [dataStatus, setDataStatus] = useState('all');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [overviewMode, setOverviewMode] = useState('summary');
  const [selectedKey, setSelectedKey] = useState(null);
  const inspectorRef = useRef(null);

  const allFlexRuns = useMemo(() => getAllFlexRuns(), []);

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

  useEffect(() => {
    if (!routeStudyId || investigations.length === 0) return;
    const matched = investigations.find((item) => matchesStudyIdentifier(item, routeStudyId));
    if (matched) {
      setSelectedKey(getStudyRouteKey(matched));
    }
  }, [routeStudyId, investigations]);

  const filtered = useMemo(
    () => filterPsiInvestigations(investigations, { query, category, fuelType, hardware, dataStatus }),
    [investigations, query, category, fuelType, hardware, dataStatus]
  );

  const overview = useMemo(() => summarizeCatalogOverview(filtered), [filtered]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedKey(null);
      return;
    }
    const stillVisible = filtered.some((item) => getStudyRouteKey(item) === selectedKey);
    if (!stillVisible) {
      const routeMatched = routeStudyId
        ? filtered.find((item) => matchesStudyIdentifier(item, routeStudyId))
        : null;
      const preferred =
        routeMatched ??
        filtered.find((item) => getStudyTelemetryTier(item) === 'empirical') ??
        filtered[0];
      setSelectedKey(getStudyRouteKey(preferred));
    }
  }, [filtered, selectedKey, routeStudyId]);

  const selectedStudy = useMemo(
    () => filtered.find((item) => getStudyRouteKey(item) === selectedKey) ?? filtered[0] ?? null,
    [filtered, selectedKey]
  );

  const secondaryFilterCount =
    (fuelType !== 'all' ? 1 : 0) + (hardware !== 'all' ? 1 : 0) + (dataStatus !== 'all' ? 1 : 0);
  const hasFilters = Boolean(query.trim() || category !== 'all' || secondaryFilterCount > 0);
  const activeGoal = CATALOG_PILLAR_GUIDE.find((g) => g.id === category) ?? CATALOG_PILLAR_GUIDE[0];

  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setFuelType('all');
    setHardware('all');
    setDataStatus('all');
  };

  const barTotal = Math.max(overview.total, 1);

  return (
    <div className="psi-catalog-page">
      <div className="psi-catalog-shell">
        <header className="psi-header">
          <div>
            <div className="psi-eyebrow-row">
              <span>NASA PHYSICAL SCIENCES INFORMATICS // COMBUSTION TELEMETRY ({investigations.length} STUDIES)</span>
              <span className="psi-audience-chip">
                {audience === 'Student' ? 'STUDENT LEARNING VIEW' : 'ENGINEER TELEMETRY VIEW'}
              </span>
            </div>
            <h1 className="psi-title">NASA PSI Telemetry & Investigation Explorer</h1>
            <p className="psi-subtitle">
              {audience === 'Student'
                ? 'Start with the archive summary or oxygen comparison chart, then pick any study below to explore its atmosphere limits, sensors, and real burn data.'
                : 'Inspect archive-wide oxygen envelopes first, then select any experiment in the directory for inline chamber telemetry, burn curves, and gas-mix runs.'}
            </p>
          </div>

          <div className="psi-header-actions">
            <span className={`psi-source-badge ${dataSource === 'api' ? 'psi-source-badge--live' : ''}`}>
              SOURCE: {dataSource === 'api' ? 'MONGODB / API' : 'VERIFIED PSI ARCHIVE'}
            </span>
            {audience === 'Engineer' ? (
              <>
                <button
                  type="button"
                  className="psi-action-btn psi-action-btn--csv"
                  disabled={filtered.length === 0}
                  onClick={() =>
                    triggerDownload(
                      'nasa-psi-investigations.csv',
                      buildPsiDatasetCsv(filtered),
                      'text/csv;charset=utf-8;'
                    )
                  }
                >
                  Extract CSV ({filtered.length})
                </button>
                <button
                  type="button"
                  className="psi-action-btn psi-action-btn--json"
                  disabled={filtered.length === 0}
                  onClick={() =>
                    triggerDownload(
                      'nasa-psi-investigations.json',
                      JSON.stringify(filtered, null, 2),
                      'application/json;charset=utf-8;'
                    )
                  }
                >
                  Extract JSON
                </button>
              </>
            ) : (
              <span className="psi-audience-chip" style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>
                SIMPLIFIED LEARNING MODE · RAW DATA EXPORTS HIDDEN
              </span>
            )}
            <Link to="/compare" className="psi-action-btn">
              Compare Studies ↗
            </Link>
          </div>
        </header>

        {/* Stage 1: General Archive Telemetry Overview with Chart Switch */}
        <section className="psi-overview-section" aria-label="General archive telemetry overview">
          <div className="psi-overview-bar-head">
            <span className="psi-overview-kicker" style={{ color: '#94a3b8' }}>
              Stage 1 · General Archive Telemetry ({overview.total} matching studies)
            </span>
            <div className="psi-mode-switch" role="tablist" aria-label="General archive display mode">
              <button
                type="button"
                role="tab"
                aria-selected={overviewMode === 'summary'}
                className={`psi-mode-btn ${overviewMode === 'summary' ? 'psi-mode-btn--active' : ''}`}
                onClick={() => setOverviewMode('summary')}
              >
                Overview Summary
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={overviewMode === 'chart'}
                className={`psi-mode-btn ${overviewMode === 'chart' ? 'psi-mode-btn--active' : ''}`}
                onClick={() => setOverviewMode('chart')}
              >
                Compare All Studies O₂
              </button>
            </div>
          </div>

          {overviewMode === 'summary' ? (
            <div className="psi-overview-band psi-overview-band--embedded">
              <div className="psi-overview-col">
                <div className="psi-overview-headline">
                  <div className="psi-overview-count">
                    {overview.total}
                    <span>of {investigations.length} matching studies</span>
                  </div>
                  <div className="psi-readiness-row">
                    <span className="psi-readiness-item">
                      <span className="psi-dot" style={{ background: '#34d399' }} />
                      {overview.telemetryCounts.empiricalSamples} empirical samples (
                      {overview.telemetryCounts.empiricalStudies} study)
                    </span>
                    <span className="psi-readiness-item">
                      <span className="psi-dot" style={{ background: '#38bdf8' }} />
                      {overview.telemetryCounts.publishedStudies} published
                    </span>
                    <span className="psi-readiness-item">
                      <span className="psi-dot" style={{ background: '#fbbf24' }} />
                      {overview.telemetryCounts.upcomingStudies} lunar gap
                    </span>
                  </div>
                </div>

                <div className="psi-pillar-bar" aria-label="Distribution by fire safety goal">
                  {[
                    { id: 'prevention', count: overview.byCategory.prevention, color: '#38bdf8', label: 'Prevent Fires' },
                    { id: 'detection', count: overview.byCategory.detection, color: '#fbbf24', label: 'Detect Smoke' },
                    { id: 'suppression', count: overview.byCategory.suppression, color: '#34d399', label: 'Suppress Flames' },
                  ].map((seg) => (
                    <button
                      key={seg.id}
                      type="button"
                      title={`${seg.label}: ${seg.count} studies`}
                      className="psi-pillar-segment"
                      style={{
                        width: `${(seg.count / barTotal) * 100}%`,
                        background: seg.color,
                        opacity: category === 'all' || category === seg.id ? 0.9 : 0.28,
                      }}
                      onClick={() => setCategory((prev) => (prev === seg.id ? 'all' : seg.id))}
                    />
                  ))}
                </div>

                <div className="psi-pillar-legend">
                  {[
                    { id: 'prevention', count: overview.byCategory.prevention, color: '#38bdf8', label: 'Prevent Fires' },
                    { id: 'detection', count: overview.byCategory.detection, color: '#fbbf24', label: 'Detect Smoke' },
                    { id: 'suppression', count: overview.byCategory.suppression, color: '#34d399', label: 'Suppress Flames' },
                  ].map((seg) => (
                    <button
                      key={seg.id}
                      type="button"
                      className={`psi-legend-btn ${category === seg.id ? 'psi-legend-btn--active' : ''}`}
                      onClick={() => setCategory((prev) => (prev === seg.id ? 'all' : seg.id))}
                    >
                      <span className="psi-dot" style={{ background: seg.color }} />
                      <span>{seg.label}</span>
                      <span style={{ color: '#64748b', fontFamily: 'var(--font-mono)' }}>{seg.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="psi-overview-col psi-overview-col--divider">
                <OxygenEnvelopeBar
                  minPct={overview.oxygenSpan.minPct}
                  maxPct={overview.oxygenSpan.maxPct}
                  emptyLabel="No O₂ bounds in view"
                />
                <div className="psi-o2-refs">
                  <span>
                    Pressure span:{' '}
                    <strong style={{ color: '#e2e8f0' }}>
                      {Number.isFinite(overview.pressureSpan.minPsi)
                        ? overview.pressureSpan.minPsi === overview.pressureSpan.maxPsi
                          ? `${overview.pressureSpan.minPsi} psi`
                          : `${overview.pressureSpan.minPsi} – ${overview.pressureSpan.maxPsi} psi`
                        : 'Not reported'}
                    </strong>
                  </span>
                  <span>
                    Chambers: <strong style={{ color: '#e2e8f0' }}>{overview.hardwareCount}</strong>
                  </span>
                  <span>
                    Earth applications: <strong style={{ color: '#34d399' }}>{overview.earthApplicationsCount}</strong>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <ArchiveOxygenComparisonChart
              studies={filtered}
              selectedKey={getStudyRouteKey(selectedStudy)}
              onSelectStudy={(id) => {
                const match = filtered.find((s) => matchesStudyIdentifier(s, id));
                if (match) setSelectedKey(getStudyRouteKey(match));
              }}
            />
          )}
        </section>

        {/* Simplified Filter Bar */}
        <section className="psi-filter-bar" aria-label="Filter studies simply" data-tour="psi-catalog-controls">
          <div className="psi-filter-main-row">
            <div className="psi-search-wrap">
              <input
                type="search"
                className="psi-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by study name (FLEX, Saffire), fuel, oxygen %, or sensor..."
                aria-label="Search PSI studies"
              />
            </div>

            <div className="psi-goal-tabs" role="group" aria-label="Filter by safety goal">
              {CATALOG_PILLAR_GUIDE.map((goal) => {
                const active = category === goal.id;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    aria-pressed={active}
                    className={`psi-goal-tab ${active ? 'psi-goal-tab--active' : ''}`}
                    onClick={() => setCategory(goal.id)}
                  >
                    {goal.label}
                  </button>
                );
              })}
            </div>

            <div className="psi-filter-controls-right">
              <button
                type="button"
                aria-expanded={showMoreFilters}
                className={`psi-refine-toggle ${showMoreFilters || secondaryFilterCount > 0 ? 'psi-refine-toggle--active' : ''}`}
                onClick={() => setShowMoreFilters((prev) => !prev)}
              >
                <span>More Filters</span>
                {secondaryFilterCount > 0 && <span className="psi-count-pill">{secondaryFilterCount}</span>}
              </button>

              {hasFilters && (
                <button type="button" className="psi-action-btn" onClick={resetFilters}>
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="psi-goal-helper">
            <span>
              <strong style={{ color: activeGoal.color }}>{activeGoal.label}:</strong> {activeGoal.description}
            </span>
            {secondaryFilterCount > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#7dd3fc' }}>
                Extra filters active ({secondaryFilterCount}) — click More Filters to adjust
              </span>
            )}
          </div>

          {showMoreFilters && (
            <div className="psi-refine-drawer">
              <div className="psi-select-group">
                <label htmlFor="psi-fuel-select" className="psi-select-label">
                  1. Material / Fuel State
                </label>
                <select
                  id="psi-fuel-select"
                  className="tri-select"
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                >
                  {CATALOG_FUEL_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="psi-select-hint">What caught fire in the test (plastics, liquid fuel, gas, or smoke).</span>
              </div>

              <div className="psi-select-group">
                <label htmlFor="psi-hardware-select" className="psi-select-label">
                  2. Spacecraft Test Chamber
                </label>
                <select
                  id="psi-hardware-select"
                  className="tri-select"
                  value={hardware}
                  onChange={(e) => setHardware(e.target.value)}
                >
                  {CATALOG_HARDWARE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="psi-select-hint">Which NASA rack or spacecraft module hosted the experiment.</span>
              </div>

              <div className="psi-select-group">
                <label htmlFor="psi-data-select" className="psi-select-label">
                  3. Telemetry Availability
                </label>
                <select
                  id="psi-data-select"
                  className="tri-select"
                  value={dataStatus}
                  onChange={(e) => setDataStatus(e.target.value)}
                >
                  {CATALOG_DATA_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="psi-select-hint">Filter between empirical measured runs, published specs, or upcoming lunar gaps.</span>
              </div>
            </div>
          )}
        </section>

        {/* Stage 2: Digestible Directory + Focused Detailed Telemetry Inspector */}
        {filtered.length === 0 ? (
          <div className="psi-directory" style={{ padding: '28px', textAlign: 'center', color: '#94a3b8' }}>
            No PSI investigations match these filters.{' '}
            <button
              type="button"
              className="psi-primary-cta"
              style={{ marginLeft: '10px', padding: '6px 12px' }}
              onClick={resetFilters}
            >
              Show all {investigations.length} studies
            </button>
          </div>
        ) : (
          <section className="psi-workspace" aria-label="Study directory and detailed telemetry view">
            <div className="psi-directory">
              <div className="psi-directory-head">
                <span>STAGE 2 · SELECT A STUDY ({filtered.length})</span>
                <span>O₂ RANGE</span>
              </div>
              <div className="psi-directory-list" role="listbox" aria-label="Filtered NASA PSI studies">
                {filtered.map((inv) => {
                  const key = getStudyRouteKey(inv);
                  const selected = key === getStudyRouteKey(selectedStudy);
                  const catMeta = CATEGORY_STYLE[inv.category] ?? {
                    label: String(inv.category ?? 'PSI').toUpperCase(),
                    color: '#94a3b8',
                    bg: 'rgba(148, 163, 184, 0.12)',
                  };
                  const tier = getStudyTelemetryTier(inv);
                  const o2 = getStudyOxygenBounds(inv);
                  const rowSeriesCount = tier === 'empirical' ? getStudySeriesStats(inv).sampleCount : 0;

                  return (
                    <button
                      key={key}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`psi-dir-item ${selected ? 'psi-dir-item--selected' : ''}`}
                      onClick={() => {
                        setSelectedKey(key);
                        if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
                          inspectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                    >
                      <div className="psi-dir-top">
                        <span className="psi-dir-acronym">{inv.acronym}</span>
                        <div className="psi-dir-badges">
                          {tier === 'empirical' && (
                            <span className="psi-dir-badge psi-dir-badge--empirical">
                              {rowSeriesCount} RUNS
                            </span>
                          )}
                          {tier === 'upcoming' && (
                            <span className="psi-dir-badge psi-dir-badge--upcoming">LUNAR GAP</span>
                          )}
                          <span
                            className="psi-dir-badge"
                            style={{ color: catMeta.color, background: catMeta.bg }}
                          >
                            {catMeta.label}
                          </span>
                        </div>
                      </div>
                      <div className="psi-dir-title">{inv.title}</div>
                      <div className="psi-dir-meta">
                        <span>{getHardwareFamily(inv.hardware)}</span>
                        <span className="psi-dir-o2">{o2.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <StudyInspectorPanel
              study={selectedStudy}
              audience={audience}
              allFlexRuns={allFlexRuns}
              inspectorRef={inspectorRef}
            />
          </section>
        )}
      </div>
    </div>
  );
}
