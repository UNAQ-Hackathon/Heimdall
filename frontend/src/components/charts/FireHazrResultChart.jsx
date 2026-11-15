import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function NeighborTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div
      style={{
        background: 'rgba(8, 13, 26, 0.96)',
        border: '1px solid #263449',
        borderRadius: '8px',
        padding: '8px 11px',
        fontFamily: 'var(--font-mono)',
        fontSize: '10.5px',
        color: '#f8fafc',
        boxShadow: '0 8px 20px rgba(0,0,0,0.55)',
      }}
    >
      <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: '4px' }}>
        Trial #{item.prueba}
        {item.fuel ? ` · ${item.fuel}` : ''}
      </div>
      <div>Observed duration: <strong>{item.observado_s} s</strong></div>
      <div>KNN weight: <strong>{item.weightPct}%</strong></div>
      {item.distancia != null && <div>Support distance: <strong>{item.distancia.toFixed(3)}</strong></div>}
      {item.fin_ensayo && <div>End state: <strong>{item.fin_ensayo}</strong></div>}
    </div>
  );
}

/**
 * Visualizes FireHazR KNN prediction results: submitted gas mix,
 * support-envelope distance vs learned threshold, and nearest-neighbor trials.
 */
export default function FireHazrResultChart({ result, conditions }) {
  if (!result) return null;

  const o2 = Number(conditions?.o2_fraction ?? 0);
  const n2 = Number(conditions?.n2_fraction ?? 0);
  const co2 = Number(conditions?.co2_fraction ?? 0);
  const he = Number(conditions?.he_fraction ?? 0);
  const gasSum = o2 + n2 + co2 + he;

  const neighbors = Array.isArray(result.vecinos)
    ? result.vecinos.map((trial, idx) => ({
        label: `#${trial.prueba}`,
        prueba: trial.prueba,
        observado_s: Number(trial.observado_s),
        weightPct: Number(((trial.peso ?? 0) * 100).toFixed(1)),
        distancia: trial.distancia ?? null,
        fuel: trial.fuel ?? null,
        fin_ensayo: trial.fin_ensayo ?? null,
        rank: idx,
      }))
    : [];

  const dist = result.distancia_soporte;
  const limit = result.limite_soporte;
  const hasDistance = Number.isFinite(dist) && Number.isFinite(limit) && limit > 0;
  const distRatio = hasDistance ? Math.min(1, dist / (limit * 1.5)) : 0;
  const limitRatio = hasDistance ? Math.min(1, 1 / 1.5) : 0.67;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: '10px',
        background: 'linear-gradient(180deg, rgba(11, 19, 34, 0.9), rgba(8, 13, 26, 0.95))',
        border: '1px solid #1e293b',
      }}
    >
      {/* Gas Composition Bar */}
      {gasSum > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#94a3b8',
              flexWrap: 'wrap',
              gap: '6px',
            }}
          >
            <span>CHAMBER ATMOSPHERE MIX</span>
            <span style={{ color: '#e2e8f0' }}>
              O₂ {(o2 * 100).toFixed(0)}% · N₂ {(n2 * 100).toFixed(0)}%
              {co2 > 0 ? ` · CO₂ ${(co2 * 100).toFixed(0)}%` : ''}
              {he > 0 ? ` · He ${(he * 100).toFixed(0)}%` : ''}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              height: '7px',
              borderRadius: '999px',
              overflow: 'hidden',
              background: '#0f172a',
            }}
          >
            {o2 > 0 && <div style={{ width: `${(o2 / gasSum) * 100}%`, background: '#38bdf8' }} title={`O₂ ${(o2 * 100).toFixed(1)}%`} />}
            {n2 > 0 && <div style={{ width: `${(n2 / gasSum) * 100}%`, background: '#475569' }} title={`N₂ ${(n2 * 100).toFixed(1)}%`} />}
            {co2 > 0 && <div style={{ width: `${(co2 / gasSum) * 100}%`, background: '#34d399' }} title={`CO₂ ${(co2 * 100).toFixed(1)}%`} />}
            {he > 0 && <div style={{ width: `${(he / gasSum) * 100}%`, background: '#a78bfa' }} title={`He ${(he * 100).toFixed(1)}%`} />}
          </div>
        </div>
      )}

      {/* Support Distance Envelope Meter */}
      {hasDistance && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#94a3b8',
            }}
          >
            <span>FLEX SUPPORT ENVELOPE</span>
            <span style={{ color: result.aceptado ? '#34d399' : '#fb7185', fontWeight: 700 }}>
              Distance {dist.toFixed(3)} {result.aceptado ? '≤' : '>'} Limit {limit.toFixed(3)}
            </span>
          </div>
          <div
            style={{
              position: 'relative',
              height: '8px',
              borderRadius: '999px',
              background: '#0f172a',
              border: '1px solid #1e293b',
            }}
          >
            <div
              style={{
                width: `${Math.max(4, distRatio * 100)}%`,
                height: '100%',
                borderRadius: '999px',
                background: result.aceptado ? '#34d399' : '#fb7185',
                transition: 'width 260ms ease-out',
              }}
            />
            <div
              title={`Learned limit: ${limit.toFixed(3)}`}
              style={{
                position: 'absolute',
                left: `${limitRatio * 100}%`,
                top: '-2px',
                bottom: '-2px',
                width: '2px',
                background: '#f8fafc',
              }}
            />
          </div>
        </div>
      )}

      {/* Nearest Neighbors vs Estimate Chart */}
      {neighbors.length > 0 && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#94a3b8',
              marginBottom: '6px',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <span>NEAREST FLEX NEIGHBORS ({neighbors.length} TRIALS)</span>
            {result.aceptado && Number.isFinite(result.duracion_estimada_s) && (
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                ESTIMATE: {result.duracion_estimada_s.toFixed(2)} s
              </span>
            )}
          </div>
          <div style={{ width: '100%', height: '165px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={neighbors} margin={{ top: 8, right: 10, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#182238" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#64748b"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  tickLine={false}
                  tickFormatter={(v) => `${v}s`}
                />
                <Tooltip content={<NeighborTooltip />} cursor={{ fill: 'rgba(56, 189, 248, 0.08)' }} />
                {result.aceptado && Number.isFinite(result.duracion_estimada_s) && (
                  <ReferenceLine
                    y={result.duracion_estimada_s}
                    stroke="#38bdf8"
                    strokeDasharray="4 4"
                    strokeWidth={1.6}
                  />
                )}
                <Bar dataKey="observado_s" radius={[5, 5, 0, 0]} maxBarSize={34} animationDuration={260}>
                  {neighbors.map((entry, idx) => (
                    <Cell
                      key={entry.label}
                      fill={idx === 0 ? '#38bdf8' : idx === 1 ? '#60a5fa' : '#475569'}
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
