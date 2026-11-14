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
} from 'recharts';

export default function FlammabilityChart() {
  // Generate boundary curves: Saffire-III 0g boundary line & extinction limit
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
    <div style={{ width: '100%', height: '260px' }}>
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
          />

          {/* Saffire-III 0g Boundary line */}
          <Line
            type="monotone"
            dataKey="saffire0g"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            name="Saffire-III 0g Boundary"
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
  );
}
