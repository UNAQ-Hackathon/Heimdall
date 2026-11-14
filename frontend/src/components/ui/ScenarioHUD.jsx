import { useApp } from '../../context/AppContext.jsx';
import { SCENARIOS } from '../../context/AppContext.jsx';

export default function ScenarioHUD() {
  const { scenarioKey, setScenarioKey, scenario } = useApp();

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        zIndex: 20,
        background: 'rgba(13, 19, 33, 0.88)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #1c2640',
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: '#8892a8',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          Active Mission Scenario
        </span>
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: '#34d399',
            background: 'rgba(52, 211, 153, 0.1)',
            padding: '2px 6px',
            borderRadius: '4px',
            border: '1px solid rgba(52, 211, 153, 0.2)',
          }}
        >
          {scenario.oxygenPct}% O₂ · {scenario.pressurePsi} psi · {scenario.gravity}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {Object.entries(SCENARIOS).map(([key, item]) => {
          const isActive = scenarioKey === key;
          return (
            <button
              key={key}
              onClick={() => setScenarioKey(key)}
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                fontWeight: 600,
                padding: '5px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: isActive ? '1px solid #4f8ef7' : '1px solid #1c2640',
                background: isActive ? '#4f8ef7' : '#111827',
                color: isActive ? '#ffffff' : '#8892a8',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
