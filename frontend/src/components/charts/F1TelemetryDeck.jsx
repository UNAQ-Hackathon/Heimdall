import { useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import FlammabilityChart from './FlammabilityChart.jsx';
import TimeSeriesChart from './TimeSeriesChart.jsx';
import { EARTH_BASELINE } from '../../services/telemetry-f1.js';

function F1Tooltip({ active, payload, label, theme, suffixMap = {} }) {
  if (!active || !payload?.length) return null;
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
  const measuredTimeSeries = getStudyMeasuredSeries(study, measurements);
  const hasRuns = showRunTelemetry && runSeries.length > 0;
  const gradId = `f1-o2-grad-${theme.id}`;

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
                  CH-01 // OXIDIZER &amp; INERT DILUENT TRACE ({runSeries.length} RUNS)
                </div>
                <div className="f1-channel-sub">
                  Click any point to lock pit-wall cursor · Real PSI FLEX coordinates
                </div>
              </div>
              <div style={{ width: '100%', height: '215px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={runSeries}
                    syncId="f1-run-sync"
                    margin={{ top: 10, right: 18, bottom: 8, left: 0 }}
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
                      fontSize={9.5}
                      fontFamily="var(--font-mono)"
                      minTickGap={22}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={10}
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
            <section className="f1-channel-card" aria-label="Channel 2 Chamber Pressure and Droplet Scale">
              <div className="f1-channel-head">
                <div className="f1-channel-title">
                  <span className="f1-channel-bar" style={{ background: theme.channels.pressure }} />
                  CH-02 // CHAMBER PRESSURE (PSI) &amp; DROPLET DIAMETER (MM)
                </div>
                <div className="f1-channel-sub">
                  Synchronized pit-wall channel · {activeRun ? `Locked: ${activeRun.runId}` : 'Hover or click trace'}
                </div>
              </div>
              <div style={{ width: '100%', height: '195px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={runSeries}
                    syncId="f1-run-sync"
                    margin={{ top: 10, right: 18, bottom: 8, left: 0 }}
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
                      fontSize={9.5}
                      fontFamily="var(--font-mono)"
                      minTickGap={22}
                    />
                    {channels.pressure && (
                      <YAxis
                        yAxisId="p"
                        stroke={theme.channels.pressure}
                        fontSize={10}
                        fontFamily="var(--font-mono)"
                        tickFormatter={(v) => `${v} psi`}
                      />
                    )}
                    {channels.secondary && (
                      <YAxis
                        yAxisId="d"
                        orientation="right"
                        stroke={theme.channels.flow}
                        fontSize={10}
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
            {hasRuns ? 'CH-03' : 'CH-01'} // VERIFIED PSI ENVELOPE TELEMETRY ({envelopeSeries.length} STUDIES)
          </div>
          <div className="f1-channel-sub">
            {envelopeSeries.length > 0
              ? `Click any bar/point to switch active study · Highlighted: ${study?.acronym}`
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
        <div style={{ width: '100%', height: '215px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={envelopeSeries}
              margin={{ top: 10, right: 18, bottom: 8, left: 0 }}
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
                fontSize={9.5}
                fontFamily="var(--font-mono)"
                interval={0}
                angle={envelopeSeries.length > 8 ? -28 : 0}
                textAnchor={envelopeSeries.length > 8 ? 'end' : 'middle'}
                height={envelopeSeries.length > 8 ? 48 : 26}
              />
              <YAxis
                yAxisId="o2"
                stroke={theme.primary}
                fontSize={10}
                fontFamily="var(--font-mono)"
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                yAxisId="p"
                orientation="right"
                stroke="#64748b"
                fontSize={10}
                fontFamily="var(--font-mono)"
                tickFormatter={(v) => `${v} psi`}
              />
              <Tooltip
                content={
                  <F1Tooltip
                    theme={theme}
                    suffixMap={{ o2Max: '% O₂', o2Min: '% O₂', pressurePsi: ' psi' }}
                  />
                }
              />
              {baselineOverlay && (
                <ReferenceLine
                  yAxisId="o2"
                  y={EARTH_BASELINE.o2Pct}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                />
              )}
              <Bar
                yAxisId="o2"
                dataKey="o2Max"
                name="Peak O₂ Envelope"
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
              <Line
                yAxisId="o2"
                type="monotone"
                dataKey="o2Min"
                name="Lower O₂ Bound"
                stroke={theme.accent}
                strokeWidth={1.8}
                dot={{ r: 2.5 }}
                animationDuration={320}
                animationEasing="ease-out"
              />
              <Line
                yAxisId="p"
                type="monotone"
                dataKey="pressurePsi"
                name="Chamber Pressure"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
                animationDuration={320}
                animationEasing="ease-out"
              />
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
              {measuredTimeSeries
                ? `MEASURED TIME-SERIES (${measuredTimeSeries.source.toUpperCase()})`
                : 'TIME-SERIES WAVEFORM'}
            </div>
            <div className="f1-channel-sub">
              {measuredTimeSeries
                ? `Recorded channels: ${study?.variables?.join(', ') || 'TC / Flux'}`
                : showSchematicFallback
                  ? 'Illustrative schematic reference (not measured)'
                  : 'No raw time-series samples in PSI summary'}
            </div>
          </div>
          {measuredTimeSeries ? (
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

        <section className="f1-channel-card" aria-label="Flammability Envelope">
          <div className="f1-channel-head">
            <div className="f1-channel-title">
              <span className="f1-channel-bar" style={{ background: theme.secondary }} />
              ILLUSTRATIVE FLAMMABILITY ENVELOPE (O₂ VS FLOW)
            </div>
            <div className="f1-channel-sub">
              Schematic 0g vs 1g boundary · Not study-specific measurements
            </div>
          </div>
          <FlammabilityChart />
        </section>
      </div>
    </div>
  );
}
