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
} from 'recharts';
import { api } from '../../services/api.js';
import { processedInvestigations } from '../../services/ranking.js';

export default function FlammabilityChart() {
  const [mode, setMode] = useState('schematic');
  const [hullState, setHullState] = useState({ status: 'idle', inHull: [], outHull: [], note: null });

  const psiPoints = useMemo(
    () =>
      processedInvestigations
        .filter(
          (inv) =>
            inv.dataAvailable !== false &&
            inv.conditions?.oxygenPct != null &&
            inv.conditions?.flowVelocity != null
        )
        .map((inv) => ({
          acronym: inv.acronym,
          oxygen_pct: inv.conditions.oxygenPct,
          flow_velocity: inv.conditions.flowVelocity,
          flammable: inv.category !== 'suppression',
          weight: 1,
        })),
    []
  );

  useEffect(() => {
    if (mode !== 'hull' || hullState.status === 'ready') return;
    let cancelled = false;
    setHullState((prev) => ({ ...prev, status: 'loading' }));

    api
      .flammabilityMap(psiPoints, {
        o2_min: 15,
        o2_max: 40,
        vel_min: 0,
        vel_max: 0.55,
        resolution: 18,
      })
      .then((res) => {
        if (cancelled) return;
        const cells = Array.isArray(res?.cells) ? res.cells : [];
        const inHull = cells
          .filter((c) => c.probability != null)
          .map((c) => ({ x: Number(c.flow_velocity.toFixed(3)), y: Number(c.oxygen_pct.toFixed(1)), p: c.probability }));
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
  }, [mode, hullState.status, psiPoints]);

  // Generate schematic reference curves
  const curveData = [
    { flow: 0.0,  saffire0g: 31.5, extinction: 20.0, terrestrial1g: 22.0 },
    { flow: 0.05, saffire0g: 29.8, extinction: 19.5, terrestrial1g: 21.2 },
    { flow: 0.10, saffire0g: 28.2, extinction: 19.0, terrestrial1g: 20.5 },
    { flow: 0.15, saffire0g: 26.5, extinction: 18.2, terrestrial1g: 19.8 },
    { flow: 0.20, saffire0g: 25.0, extinction: 17.5, terrestrial1g: 19.2 },
    { flow: 0.25, saffire0g: 23.8, extinction: 16.8, terrestrial1g: 18.7 },
    { flow: 0.30, saffire0g: 22.5, extinction: 16.0, terrestrial1g: 18.1 },
    { flow: 0.35, saffire0g: 21.6, extinction: 15.3, terrestrial1g: 17.6 },
    { flow: 0.40, saffire0g: 20.8, extinction: 14.5, terrestrial1g: 17.0 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="f1-pill"
            aria-pressed={mode === 'schematic'}
            onClick={() => setMode('schematic')}
          >
            Schematic Envelope
          </button>
          <button
            type="button"
            className="f1-pill"
            aria-pressed={mode === 'hull'}
            onClick={() => setMode('hull')}
          >
            Python Convex Hull ({psiPoints.length} PSI coords)
          </button>
        </div>
        {mode === 'hull' && hullState.status === 'ready' && (
          <span style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#34d399' }}>
            IN-HULL: {hullState.inHull.length} · NULL OUTSIDE: {hullState.outHull.length}
          </span>
        )}
      </div>

      {mode === 'hull' ? (
        hullState.status === 'loading' ? (
          <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
            Computing Delaunay convex hull via :8000/api/analytics/flammability-map…
          </div>
        ) : hullState.status === 'unavailable' ? (
          <div className="f1-no-data" role="status" style={{ minHeight: '220px' }}>
            <span className="f1-no-data__badge">ANALYTICS OFFLINE</span>
            <div className="f1-no-data__title">Python flammability-map (:8000) unavailable</div>
            <p className="f1-no-data__desc">
              Start FastAPI analytics (`uvicorn app.main:app`) to compute the Delaunay convex hull over {psiPoints.length} PSI `(O₂ %, Flow m/s)` coordinates without fabricating outside-hull cells.
            </p>
          </div>
        ) : (
          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, bottom: 20, left: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2640" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[0, 0.55]}
                  stroke="#64748b"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  unit=" m/s"
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[14, 40]}
                  stroke="#64748b"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  unit="%"
                />
                <ZAxis range={[45, 45]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0d1321',
                    borderColor: '#1c2640',
                    borderRadius: '6px',
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                <Scatter name="Outside Hull (null)" data={hullState.outHull} fill="#1e293b" fillOpacity={0.55} />
                <Scatter name="Inside PSI Convex Hull" data={hullState.inHull} fill="#38bdf8" fillOpacity={0.65} />
                <Scatter
                  name="Verified PSI Study Coords"
                  data={psiPoints.map((p) => ({ x: p.flow_velocity, y: p.oxygen_pct, acronym: p.acronym }))}
                  fill="#f59e0b"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )
      ) : (
        <div style={{ width: '100%', height: '240px' }}>
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
              value: 'FORCED FLOW VELOCITY U_INF (m/s) · AXIAL VENTILATION',
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
              value: 'AMBIENT O₂ CONC (%)',
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

          {/* Shaded flammable zone */}
          <Area
            type="monotone"
            dataKey="saffire0g"
            stroke="none"
            fill="rgba(56, 189, 248, 0.08)"
            name="Flammable Envelope"
            animationDuration={320}
            animationEasing="ease-out"
          />

          {/* Saffire-III 0g Boundary line */}
          <Line
            type="monotone"
            dataKey="saffire0g"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            name="Saffire-III 0g Boundary"
            animationDuration={320}
            animationEasing="ease-out"
          />

          {/* Extinction / Quenching Zone boundary */}
          <Line
            type="monotone"
            dataKey="extinction"
            stroke="#fb7185"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            name="Extinction Boundary"
            animationDuration={320}
            animationEasing="ease-out"
          />

          {/* Lunar Base Habitat Spec Callout Point */}
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
      )}
    </div>
  );
}
