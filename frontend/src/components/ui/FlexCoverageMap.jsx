import { useState } from 'react';
import { getMixtureEnvelope } from '../../services/flex-coverage.js';

const W = 360;
const H = 148;
const PAD = { top: 14, right: 14, bottom: 26, left: 46 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

export default function FlexCoverageMap({ conditions, coverage, onSelectTrial }) {
  const [hovered, setHovered] = useState(null);
  const fuel = conditions?.fuel === 'Heptane' ? 'Heptane' : 'Methanol';
  const mix = coverage?.mix ?? 'O₂/N₂';
  const env = getMixtureEnvelope(fuel, mix);
  const trials = coverage?.poolTrials ?? [];

  const isDiluentAxis = mix === 'CO₂' || mix === 'He';
  const xMin = (isDiluentAxis ? (mix === 'CO₂' ? env.co2[0] : env.he[0]) : env.o2[0]) * 100;
  const xMax = (isDiluentAxis ? (mix === 'CO₂' ? env.co2[1] : env.he[1]) : env.o2[1]) * 100;
  const yMin = env.pressure[0];
  const yMax = env.pressure[1];

  const mapX = (pct) => PAD.left + ((pct - xMin) / Math.max(1e-6, xMax - xMin)) * PW;
  const mapY = (p) => PAD.top + PH - ((p - yMin) / Math.max(1e-6, yMax - yMin)) * PH;

  const curXVal =
    (isDiluentAxis
      ? Number(mix === 'CO₂' ? conditions.co2_fraction : conditions.he_fraction) || 0
      : Number(conditions.o2_fraction) || 0) * 100;
  const curYVal = Number(conditions.pressure_mmhg) || yMin;
  const cx = Math.min(PAD.left + PW, Math.max(PAD.left, mapX(curXVal)));
  const cy = Math.min(PAD.top + PH, Math.max(PAD.top, mapY(curYVal)));
  const activeColor = coverage?.supported ? '#34d399' : '#f59e0b';
  const xLabel = isDiluentAxis ? `${mix} (%)` : 'O₂ (%)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '8px 10px',
        borderRadius: '8px',
        background: '#080f1c',
        border: '1px solid #1e293b',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
          NASA FLEX Trials ({trials.length} in {fuel} · {mix})
        </span>
        <span style={{ color: '#64748b' }}>Click any dot to load</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Interactive NASA FLEX coverage map for ${fuel} in ${mix}`}
        style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}
      >
        {/* Plot Area */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={PW}
          height={PH}
          rx={4}
          fill="#050811"
          stroke="#1c2640"
          strokeWidth={1}
        />

        {/* Grid ticks */}
        {[0.25, 0.5, 0.75].map((f) => {
          const gy = PAD.top + PH * (1 - f);
          const gx = PAD.left + PW * f;
          return (
            <g key={f}>
              <line x1={PAD.left} y1={gy} x2={PAD.left + PW} y2={gy} stroke="#141e33" strokeWidth={0.8} />
              <line x1={gx} y1={PAD.top} x2={gx} y2={PAD.top + PH} stroke="#141e33" strokeWidth={0.8} />
            </g>
          );
        })}

        {/* Y axis labels */}
        <text x={PAD.left - 5} y={PAD.top + 8} textAnchor="end" fill="#64748b" fontSize="8.5" fontFamily="monospace">
          {Math.round(yMax)}
        </text>
        <text x={PAD.left - 5} y={PAD.top + PH} textAnchor="end" fill="#64748b" fontSize="8.5" fontFamily="monospace">
          {Math.round(yMin)}
        </text>
        <text
          x={11}
          y={PAD.top + PH / 2}
          textAnchor="middle"
          fill="#64748b"
          fontSize="8.5"
          fontFamily="monospace"
          transform={`rotate(-90 11 ${PAD.top + PH / 2})`}
        >
          mmHg
        </text>

        {/* X axis labels */}
        <text x={PAD.left} y={H - 8} textAnchor="start" fill="#64748b" fontSize="8.5" fontFamily="monospace">
          {xMin.toFixed(0)}%
        </text>
        <text x={PAD.left + PW / 2} y={H - 8} textAnchor="middle" fill="#94a3b8" fontSize="8.5" fontFamily="monospace">
          {xLabel}
        </text>
        <text x={PAD.left + PW} y={H - 8} textAnchor="end" fill="#64748b" fontSize="8.5" fontFamily="monospace">
          {xMax.toFixed(0)}%
        </text>

        {/* Real NASA FLEX Trials */}
        {trials.map((trial, idx) => {
          const txVal = (isDiluentAxis ? (mix === 'CO₂' ? trial.co2 : trial.he) : trial.o2) * 100;
          const px = mapX(txVal);
          const py = mapY(trial.p);
          const isNearest = coverage?.nearestTrial?.id === trial.id && coverage?.nearestTrial?.p === trial.p;
          const isHover = hovered?.id === trial.id && hovered?.p === trial.p;
          return (
            <circle
              key={`${trial.id}-${idx}`}
              cx={px}
              cy={py}
              r={isHover ? 5.2 : isNearest ? 4.2 : 3.1}
              fill={isNearest ? '#38bdf8' : 'rgba(56, 189, 248, 0.52)'}
              stroke={isHover || isNearest ? '#e0f2fe' : 'rgba(125, 211, 252, 0.4)'}
              strokeWidth={isHover ? 1.4 : 0.8}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(trial)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectTrial?.(trial)}
            />
          );
        })}

        {/* Current Meter Crosshair */}
        <line x1={cx} y1={PAD.top} x2={cx} y2={PAD.top + PH} stroke={activeColor} strokeWidth={0.9} strokeDasharray="3 2" opacity={0.65} />
        <line x1={PAD.left} y1={cy} x2={PAD.left + PW} y2={cy} stroke={activeColor} strokeWidth={0.9} strokeDasharray="3 2" opacity={0.65} />
        <circle cx={cx} cy={cy} r={5.5} fill="none" stroke={activeColor} strokeWidth={1.6} />
        <circle cx={cx} cy={cy} r={2.2} fill={activeColor} />
      </svg>

      <div
        style={{
          minHeight: '16px',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          color: hovered ? '#93c5fd' : '#94a3b8',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        {hovered ? (
          <span>
            Trial <strong>{hovered.id}</strong> · {hovered.p} mmHg · {Math.round(hovered.o2 * 100)}% O₂
            {hovered.co2 > 0 ? ` · ${Math.round(hovered.co2 * 100)}% CO₂` : ''}
            {hovered.he > 0 ? ` · ${Math.round(hovered.he * 100)}% He` : ''} · D {hovered.d} mm
          </span>
        ) : (
          <span>
            Cursor: {curYVal.toFixed(1)} mmHg · {Math.round((Number(conditions.o2_fraction) || 0) * 100)}% O₂
            {mix !== 'O₂/N₂' ? ` · ${Math.round(curXVal)}% ${mix}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}
