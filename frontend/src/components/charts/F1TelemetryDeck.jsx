import { useEffect, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import FlammabilityChart from './FlammabilityChart.jsx';
import TimeSeriesChart from './TimeSeriesChart.jsx';
import { EARTH_BASELINE } from '../../services/telemetry-f1.js';
import { api } from '../../services/api.js';

const EMPIRICAL_COLORS = ['#38bdf8', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#a78bfa'];

function getStudyEmpiricalSeries(study) {
  const rawSeries = Array.isArray(study?.series) ? study.series : [];
  const valid = rawSeries.filter(
    (s) => Array.isArray(s?.samples) && s.samples.length > 0
  );
  if (!valid.length) return null;

  const onlyTcOrFlux = valid.every((s) => /temp|thermocouple|flux|radiant|heat/i.test(s.name ?? ''));
  if (onlyTcOrFlux) return null;

  const seriesList = valid.map((s, idx) => ({
    name: s.name ?? `series_${idx + 1}`,
    label: s.label ?? s.name ?? `Series ${idx + 1}`,
    unit: s.unit ?? 's',
    xLabel: s.xLabel ?? 'X',
    color: EMPIRICAL_COLORS[idx % EMPIRICAL_COLORS.length],
    sourceUrl: s.sourceUrl ?? study?.sourceUrl ?? null,
    seriesSource: s.seriesSource ?? study?.seriesSource ?? null,
    points: s.samples
      .filter((pair) => Array.isArray(pair) && pair.length >= 2)
      .map(([x, y]) => ({ x: Number(x), y: Number(y) }))
      .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y)),
  }));

  const totalPoints = seriesList.reduce((acc, s) => acc + s.points.length, 0);
  if (!totalPoints) return null;

  const first = seriesList[0];
  const xLabel = first.xLabel ?? 'X';
  const unitMatch = /\(([^)]+)\)/.exec(xLabel);
  const xUnit = unitMatch ? ` ${unitMatch[1]}` : '';
  const yLabel = first.name?.includes('burn_duration') ? 'Burn duration' : first.label;

  return {
    seriesList,
    totalPoints,
    xLabel,
    xUnit,
    yLabel,
    yUnit: first.unit,
    seriesSource: study?.seriesSource ?? first.seriesSource,
    sourceUrl: study?.sourceUrl ?? first.sourceUrl,
  };
}

function F1Tooltip({ active, payload, label, theme, suffixMap = {}, extraFields = [] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div
      style={{
        background: 'rgba(6, 10, 20, 0.96)',
        border: `1px solid ${theme.border}`,
        borderRadius: '8px',
        padding: '8px 11px',
        fontFamily: 'var(--font-mono)',
        fontSize: '10.5px',
        color: '#f8fafc',
        boxShadow: `0 8px 24px rgba(0, 0, 0, 0.6), 0 0 14px ${theme.glow}`,
      }}
    >
      <div style={{ color: theme.primary, fontWeight: 700, marginBottom: '4px' }}>
        {label}
      </div>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '14px',
            color: entry.color ?? '#cbd5e1',
          }}
        >
          <span>{entry.name}</span>
          <strong>
            {entry.value != null ? `${entry.value}${suffixMap[entry.dataKey] ?? ''}` : 'N/A'}
          </strong>
        </div>
      ))}
      {row &&
        extraFields.map((field) =>
          row[field.key] != null ? (
            <div
              key={field.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '14px',
                color: '#94a3b8',
              }}
            >
              <span>{field.label}</span>
              <strong>{`${row[field.key]}${field.suffix ?? ''}`}</strong>
            </div>
          ) : null
        )}
    </div>
  );
}

function getStudyMeasuredSeries(study, measurements = []) {
  const rawSeries = Array.isArray(study?.series) ? study.series : [];
  if (rawSeries.length > 0) {
    const temperature = rawSeries.find((item) => /temp|thermocouple/i.test(item.name ?? ''));
    const radiantFlux = rawSeries.find((item) => /flux|radiant|heat/i.test(item.name ?? ''));
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
    if (data.length) return { data, source: 'PSI Record Series' };
  }

  if (Array.isArray(measurements) && measurements.length > 0) {
    const data = measurements
      .map((m, idx) => ({
        time: Number(m.t ?? m.time ?? m.timeSec ?? idx),
        tc: m.temperatureC ?? m.tc ?? m.tempC ?? null,
        flux: m.radiantFluxKwM2 ?? m.flux ?? null,
      }))
      .filter((pt) => Number.isFinite(pt.time) && (pt.tc != null || pt.flux != null))
      .sort((a, b) => a.time - b.time);
    if (data.length) return { data, source: 'MongoDB Measurements' };
  }

  return null;
}

export default function F1TelemetryDeck({
  study,
  theme,
  runSeries = [],
  envelopeSeries = [],
  activeRun = null,
  onSelectRun,
  onSelectStudy,
  onResetFilters,
  channels = { o2: true, pressure: true, secondary: true, diluent: true },
  baselineOverlay = true,
  measurements = [],
  showRunTelemetry = true,
}) {
  const [showSchematicFallback, setShowSchematicFallback] = useState(false);
  const [activeEmpiricalName, setActiveEmpiricalName] = useState('all');
  const [trendState, setTrendState] = useState({ status: 'idle', events: [] });
  const measuredTimeSeries = getStudyMeasuredSeries(study, measurements);
  const empiricalSeries = getStudyEmpiricalSeries(study);
  const hasRuns = showRunTelemetry && runSeries.length > 0;
  const gradId = `f1-o2-grad-${theme.id}`;

  useEffect(() => {
    const rawSeries = Array.isArray(study?.series)
      ? study.series.filter((s) => Array.isArray(s?.samples) && s.samples.length >= 3)
      : [];
    if (!rawSeries.length) {
      setTrendState({ status: 'idle', events: [] });
      return;
    }

    let cancelled = false;
    setTrendState({ status: 'loading', events: [] });
    api
      .trends(
        rawSeries.map((s) => ({
          name: s.label ?? s.name ?? 'series',
          unit: s.unit ?? 's',
          samples: s.samples,
        }))
      )
      .then((res) => {
        if (cancelled) return;
        const events = (res?.results ?? []).flatMap((seriesRes) =>
          (seriesRes?.events ?? []).map((ev) => ({
            seriesName: seriesRes.name,
            ...ev,
          }))
        );
        setTrendState({ status: 'ready', events });
      })
      .catch(() => {
        if (!cancelled) setTrendState({ status: 'unavailable', events: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [study?.psiId, study?.series]);

  return (
    <div className="f1-charts-col">
      {/* CHANNEL 1: Run-by-Run Measured Telemetry OR No-Data Placeholder */}
      {showRunTelemetry && !hasRuns ? (
        <section className="f1-channel-card" aria-label="No matching experimental run telemetry">
          <div className="f1-channel-head">
            <div className="f1-channel-title">
              <span className="f1-channel-bar" />
              CH-01 // EXPERIMENTAL RUN TELEMETRY
            </div>
            <div className="f1-channel-sub">0 matching runs</div>
          </div>
          <div className="f1-no-data" role="status">
            <span className="f1-no-data__badge">NO DATA</span>
            <div className="f1-no-data__title">No experimental runs match the active filters</div>
            <p className="f1-no-data__desc">
              Adjust the fuel, diluent mix, or O₂ band filters above to inspect recorded NASA PSI test runs.
            </p>
            {onResetFilters && (
              <button type="button" className="f1-btn f1-btn--primary" onClick={onResetFilters}>
                Reset Telemetry Filters
              </button>
            )}
          </div>
        </section>
      ) : hasRuns ? (
        <>
          {channels.o2 && (
            <section className="f1-channel-card" aria-label="Channel 1 Oxygen and Diluent Telemetry">
              <div className="f1-channel-head">
                <div className="f1-channel-title">
                  <span className="f1-channel-bar" />
                  Oxygen &amp; Suppressant Mix ({runSeries.length} FLEX runs)
                </div>
                <div className="f1-channel-sub">
                  O₂ vs CO₂ and He mole percentage across runs · Click any point to inspect
                </div>
              </div>
              <div style={{ width: '100%', height: '235px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={runSeries}
                    syncId="f1-run-sync"
                    margin={{ top: 10, right: 18, bottom: 4, left: 0 }}
                    onClick={(state) => {
                      const idx = state?.activeTooltipIndex;
                      if (idx != null && runSeries[idx] && onSelectRun) {
                        onSelectRun(runSeries[idx]);
                      }
                    }}
                  >
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={theme.channels.o2} stopOpacity={0.34} />
                        <stop offset="100%" stopColor={theme.channels.o2} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#182238" vertical={false} />
                    <XAxis
                      dataKey="runId"
                      stroke="#64748b"
                      fontSize={10}
                      fontFamily="var(--font-mono)"
                      minTickGap={24}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={10.5}
                      fontFamily="var(--font-mono)"
                      domain={[0, 'auto']}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      content={
                        <F1Tooltip
                          theme={theme}
                          suffixMap={{ o2Pct: '%', co2Pct: '%', hePct: '%' }}
                        />
                      }
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        paddingTop: '4px',
                      }}
                    />
                    {baselineOverlay && (
                      <ReferenceLine
                        y={EARTH_BASELINE.o2Pct}
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        label={{
                          value: '21% O₂ (1g)',
                          position: 'insideTopRight',
                          fill: '#94a3b8',
                          fontSize: 9.5,
                        }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="o2Pct"
                      name="O₂ Concentration"
                      stroke={theme.channels.o2}
                      strokeWidth={2.2}
                      fill={`url(#${gradId})`}
                      dot={false}
                      activeDot={{ r: 4.5, stroke: '#fff', strokeWidth: 1.5 }}
                      animationDuration={320}
                      animationEasing="ease-out"
                    />
                    {channels.diluent && (
                      <Line
                        type="stepAfter"
                        dataKey="co2Pct"
                        name="CO₂ Diluent"
                        stroke="#34d399"
                        strokeWidth={1.6}
                        dot={false}
                        animationDuration={320}
                        animationEasing="ease-out"
                      />
                    )}
                    {channels.diluent && (
                      <Line
                        type="stepAfter"
                        dataKey="hePct"
                        name="He Diluent"
                        stroke="#a78bfa"
                        strokeWidth={1.6}
                        dot={false}
                        animationDuration={320}
                        animationEasing="ease-out"
                      />
                    )}
                    {activeRun && (
                      <ReferenceDot
                        x={activeRun.runId}
                        y={activeRun.o2Pct}
                        r={5}
                        fill={theme.primary}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {(channels.pressure || channels.secondary) && (
            <section className="f1-channel-card" aria-label="Chamber Pressure and Droplet Size">
              <div className="f1-channel-head">
                <div className="f1-channel-title">
                  <span className="f1-channel-bar" style={{ background: theme.channels.pressure }} />
                  Chamber Pressure &amp; Droplet Size ({runSeries.length} runs)
                </div>
                <div className="f1-channel-sub">
                  Pressure in psi (left axis) vs droplet diameter in mm (right axis)
                  {activeRun ? ` · Selected: ${activeRun.runId}` : ''}
                </div>
              </div>
              <div style={{ width: '100%', height: '215px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={runSeries}
                    syncId="f1-run-sync"
                    margin={{ top: 10, right: 18, bottom: 4, left: 0 }}
                    onClick={(state) => {
                      const idx = state?.activeTooltipIndex;
                      if (idx != null && runSeries[idx] && onSelectRun) {
                        onSelectRun(runSeries[idx]);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="2 4" stroke="#182238" vertical={false} />
                    <XAxis
                      dataKey="runId"
                      stroke="#64748b"
                      fontSize={10}
                      fontFamily="var(--font-mono)"
                      minTickGap={24}
                    />
                    {channels.pressure && (
                      <YAxis
                        yAxisId="p"
                        stroke={theme.channels.pressure}
                        fontSize={10.5}
                        fontFamily="var(--font-mono)"
                        tickFormatter={(v) => `${v} psi`}
                      />
                    )}
                    {channels.secondary && (
                      <YAxis
                        yAxisId="d"
                        orientation="right"
                        stroke={theme.channels.flow}
                        fontSize={10.5}
                        fontFamily="var(--font-mono)"
                        domain={[0, 5.5]}
                        tickFormatter={(v) => `${v} mm`}
                      />
                    )}
                    <Tooltip
                      content={
                        <F1Tooltip
                          theme={theme}
                          suffixMap={{ pressurePsi: ' psi', diameterMm: ' mm' }}
                        />
                      }
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        paddingTop: '4px',
                      }}
                    />
                    {baselineOverlay && channels.pressure && (
                      <ReferenceLine
                        yAxisId="p"
                        y={EARTH_BASELINE.pressurePsi}
                        stroke="#64748b"
                        strokeDasharray="4 4"
                      />
                    )}
                    {channels.pressure && (
                      <Line
                        yAxisId="p"
                        type="stepAfter"
                        dataKey="pressurePsi"
                        name="Chamber Pressure"
                        stroke={theme.channels.pressure}
                        strokeWidth={2}
                        dot={false}
                        animationDuration={320}
                        animationEasing="ease-out"
                      />
                    )}
                    {channels.secondary && (
                      <Line
                        yAxisId="d"
                        type="monotone"
                        dataKey="diameterMm"
                        name="Droplet Diameter"
                        stroke={theme.channels.flow}
                        strokeWidth={1.6}
                        dot={false}
                        animationDuration={320}
                        animationEasing="ease-out"
                      />
                    )}
                    {activeRun && channels.pressure && activeRun.pressurePsi != null && (
                      <ReferenceDot
                        yAxisId="p"
                        x={activeRun.runId}
                        y={activeRun.pressurePsi}
                        r={5}
                        fill={theme.secondary}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </>
      ) : null}

      {/* CHANNEL 3: Cross-Study PSI Envelope Comparison (always real verified PSI data) */}
      <section className="f1-channel-card" aria-label="Cross-Study PSI Envelope Comparison">
        <div className="f1-channel-head">
          <div className="f1-channel-title">
            <span className="f1-channel-bar" />
            Peak O₂ Tested by PSI Study ({envelopeSeries.length} studies)
          </div>
          <div className="f1-channel-sub">
            {envelopeSeries.length > 0
              ? `Highest O₂ concentration tested per study · Hover for min O₂ & pressure · Active: ${study?.acronym}`
              : '0 studies match current filters'}
          </div>
        </div>
        {envelopeSeries.length === 0 ? (
          <div className="f1-no-data" role="status">
            <span className="f1-no-data__badge">NO DATA</span>
            <div className="f1-no-data__title">No PSI studies match the active filters</div>
            <p className="f1-no-data__desc">
              No investigations in the verified NASA PSI archive satisfy this combination of pillar, fuel, hardware, and oxygen regime.
            </p>
            {onResetFilters && (
              <button type="button" className="f1-btn f1-btn--primary" onClick={onResetFilters}>
                Show All Studies
              </button>
            )}
          </div>
        ) : (
        <div style={{ width: '100%', height: '225px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={envelopeSeries}
              margin={{ top: 14, right: 16, bottom: 8, left: 0 }}
              onClick={(state) => {
                const idx = state?.activeTooltipIndex;
                if (idx != null && envelopeSeries[idx] && onSelectStudy) {
                  onSelectStudy(envelopeSeries[idx].id);
                }
              }}
            >
              <CartesianGrid strokeDasharray="2 4" stroke="#182238" vertical={false} />
              <XAxis
                dataKey="acronym"
                stroke="#64748b"
                fontSize={10}
                fontFamily="var(--font-mono)"
                interval={0}
                angle={envelopeSeries.length > 8 ? -28 : 0}
                textAnchor={envelopeSeries.length > 8 ? 'end' : 'middle'}
                height={envelopeSeries.length > 8 ? 52 : 28}
              />
              <YAxis
                yAxisId="o2"
                stroke="#94a3b8"
                fontSize={10.5}
                fontFamily="var(--font-mono)"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={
                  <F1Tooltip
                    theme={theme}
                    suffixMap={{ o2Max: '% O₂' }}
                    extraFields={[
                      { key: 'o2Min', label: 'Lower O₂ Bound', suffix: '% O₂' },
                      { key: 'pressurePsi', label: 'Chamber Pressure', suffix: ' psi' },
                    ]}
                  />
                }
              />
              {baselineOverlay && (
                <ReferenceLine
                  yAxisId="o2"
                  y={EARTH_BASELINE.o2Pct}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{
                    value: '21% O₂ (Earth)',
                    position: 'insideTopRight',
                    fill: '#cbd5e1',
                    fontSize: 10,
                  }}
                />
              )}
              <Bar
                yAxisId="o2"
                dataKey="o2Max"
                name="Peak O₂ Tested"
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
                animationDuration={320}
                animationEasing="ease-out"
              >
                {envelopeSeries.map((entry) => (
                  <Cell
                    key={entry.id}
                    fill={entry.isActive ? theme.primary : '#1e2c48'}
                    stroke={entry.isActive ? '#f8fafc' : theme.border}
                    strokeWidth={entry.isActive ? 1.4 : 0.6}
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        )}
      </section>

      {/* CHANNEL 4: Measured Time-Series OR Honest No-Data Placeholder */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: '14px',
        }}
      >
        <section className="f1-channel-card" aria-label="Time Series Profile">
          <div className="f1-channel-head">
            <div className="f1-channel-title">
              <span className="f1-channel-bar" style={{ background: theme.channels.thermal }} />
              {empiricalSeries
                ? `Burn Duration vs Droplet Size (${empiricalSeries.totalPoints} recorded trials)`
                : measuredTimeSeries
                  ? `Measured Time-Series (${measuredTimeSeries.source.toUpperCase()})`
                  : 'Time-Series Profile'}
            </div>
            <div className="f1-channel-sub">
              {empiricalSeries
                ? `X: ${empiricalSeries.xLabel} · Y: ${empiricalSeries.yLabel} (${empiricalSeries.yUnit})${empiricalSeries.seriesSource ? ` · ${empiricalSeries.seriesSource}` : ''}`
                : measuredTimeSeries
                  ? `Recorded channels: ${study?.variables?.join(', ') || 'TC / Flux'}`
                  : showSchematicFallback
                    ? 'Illustrative schematic reference (not measured)'
                    : 'No raw time-series samples in PSI summary'}
            </div>
          </div>
          {empiricalSeries ? (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                <button
                  type="button"
                  className="f1-pill"
                  aria-pressed={activeEmpiricalName === 'all'}
                  onClick={() => setActiveEmpiricalName('all')}
                >
                  All ({empiricalSeries.totalPoints})
                </button>
                {empiricalSeries.seriesList.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    className="f1-pill"
                    aria-pressed={activeEmpiricalName === s.name}
                    onClick={() => setActiveEmpiricalName(s.name)}
                    style={{ borderColor: activeEmpiricalName === s.name ? s.color : undefined }}
                  >
                    <span style={{ color: s.color, marginRight: '5px' }}>●</span>
                    {s.label} ({s.points.length})
                  </button>
                ))}
              </div>
              <div style={{ width: '100%', height: 255 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 16, bottom: 10, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#182238" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name={empiricalSeries.xLabel}
                      stroke="#64748b"
                      tick={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}
                      unit={empiricalSeries.xUnit}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name={empiricalSeries.yLabel}
                      stroke="#64748b"
                      tick={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}
                      unit={` ${empiricalSeries.yUnit}`}
                    />
                    <ZAxis range={[38, 38]} />
                    <Legend
                      wrapperStyle={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        paddingTop: '4px',
                      }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3', stroke: theme.primary }}
                      contentStyle={{
                        background: 'rgba(6, 10, 20, 0.96)',
                        border: `1px solid ${theme.border}`,
                        borderRadius: '8px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10.5px',
                        color: '#f8fafc',
                      }}
                      formatter={(val, name) =>
                        name === empiricalSeries.yLabel
                          ? [`${val} ${empiricalSeries.yUnit}`, empiricalSeries.yLabel]
                          : [`${val}${empiricalSeries.xUnit}`, empiricalSeries.xLabel]
                      }
                    />
                    {empiricalSeries.seriesList
                      .filter((s) => activeEmpiricalName === 'all' || activeEmpiricalName === s.name)
                      .map((s) => (
                        <Scatter
                          key={s.name}
                          name={s.label}
                          data={s.points}
                          fill={s.color}
                          fillOpacity={0.85}
                        />
                      ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              {empiricalSeries.sourceUrl && (
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                  Source:{' '}
                  <a href={empiricalSeries.sourceUrl} target="_blank" rel="noreferrer" style={{ color: theme.primary }}>
                    {empiricalSeries.sourceUrl}
                  </a>
                </div>
              )}

              {/* Explainable Python Trend/Peak Detection (scipy.signal.find_peaks) */}
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'rgba(8, 13, 26, 0.85)',
                  border: '1px solid #182238',
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  color: '#cbd5e1',
                }}
              >
                <div style={{ color: theme.primary, fontWeight: 700, marginBottom: '4px' }}>
                  PYTHON ANALYTICS // TREND &amp; PEAK DETECTION
                </div>
                {trendState.status === 'loading' ? (
                  <span style={{ color: '#64748b' }}>Running scipy.signal.find_peaks over recorded series…</span>
                ) : trendState.status === 'unavailable' ? (
                  <span style={{ color: '#64748b' }}>
                    Analytics service (:8000) offline — no synthetic peak/trend events shown.
                  </span>
                ) : trendState.events.length === 0 ? (
                  <span style={{ color: '#94a3b8' }}>
                    0 anomalous peaks, drops, or shifts above 2.0σ rolling threshold across {empiricalSeries.seriesList.length} series.
                  </span>
                ) : (
                  <ul style={{ margin: '4px 0 0', paddingLeft: '16px', display: 'grid', gap: '3px' }}>
                    {trendState.events.slice(0, 6).map((ev, idx) => (
                      <li key={`${ev.seriesName}-${ev.kind}-${ev.t}-${idx}`}>
                        <strong style={{ color: '#f8fafc' }}>
                          {ev.seriesName} [{ev.kind.toUpperCase()} @ x={ev.t}, y={ev.value}]
                        </strong>
                        : {ev.detail}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : measuredTimeSeries ? (
            <TimeSeriesChart data={measuredTimeSeries} />
          ) : showSchematicFallback ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <TimeSeriesChart />
              <button
                type="button"
                className="f1-btn"
                style={{ alignSelf: 'flex-end', fontSize: '10px', padding: '4px 9px' }}
                onClick={() => setShowSchematicFallback(false)}
              >
                Hide Schematic Reference
              </button>
            </div>
          ) : (
            <div className="f1-no-data" role="status">
              <span className="f1-no-data__badge">NO DATA</span>
              <div className="f1-no-data__title">
                No time-series waveform recorded for {study?.acronym ?? 'this study'}
              </div>
              <p className="f1-no-data__desc">
                The verified PSI archive stores experimental bounds and sensor metadata without raw thermocouple/flux samples here.
              </p>
              <button
                type="button"
                className="f1-btn"
                style={{ fontSize: '10px', padding: '5px 10px' }}
                onClick={() => setShowSchematicFallback(true)}
              >
                Preview Schematic Reference
              </button>
            </div>
          )}
        </section>

        <section className="f1-channel-card" aria-label="PSI Operating Regime Coverage">
          <div className="f1-channel-head">
            <div className="f1-channel-title">
              <span className="f1-channel-bar" style={{ background: theme.secondary }} />
              PSI OPERATING REGIME COVERAGE (O₂ VS FLOW)
            </div>
            <div className="f1-channel-sub">
              Delaunay convex hull over tested PSI (O₂, flow) coordinates · Null outside coverage
            </div>
          </div>
          <FlammabilityChart />
        </section>
      </div>
    </div>
  );
}
