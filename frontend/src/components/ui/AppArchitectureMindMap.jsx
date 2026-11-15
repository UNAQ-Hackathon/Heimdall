import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/mindmap.css';

export const MINDMAP_NODES = [
  {
    id: 'psi-data',
    step: '01',
    title: 'NASA PSI Archive',
    subtitle: 'Space Fire Experiments',
    color: '#38bdf8',
    x: 190,
    y: 96,
    subBranches: [
      { label: 'BASS & Saffire', dx: -116, dy: -46 },
      { label: 'ACME (85% O2)', dx: 24, dy: -54 },
      { label: 'FLEX / SAME', dx: -124, dy: 44 },
    ],
    stack: ['NASA PSI Data', 'JSON ETL', 'MongoDB'],
    summary:
      'Real combustion trials flown on the ISS and Cygnus spacecraft, organized across prevention, smoke detection, and flame suppression.',
    studentNote:
      'Without gravity (0g), hot air does not rise, so flames turn into blue diffusion spheres instead of rising teardrops.',
    points: [
      'BASS & Saffire burn real fabrics and plastics',
      'SAME & DAFT measure smoke aerosols vs cabin dust',
      'FLEX & ACME study droplet and gas flame limits',
    ],
    route: '/studies',
    routeLabel: 'Browse PSI Catalog',
  },
  {
    id: 'knn-predictor',
    step: '02',
    title: 'KNN FLEX v3 Model',
    subtitle: 'Honest Prediction',
    color: '#34d399',
    x: 122,
    y: 266,
    subBranches: [
      { label: '258 ISS Trials', dx: -82, dy: -56 },
      { label: 'CO2 / He Mix', dx: -82, dy: 56 },
    ],
    stack: ['Python FastAPI', 'KNN FLEX v3', 'Coverage Gate'],
    summary:
      'Predicts microgravity droplet burn time (Methanol or Heptane) by comparing your conditions directly to the closest 258 ISS tests.',
    studentNote:
      'Unlike chatbots that guess when unsure, this engine refuses to answer if O2 or pressure falls outside real NASA data.',
    points: [
      'Uses pressure, droplet size, and O2/N2/CO2/He fractions',
      'Shows the exact historical neighbor tests and weights',
      'Safely abstains when queries exceed measured support',
    ],
    route: '/flame',
    routeLabel: 'Open FireHazR Lab',
  },
  {
    id: 'ranking-ai',
    step: '03',
    title: 'Ranking & AI Copilot',
    subtitle: 'Study Prioritization',
    color: '#60a5fa',
    x: 190,
    y: 436,
    subBranches: [
      { label: 'Transparent Score', dx: -116, dy: 48 },
      { label: 'Grounded Gemini', dx: 28, dy: 54 },
    ],
    stack: ['Factor Weights', 'Express 5', 'Gemini AI'],
    summary:
      'Scores and ranks NASA studies for Moon bases, Mars transit, ISS, or spacesuits using clear math rather than hidden black-box rules.',
    studentNote:
      'Moon bases plan >=30% O2 at lower pressure to help spacesuits—which makes materials burn over 40% more easily.',
    points: [
      'Weights atmosphere, gravity, data richness, and docs',
      'AI assistant cites verified numbers without inventing facts',
      'Explains results in Student or Aerospace Engineer mode',
    ],
    route: '/',
    routeLabel: 'Open Mission Hub',
  },
  {
    id: 'solar-iss',
    step: '04',
    title: '3D Solar System & ISS',
    subtitle: 'Mission Environments',
    color: '#a78bfa',
    x: 730,
    y: 96,
    subBranches: [
      { label: 'ISS Quest Airlock', dx: 112, dy: -46 },
      { label: '0g to 1g Bounds', dx: -24, dy: -54 },
    ],
    stack: ['React 19', 'Three.js / R3F', '3D GLB Models'],
    summary:
      'Interactive 3D map linking Earth, Moon, Mars, spacecraft fleets, and an animated airlock entry inside the orbiting ISS.',
    studentNote:
      'PSI lacks direct lunar (0.166g) and Martian (0.38g) test data yet, so 0g orbital and 1g Earth tests bound partial-gravity risk.',
    points: [
      'Fly ships to planets or dock alongside the ISS',
      'Enter the ISS pressurized module (CIR / MSG racks)',
      'Visualizes habitats cleanly without fabricating FLEX inputs',
    ],
    route: '/habitat',
    routeLabel: 'Open 3D Explorer',
  },
  {
    id: 'flammability-lab',
    step: '05',
    title: '3D Flammability Lab',
    subtitle: 'Suit & Ship Stress',
    color: '#f59e0b',
    x: 798,
    y: 266,
    subBranches: [
      { label: 'Nominal -> Burned', dx: 76, dy: -56 },
      { label: '0g vs 1g Plume', dx: 76, dy: 56 },
    ],
    stack: ['O2 Meters', '0g/1g Flames', 'Damage States'],
    summary:
      'Visualizes how rising O2 transforms 0g spheres vs 1g plumes and pushes EVA suits, landers, and ships from nominal to charred.',
    studentNote:
      'Spacesuits run at 100% O2 and 4.3 psi for flexibility—making strict electrical and fabric safety vital.',
    points: [
      'Switch between Nominal, In Flames, and Burned in 1 click',
      'Inspect real damage variants on Suit, Lander, and Blue Ship',
      'Coupled to FLEX oxygen and diluent chamber sliders',
    ],
    route: '/flame-3d',
    routeLabel: 'Launch Flame 3D Lab',
  },
  {
    id: 'earth-spinoff',
    step: '06',
    title: 'Earth Fire Safety',
    subtitle: 'Space-to-Earth Value',
    color: '#fb7185',
    x: 730,
    y: 436,
    subBranches: [
      { label: 'Water Mist', dx: 112, dy: 48 },
      { label: 'Clean Sensors', dx: -26, dy: 54 },
    ],
    stack: ['NFPA 750', 'Smoke Sizing', 'Clean Burners'],
    summary:
      'Turns orbital fire discoveries into better water-mist extinguishers, dust-immune smoke detectors, and safer gear on Earth.',
    studentNote:
      'Studying fire without gravity reveals exact chemical extinction kinetics, helping build safer, halon-free fire suppression.',
    points: [
      'FLEX dilution guides fine water-mist fire systems',
      'SAME aerosol sensors prevent dust/steam false alarms',
      'BASS & ACME improve protective gear and clean burners',
    ],
    route: null,
    routeLabel: 'Jump to Spin-Off Cards',
  },
];

function NodeGlyph({ id, color }) {
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth: '1.7',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  switch (id) {
    case 'psi-data':
      return (
        <g {...common}>
          <ellipse cx="0" cy="-5" rx="7" ry="2.6" />
          <path d="M-7 -5v10c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V-5" />
          <path d="M-7 0c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" />
        </g>
      );
    case 'knn-predictor':
      return (
        <g {...common}>
          <circle cx="-5" cy="-4" r="2" />
          <circle cx="5" cy="-3" r="2" />
          <circle cx="-2" cy="5" r="2" />
          <circle cx="5" cy="5" r="2" />
          <path d="M-3 -3L3 -2M-2 3L-4 -2M0 4L3 -1M0 5h3" />
        </g>
      );
    case 'ranking-ai':
      return (
        <g {...common}>
          <path d="M-6 5V1M0 5V-5M6 5V-2" />
          <path d="M-8 6H8" />
        </g>
      );
    case 'solar-iss':
      return (
        <g {...common}>
          <circle cx="0" cy="0" r="3" />
          <ellipse cx="0" cy="0" rx="8" ry="3.4" transform="rotate(-24)" />
        </g>
      );
    case 'flammability-lab':
      return (
        <g {...common}>
          <path d="M0 -7c3.5 3.2 5 6.2 5 9a5 5 0 0 1-10 0c0-2 1-4.1 2.5-6 .2 1.8 1.2 2.7 2.5 2.7-.2-2 .1-3.9 0-5.7Z" />
        </g>
      );
    default:
      return (
        <g {...common}>
          <circle cx="0" cy="0" r="6.5" />
          <path d="M-6.5 0h13M0 -6.5a9 9 0 0 1 0 13M0 -6.5a9 9 0 0 0 0 13" />
        </g>
      );
  }
}

export default function AppArchitectureMindMap({ onJumpToSection }) {
  const [selectedId, setSelectedId] = useState('psi-data');
  const [hoveredId, setHoveredId] = useState(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!autoPlay || hoveredId) return undefined;
    const timer = window.setInterval(() => {
      setSelectedId((prev) => {
        const idx = MINDMAP_NODES.findIndex((n) => n.id === prev);
        return MINDMAP_NODES[(idx + 1) % MINDMAP_NODES.length].id;
      });
    }, 4800);
    return () => window.clearInterval(timer);
  }, [autoPlay, hoveredId]);

  const activeId = hoveredId ?? selectedId;
  const activeNode =
    MINDMAP_NODES.find((node) => node.id === activeId) ?? MINDMAP_NODES[0];

  const handleSelect = (id) => {
    setSelectedId(id);
    setAutoPlay(false);
  };

  return (
    <section
      aria-label="Interactive Heimdall architecture mind map"
      style={{
        background: 'linear-gradient(155deg, #0b1324 0%, #070b15 100%)',
        border: '1px solid #1e2d4a',
        borderRadius: '14px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 18px 44px rgba(0, 0, 0, 0.35)',
      }}
    >
      {/* Top Title & Guided Tour Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#34d399',
              letterSpacing: '0.07em',
              marginBottom: '4px',
            }}
          >
            INTERACTIVE STUDENT MIND MAP // SYSTEM OVERVIEW
          </div>
          <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#f8fafc', margin: '0 0 4px 0' }}>
            How Heimdall Works: From Space Fire Tests to Earth Safety
          </h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, maxWidth: '680px' }}>
            Hover or select any node to trace how real NASA orbital data flows into prediction, 3D exploration, and everyday safety.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setAutoPlay((v) => !v)}
            aria-pressed={autoPlay}
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: '6px',
              border: autoPlay ? '1px solid #34d399' : '1px solid #263449',
              background: autoPlay ? 'rgba(52, 211, 153, 0.14)' : '#111827',
              color: autoPlay ? '#6ee7b7' : '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            {autoPlay ? 'Auto Tour: Active' : 'Auto Tour: Paused'}
          </button>
          <button
            type="button"
            onClick={() => {
              const idx = MINDMAP_NODES.findIndex((n) => n.id === activeNode.id);
              handleSelect(MINDMAP_NODES[(idx + 1) % MINDMAP_NODES.length].id);
            }}
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #263449',
              background: '#111827',
              color: '#e2e8f0',
              cursor: 'pointer',
            }}
          >
            Next Node
          </button>
        </div>
      </div>

      {/* Constellation Mind Map + Concise Student Summary */}
      <div className="mindmap-shell">
        <div className="mindmap-canvas-wrap">
          <svg
            viewBox="0 0 920 532"
            role="img"
            aria-label="Animated orbital constellation mind map showing all six Heimdall modules"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          >
            <defs>
              <pattern id="mindmap-dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="0.9" fill="#1e293b" opacity="0.65" />
              </pattern>
              <radialGradient id="mindmap-center-halo" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={activeNode.color} stopOpacity="0.28" />
                <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#060a14" stopOpacity="0" />
              </radialGradient>
              {MINDMAP_NODES.map((node) => (
                <linearGradient
                  key={`grad-${node.id}`}
                  id={`grad-${node.id}`}
                  x1="460"
                  y1="266"
                  x2={node.x}
                  y2={node.y}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
                  <stop offset="100%" stopColor={node.color} stopOpacity="1" />
                </linearGradient>
              ))}
            </defs>

            {/* Blueprint Grid & Dynamic Halo */}
            <rect width="920" height="532" fill="url(#mindmap-dot-grid)" rx="8" />
            <circle cx="460" cy="266" r="245" fill="url(#mindmap-center-halo)" />

            {/* Dual Rotating Telemetry Rings */}
            <circle
              cx="460"
              cy="266"
              r="116"
              fill="none"
              stroke="#243554"
              strokeWidth="1.2"
              strokeDasharray="6 8"
              className="mindmap-ring-slow"
            />
            <circle
              cx="460"
              cy="266"
              r="182"
              fill="none"
              stroke="#17233a"
              strokeWidth="1"
              strokeDasharray="3 10"
              className="mindmap-ring-counter"
            />
            <circle cx="460" cy="266" r="256" fill="none" stroke="#111a2e" strokeWidth="1" />

            {/* Curved Gradient Branches + Animated Traveling Energy Pulses */}
            {MINDMAP_NODES.map((node) => {
              const active = node.id === activeNode.id;
              const isLeft = node.x < 460;
              const ctrlX = isLeft ? 340 : 580;
              const ctrlY = 266 + (node.y - 266) * 0.28;
              const pathD = `M 460 266 Q ${ctrlX} ${ctrlY} ${node.x} ${node.y}`;
              return (
                <g key={`branch-${node.id}`}>
                  {/* Subtle Sub-Branches fanning out on Active Node */}
                  {active &&
                    node.subBranches.map((sub, sIdx) => {
                      const sx = node.x + sub.dx;
                      const sy = node.y + sub.dy;
                      return (
                        <g key={sub.label}>
                          <line
                            x1={node.x}
                            y1={node.y}
                            x2={sx}
                            y2={sy}
                            stroke={node.color}
                            strokeOpacity="0.55"
                            strokeWidth="1.3"
                            strokeDasharray="3 4"
                          />
                          <rect
                            x={sx - 48}
                            y={sy - 11}
                            width="96"
                            height="22"
                            rx="11"
                            fill="#0a1222"
                            stroke={node.color}
                            strokeOpacity="0.7"
                            strokeWidth="1"
                          />
                          <text
                            x={sx}
                            y={sy + 3.5}
                            textAnchor="middle"
                            fill="#e2e8f0"
                            fontSize="9.5"
                            fontFamily="monospace"
                            fontWeight="600"
                          >
                            {sub.label}
                          </text>
                        </g>
                      );
                    })}

                  <path
                    d={pathD}
                    fill="none"
                    stroke={node.color}
                    strokeOpacity={active ? 0.25 : 0.08}
                    strokeWidth={active ? 7 : 2.5}
                  />
                  <path
                    d={pathD}
                    fill="none"
                    stroke={`url(#grad-${node.id})`}
                    strokeOpacity={active ? 1 : 0.35}
                    strokeWidth={active ? 2.4 : 1.25}
                    className={active ? 'mindmap-flow-line' : undefined}
                  />

                  {/* Animated Traveling Signal Bead */}
                  {active && (
                    <circle r="3.6" fill="#f8fafc">
                      <animateMotion dur="2s" repeatCount="indefinite" path={pathD} />
                    </circle>
                  )}
                </g>
              );
            })}

            {/* Central Heimdall Hub */}
            <g>
              <circle
                cx="460"
                cy="266"
                r="76"
                fill="none"
                stroke={activeNode.color}
                strokeOpacity="0.45"
                strokeWidth="1.6"
                className="mindmap-pulse-ring"
              />
              <circle cx="460" cy="266" r="64" fill="#0b1324" stroke="#38bdf8" strokeWidth="2.2" />
              <circle cx="460" cy="266" r="56" fill="none" stroke="#1e3a5f" strokeWidth="1" />
              <text
                x="460"
                y="251"
                textAnchor="middle"
                fill="#38bdf8"
                fontSize="9.5"
                fontFamily="monospace"
                fontWeight="700"
                letterSpacing="1.3"
              >
                CORE ENGINE
              </text>
              <text
                x="460"
                y="272"
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="18"
                fontWeight="800"
              >
                HEIMDALL
              </text>
              <text
                x="460"
                y="290"
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="9"
                fontFamily="monospace"
              >
                NASA PSI Fire Safety
              </text>
            </g>

            {/* 6 Constellation Concept Nodes */}
            {MINDMAP_NODES.map((node) => {
              const active = node.id === activeNode.id;
              const boxW = 204;
              const boxH = 68;
              const bx = node.x - boxW / 2;
              const by = node.y - boxH / 2;
              return (
                <g
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  aria-label={`${node.step} ${node.title}: ${node.subtitle}`}
                  className="mindmap-node"
                  opacity={active ? 1 : 0.78}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(node.id)}
                  onBlur={() => setHoveredId(null)}
                  onClick={() => handleSelect(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSelect(node.id);
                    }
                  }}
                >
                  {active && (
                    <rect
                      x={bx - 4}
                      y={by - 4}
                      width={boxW + 8}
                      height={boxH + 8}
                      rx="15"
                      fill="none"
                      stroke={node.color}
                      strokeOpacity="0.48"
                      strokeWidth="1.6"
                    />
                  )}
                  <rect
                    x={bx}
                    y={by}
                    width={boxW}
                    height={boxH}
                    rx="12"
                    fill={active ? '#121f38' : '#0a111f'}
                    stroke={active ? node.color : '#22314d'}
                    strokeWidth={active ? 2 : 1.2}
                  />
                  <circle
                    cx={bx + 26}
                    cy={by + 34}
                    r="15"
                    fill="#070c17"
                    stroke={node.color}
                    strokeOpacity={active ? 0.85 : 0.4}
                    strokeWidth="1.3"
                  />
                  <g transform={`translate(${bx + 26}, ${by + 34})`}>
                    <NodeGlyph id={node.id} color={node.color} />
                  </g>
                  <text
                    x={bx + 50}
                    y={by + 23}
                    fill={node.color}
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="700"
                  >
                    STEP {node.step}
                  </text>
                  <text
                    x={bx + 50}
                    y={by + 40}
                    fill="#f8fafc"
                    fontSize="12.5"
                    fontWeight="700"
                  >
                    {node.title}
                  </text>
                  <text x={bx + 50} y={by + 55} fill="#94a3b8" fontSize="9.5">
                    {node.subtitle}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Clean Quick Stepper Strip */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {MINDMAP_NODES.map((node) => {
              const active = node.id === activeNode.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleSelect(node.id)}
                  style={{
                    flex: '1 1 110px',
                    padding: '6px 9px',
                    borderRadius: '7px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: active ? 700 : 500,
                    background: active ? `${node.color}22` : '#0c1424',
                    border: active ? `1px solid ${node.color}` : '1px solid #1d2a45',
                    color: active ? '#f8fafc' : '#94a3b8',
                    cursor: 'pointer',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {node.step}. {node.title}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Crisp, Scannable Student Takeaway Panel */}
        <article
          aria-live="polite"
          style={{
            background: '#0a1120',
            border: `1px solid ${activeNode.color}66`,
            borderRadius: '12px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: activeNode.color,
                  background: `${activeNode.color}1c`,
                  border: `1px solid ${activeNode.color}44`,
                  padding: '3px 8px',
                  borderRadius: '5px',
                }}
              >
                STEP {activeNode.step} · {activeNode.subtitle.toUpperCase()}
              </span>
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                {MINDMAP_NODES.findIndex((n) => n.id === activeNode.id) + 1} / {MINDMAP_NODES.length}
              </span>
            </div>

            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>
              {activeNode.title}
            </h3>

            <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
              {activeNode.summary}
            </p>

            <div
              style={{
                padding: '11px 13px',
                borderRadius: '8px',
                background: '#060b16',
                borderLeft: `3px solid ${activeNode.color}`,
                borderTop: '1px solid #1b2842',
                borderRight: '1px solid #1b2842',
                borderBottom: '1px solid #1b2842',
              }}
            >
              <div
                style={{
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: activeNode.color,
                  marginBottom: '4px',
                }}
              >
                CORE PHYSICS INSIGHT
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#f1f5f9', lineHeight: 1.48 }}>
                {activeNode.studentNote}
              </p>
            </div>

            <ul
              style={{
                margin: 0,
                paddingLeft: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '12px',
                color: '#94a3b8',
                lineHeight: 1.45,
              }}
            >
              {activeNode.points.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              paddingTop: '10px',
              borderTop: '1px solid #172236',
            }}
          >
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {activeNode.stack.map((tech) => (
                <span
                  key={tech}
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    padding: '3px 8px',
                    borderRadius: '9999px',
                    background: '#111827',
                    border: '1px solid #24324d',
                    color: '#cbd5e1',
                  }}
                >
                  {tech}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                activeNode.route ? navigate(activeNode.route) : onJumpToSection?.()
              }
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: `1px solid ${activeNode.color}66`,
                background: `${activeNode.color}24`,
                color: '#f8fafc',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {activeNode.routeLabel}
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
