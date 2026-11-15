import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
} from 'recharts';

export default function TimeSeriesChart({ data }) {
  // Generate realistic combustion run time series if none passed
  const chartData = data?.data || [
    { time: 0,   tc: 24,  flux: 0.2 },
    { time: 20,  tc: 180, flux: 4.8 },
    { time: 40,  tc: 420, flux: 16.5 },
    { time: 60,  tc: 690, flux: 29.0 },
    { time: 78,  tc: 817, flux: 38.4 }, // Peak 1
    { time: 100, tc: 620, flux: 24.1 },
    { time: 130, tc: 540, flux: 19.3 },
    { time: 160, tc: 640, flux: 28.5 },
    { time: 195, tc: 760, flux: 41.2 }, // Peak 2
    { time: 230, tc: 590, flux: 25.0 },
    { time: 260, tc: 340, flux: 11.2 },
    { time: 280, tc: 160, flux: 3.5 },
    { time: 300, tc: 65,  flux: 0.8 },
  ];

  return (
    <div style={{ width: '100%', height: '240px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 15, right: 25, bottom: 15, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c2640" vertical={false} />
          <XAxis
            dataKey="time"
            stroke="#64748b"
            fontSize={10}
            fontFamily="var(--font-sans)"
            tickFormatter={(v) => `${v}s`}
          />
          <YAxis
            yAxisId="tc"
            domain={[0, 950]}
            stroke="#38bdf8"
            fontSize={10}
            fontFamily="var(--font-sans)"
            tickFormatter={(v) => `${v}°C`}
          />
          <YAxis
            yAxisId="flux"
            orientation="right"
            domain={[0, 50]}
            stroke="#fb7185"
            fontSize={10}
            fontFamily="var(--font-sans)"
            tickFormatter={(v) => `${v} kW`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0d1321',
              borderColor: '#1c2640',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'var(--font-sans)',
            }}
            formatter={(value, name) => [
              name === 'tc' ? `${value} °C` : `${value} kW/m²`,
              name === 'tc' ? 'TC Array (Temp)' : 'Radiant Heat Flux',
            ]}
          />
          {/* Temperature curve */}
          <Line
            yAxisId="tc"
            type="monotone"
            dataKey="tc"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            animationDuration={320}
            animationEasing="ease-out"
          />
          {/* Radiant flux curve */}
          <Line
            yAxisId="flux"
            type="monotone"
            dataKey="flux"
            stroke="#fb7185"
            strokeWidth={2}
            strokeDasharray="4 2"
            dot={false}
            animationDuration={320}
            animationEasing="ease-out"
          />

          {/* Peak 1 */}
          <ReferenceDot
            yAxisId="tc"
            x={78}
            y={817}
            r={5}
            fill="#38bdf8"
            stroke="#ffffff"
            strokeWidth={1.5}
          />

          {/* Peak 2 */}
          <ReferenceDot
            yAxisId="flux"
            x={195}
            y={41.2}
            r={5}
            fill="#fb7185"
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
