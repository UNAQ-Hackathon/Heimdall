import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
  Area,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
} from 'recharts';
import { api } from '../../services/api.js';
import { processedInvestigations } from '../../services/ranking.js';
import {
  MOON_BASE_TARGET,
  buildConvexHullQueryPoints,
  extractPsiRegimeCoords,
} from '../../services/regime-coverage.js';

function RegimeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload;
  const seriesName = payload[0]?.name;
  if (!pt) return null;

  return (
    <div
      style={{
        backgroundColor: '#0d1321',
        border: '1px solid #1c2640',
        borderRadius: '6px',
        padding: '8px 10px',
        fontSize: '10.5px',
        fontFamily: 'var(--font-mono)',
        color: '#f8fafc',
      }}
    >
      {pt.acronym ? (
        <>
          <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '3px' }}>
            {pt.acronym}
          </div>
          <div style={{ color: '#cbd5e1' }}>
            Pillar: <span style={{ textTransform: 'capitalize' }}>{pt.category}</span>
          </div>
          <div style={{ color: '#cbd5e1' }}>
            O₂:{' '}
            {pt.o2Min != null && pt.o2Max != null && pt.o2Min !== pt.o2Max
              ? `${pt.o2Min}–${pt.o2Max}% (nominal ${pt.y}%)`
              : `${pt.y}%`}
          </div>
          <div style={{ color: '#cbd5e1' }}>Forced Flow: {pt.x} m/s</div>
          {pt.hardware && (
            <div style={{ color: '#64748b', marginTop: '2px', maxWidth: '220px' }}>
              {pt.hardware}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontWeight: 700, color: seriesName?.includes('Inside') ? '#38bdf8' : '#94a3b8' }}>
            {seriesName}
          </div>
          <div style={{ color: '#cbd5e1' }}>O₂: {pt.y}% · Flow: {pt.x} m/s</div>
          <div style={{ color: '#64748b', marginTop: '2px' }}>
            {seriesName?.includes('Inside')
              ? 'Covered inside tested PSI (O2, flow) convex hull'
              : 'Outside tested PSI bounds (null — never extrapolated)'}
          </div>
        </>
      )}
    </div>
  );
}

export default function FlammabilityChart() {
  const [mode, setMode] = useState('hull');
  const [hullState, setHullState] = useState({ status: 'idle', inHull: [], outHull: [], note: null });

  const studyCoords = useMemo(
    () => extractPsiRegimeCoords(processedInvestigations),
    []
  );
  const hullQueryPoints = useMemo(
    () => buildConvexHullQueryPoints(processedInvestigations),
    []
  );

  const preventionPts = useMemo(
    () => studyCoords.filter((p) => p.category === 'prevention'),
    [studyCoords]
  );
  const detectionPts = useMemo(
    () => studyCoords.filter((p) => p.category === 'detection'),
    [studyCoords]
  );
  const suppressionPts = useMemo(
    () => studyCoords.filter((p) => p.category === 'suppression'),
    [studyCoords]
  );

  useEffect(() => {
    if (mode !== 'hull' || hullState.status === 'ready') return;
    let cancelled = false;
    setHullState((prev) => ({ ...prev, status: 'loading' }));

    api
      .flammabilityMap(hullQueryPoints, {
        o2_min: 12,
        o2_max: 52,
        vel_min: 0,
        vel_max: 0.28,
        resolution: 18,
      })
      .then((res) => {
        if (cancelled) return;
        const cells = Array.isArray(res?.cells) ? res.cells : [];
        const inHull = cells
          .filter((c) => c.probability != null)
          .map((c) => ({ x: Number(c.flow_velocity.toFixed(3)), y: Number(c.oxygen_pct.toFixed(1)) }));
        const outHull = cells
          .filter((c) => c.probability == null)
          .map((c) => ({ x: Number(c.flow_velocity.toFixed(3)), y: Number(c.oxygen_pct.toFixed(1)) }));
        setHullState({ status: 'ready', inHull, outHull, note: res?.note ?? null });
      })
      .catch(() => {
        if (!cancelled) setHullState({ status: 'unavailable', inHull: [], outHull: [], note: null });
      });

    return () => {
      cancelled = true;
    };
  }, [mode, hullState.status, hullQueryPoints]);

  // Conceptual 0g vs 1g teaching reference curve (strictly illustrative, not raw ignition data)
  const curveData = [
    { flow: 0.0,  conceptual0g: 31.5, conceptualExt: 20.0 },
    { flow: 0.05, conceptual0g: 29.8, conceptualExt: 19.5 },
    { flow: 0.10, conceptual0g: 28.2, conceptualExt: 19.0 },
    { flow: 0.15, conceptual0g: 26.5, conceptualExt: 18.2 },
    { flow: 0.20, conceptual0g: 25.0, conceptualExt: 17.5 },
    { flow: 0.25, conceptual0g: 23.8, conceptualExt: 16.8 },
    { flow: 0.30, conceptual0g: 22.5, conceptualExt: 16.0 },
    { flow: 0.35, conceptual0g: 21.6, conceptualExt: 15.3 },
    { flow: 0.40, conceptual0g: 20.8, conceptualExt: 14.5 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="f1-pill"
            aria-pressed={mode === 'hull'}
            onClick={() => setMode('hull')}
          >
            PSI Regime Coverage ({studyCoords.length} studies · {hullQueryPoints.length} bounds)
          </button>
          <button
            type="button"
            className="f1-pill"
            aria-pressed={mode === 'schematic'}
            onClick={() => setMode('schematic')}
          >
            Conceptual 0g Reference
          </button>
        </div>
        {mode === 'hull' && hullState.status === 'ready' && (
          <span style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#34d399' }}>
            IN-HULL: {hullState.inHull.length} · NULL OUTSIDE: {hullState.outHull.length}
          </span>
        )}
      </div>

      {mode === 'hull' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {hullState.status === 'unavailable' && (
            <div
              role="status"
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#fbbf24',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '6px',
                padding: '6px 9px',
              }}
            >
              Python Delaunay hull overlay (:8000) offline — plotting verified PSI study coordinates without extrapolating untested cells.
            </div>
          )}
          <div style={{ width: '100%', height: '245px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, bottom: 20, left: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2640" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[0, 0.28]}
                  stroke="#64748b"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  unit=" m/s"
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[12, 52]}
                  stroke="#64748b"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  unit="%"
                />
                <ZAxis range={[48, 48]} />
                <Tooltip content={<RegimeTooltip />} />
                <Legend
                  wrapperStyle={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    paddingTop: '2px',
                  }}
                />
                {hullState.status === 'ready' && (
                  <>
                    <Scatter name="Outside Hull (null)" data={hullState.outHull} fill="#1e293b" fillOpacity={0.45} />
                    <Scatter name="Inside Tested PSI Hull" data={hullState.inHull} fill="#38bdf8" fillOpacity={0.42} />
                  </>
                )}
                <Scatter name="Prevention Studies" data={preventionPts} fill="#34d399" />
                <Scatter name="Suppression Studies" data={suppressionPts} fill="#f59e0b" />
                <Scatter name="Detection Studies" data={detectionPts} fill="#a78bfa" />
                <Scatter name="Moon Base Target" data={[MOON_BASE_TARGET]} fill="#fb7185" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          {hullState.status === 'ready' && hullState.note && (
            <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
              {hullState.note}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
            Illustrative conceptual curve showing how low-speed airflow lowers O₂ thresholds in 0g (not measured ignition data).
          </div>
          <div style={{ width: '100%', height: '235px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={curveData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2640" vertical={false} />
                <XAxis
                  dataKey="flow"
                  stroke="#64748b"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  tickFormatter={(v) => `${v.toFixed(2)}`}
                  label={{
                    value: 'FORCED FLOW VELOCITY (m/s) · CONCEPTUAL AXIS',
                    position: 'insideBottom',
                    offset: -12,
                    fill: '#64748b',
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                <YAxis
                  domain={[12, 38]}
                  stroke="#64748b"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  tickFormatter={(v) => `${v}%`}
                  label={{
                    value: 'AMBIENT O₂ (%)',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#64748b',
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0d1321',
                    borderColor: '#1c2640',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                  }}
                  formatter={(value, name) => [`${value}% O₂`, name]}
                />
                <Area
                  type="monotone"
                  dataKey="conceptual0g"
                  stroke="none"
                  fill="rgba(56, 189, 248, 0.08)"
                  name="Conceptual 0g Band"
                  animationDuration={320}
                  animationEasing="ease-out"
                />
                <Line
                  type="monotone"
                  dataKey="conceptual0g"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                  name="Conceptual 0g Trend"
                  animationDuration={320}
                  animationEasing="ease-out"
                />
                <Line
                  type="monotone"
                  dataKey="conceptualExt"
                  stroke="#fb7185"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Conceptual Quenching Trend"
                  animationDuration={320}
                  animationEasing="ease-out"
                />
                <ReferenceDot
                  x={0.10}
                  y={28.2}
                  r={5}
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
