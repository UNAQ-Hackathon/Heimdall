import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MissionPlanetInspection from '../components/ui/MissionPlanetInspection.jsx';
import FireHazRPage from './FireHazRPage.jsx';
import FireHazrPredictor from '../components/ui/FireHazrPredictor.jsx';
import SpacecraftSelector from '../components/ui/SpacecraftSelector.jsx';
import SolarSystemScene from '../components/three/SolarSystemScene.jsx';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../services/api.js';
import { FACTOR_LABELS, buildMissionBriefMarkdown, rankLocalInvestigations } from '../services/ranking.js';
import { PLANETS, ISS_DESTINATION } from '../services/mockData.js';
import '../styles/mission-hub.css';

const PLANET_TO_SCENARIO = {
  Earth: 'earth',
  ISS: 'iss',
  Moon: 'moon',
  Mars: 'mars',
};

const FACTOR_COLORS = {
  atmosphereMatch: '#38bdf8',
  gravityMatch: '#a78bfa',
  dataRichness: '#34d399',
  documentation: '#fbbf24',
};

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'prevention', label: 'Prevention' },
  { id: 'detection', label: 'Detection' },
  { id: 'suppression', label: 'Suppression' },
];

export default function MissionHub() {
  const {
    setScenarioKey,
    scenario,
    audience,
    category,
    setCategory,
    focusPlanet,
    setFocusPlanet,
    weights,
    setWeights,
    shipFile,
    setShipFile,
    chatOpen,
    setChatOpen,
  } = useApp();

  const [searchParams] = useSearchParams();
  const [paused, setPaused] = useState(false);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab');
    return ['ranking', 'whatif', 'prediction'].includes(tab) ? tab : 'prediction';
  });
  const navigate = useNavigate();
  const targetRef = useRef(null);

  useEffect(() => {
    const qPlanet = searchParams.get('planet');
    if (qPlanet) setFocusPlanet(qPlanet);
    const qScenario = searchParams.get('scenario');
    if (qScenario) setScenarioKey(qScenario);
  }, [searchParams, setFocusPlanet, setScenarioKey]);

  const closeInspection = useCallback(() => {
    setFocusPlanet(null);
    targetRef.current?.focus({ preventScroll: true });
  }, [setFocusPlanet]);

  const localRanked = useMemo(
    () => rankLocalInvestigations({ ...scenario, category }, weights),
    [scenario, category, weights]
  );

  const [rankedItems, setRankedItems] = useState(localRanked);

  useEffect(() => {
    setRankedItems(localRanked);
    let cancelled = false;
    api.rank({ ...scenario, category }, weights).then((res) => {
      if (!cancelled && Array.isArray(res?.results)) {
        setRankedItems(res.results);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scenario, category, weights, localRanked]);

  const activePlanetObj = useMemo(
    () =>
      focusPlanet === 'ISS'
        ? ISS_DESTINATION
        : PLANETS.find((p) => p.name === focusPlanet) ?? null,
    [focusPlanet]
  );

  useEffect(() => {
    const mapped = focusPlanet ? PLANET_TO_SCENARIO[focusPlanet] : null;
    if (mapped) setScenarioKey(mapped);
  }, [focusPlanet, setScenarioKey]);

  return (
    <div className="mission-hub">
      {/* Left Minimalist Analytical Panel */}
      {!panelCollapsed && (
        <aside
          style={{
            width: 'min(420px, 100%)',
            minWidth: 0,
            flexShrink: 0,
            height: '100%',
            overflowY: 'auto',
            padding: '18px 20px',
            borderRight: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-panel)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            zIndex: 25,
          }}
        >
          {/* Live Scenario-Driven PSI Ranking Preview */}
          {rankedItems.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.45)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: '#94a3b8',
                }}
              >
                <span>TOP PSI RANKING · {scenario.label.toUpperCase()}</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('ranking')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#60a5fa',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  All ({rankedItems.length}) ↗
                </button>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {rankedItems.slice(0, 3).map((item, idx) => {
                  const inv = item.investigation ?? item;
                  const targetId = inv.id ?? inv.slug ?? inv.psiId ?? item.studyId ?? item._id;
                  const pctScore = Math.round((item.score ?? item.ranking?.score ?? 0) * 100);
                  return (
                    <button
                      key={inv.psiId ?? targetId ?? idx}
                      type="button"
                      onClick={() => navigate(`/study/${targetId}`)}
                      style={{
                        flex: '1 1 90px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        padding: '5px 8px',
                        borderRadius: '6px',
                        background: '#0b1322',
                        border: '1px solid #263449',
                        color: '#e2e8f0',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        #{idx + 1} {inv.acronym ?? inv.name ?? targetId}
                      </span>
                      <strong style={{ color: '#60a5fa', fontSize: '10.5px' }}>
                        {pctScore}
                      </strong>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Concise Mission & PSI Context in Main Sidebar */}
          <div
            style={{
              border: '1px solid #263449',
              borderRadius: '8px',
              padding: '10px 12px',
              background: '#0b1322',
              fontSize: '11.5px',
              lineHeight: 1.5,
              color: '#cbd5e1',
            }}
          >
            <strong style={{ display: 'block', color: '#93c5fd', marginBottom: '4px', fontSize: '12px' }}>
              Why these NASA PSI fire tests matter
            </strong>
            <p style={{ margin: 0 }}>
              In microgravity, flames lack buoyancy and form spherical diffusion clouds, making fire
              prevention (<strong>BASS</strong>, <strong>Saffire</strong>, <strong>ACME</strong>),
              detection (<strong>SAME</strong>), and suppression (<strong>FLEX</strong>) critical
              for spacecraft, Moon bases (<strong>≥30% O₂, ≤10.2 psi</strong>), and Mars habitats
              where 0g and 1g data bound partial-gravity risk.
            </p>
          </div>

          {/* Clean Segmented Mode Switcher: PSI Studies vs Fire Hazard Lab */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '4px',
              padding: '3px',
              borderRadius: '9px',
              background: 'rgba(8, 13, 26, 0.85)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('ranking')}
              style={{
                padding: '7px 10px',
                borderRadius: '7px',
                fontSize: '12px',
                fontWeight: 600,
                background:
                  activeTab === 'ranking' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border:
                  activeTab === 'ranking'
                    ? '1px solid rgba(59, 130, 246, 0.4)'
                    : '1px solid transparent',
                color: activeTab === 'ranking' ? '#f8fafc' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              Studies ({rankedItems.length})
            </button>
            <button
              type="button"
              className="mission-predictor-tab"
              aria-pressed={activeTab === 'prediction'}
              onClick={() => setActiveTab('prediction')}
            >
              Predictor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('whatif')}
              style={{
                padding: '7px 10px',
                borderRadius: '7px',
                fontSize: '12px',
                fontWeight: 600,
                background:
                  activeTab === 'whatif' ? 'rgba(245, 158, 11, 0.18)' : 'transparent',
                border:
                  activeTab === 'whatif'
                    ? '1px solid rgba(245, 158, 11, 0.45)'
                    : '1px solid transparent',
                color: activeTab === 'whatif' ? '#fbbf24' : '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              3D Lab
            </button>
          </div>

          {activeTab === 'prediction' ? (
            <FireHazrPredictor />
          ) : activeTab === 'whatif' ? (
            <FireHazRPage compact />
          ) : (
            <>
              {/* Minimalist Category Pills + Weights Button (only shown in Studies tab) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {CATEGORIES.map((cat) => {
                    const active = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        style={{
                          padding: '4px 9px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          border: active
                            ? '1px solid rgba(59, 130, 246, 0.4)'
                            : '1px solid transparent',
                          background: active
                            ? 'rgba(59, 130, 246, 0.16)'
                            : 'rgba(15, 23, 42, 0.5)',
                          color: active ? '#f8fafc' : '#94a3b8',
                          cursor: 'pointer',
                        }}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const md = buildMissionBriefMarkdown({
                        scenario,
                        rankedItems,
                        weights,
                        audience,
                        category,
                      });
                      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `heimdall-${scenario.id ?? 'mission'}-brief.md`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                    title="Export Mission Fire Safety Brief (.md)"
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#34d399',
                      fontSize: '10.5px',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                    }}
                  >
                    Brief ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeightsOpen(!weightsOpen)}
                    title="Adjust ranking weights"
                    style={{
                      padding: '4px 9px',
                      borderRadius: '6px',
                      background: weightsOpen
                        ? 'rgba(59, 130, 246, 0.18)'
                        : 'rgba(15, 23, 42, 0.6)',
                      border: weightsOpen
                        ? '1px solid rgba(59, 130, 246, 0.45)'
                        : '1px solid var(--border-subtle)',
                      color: weightsOpen ? '#60a5fa' : '#94a3b8',
                      fontSize: '10.5px',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                    }}
                  >
                    Weights
                  </button>
                </div>
              </div>

              {weightsOpen && (
                <div
                  className="tri-card"
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '7px',
                  }}
                >
                  {Object.entries(weights).map(([wKey, val]) => (
                    <div
                      key={wKey}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                      }}
                    >
                      <span style={{ color: '#cbd5e1' }}>
                        {FACTOR_LABELS[wKey] ?? wKey}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={val}
                          onChange={(e) =>
                            setWeights({ ...weights, [wKey]: Number(e.target.value) })
                          }
                          style={{ width: '90px', accentColor: '#3b82f6' }}
                        />
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: '#60a5fa',
                            width: '28px',
                            textAlign: 'right',
                          }}
                        >
                          {val}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <details
                style={{
                  border: '1px solid #263449',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  background: '#0b1322',
                  fontSize: '11.5px',
                  color: '#cbd5e1',
                  lineHeight: 1.5,
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#93c5fd' }}>
                  What are these NASA PSI investigations?
                </summary>
                <p style={{ margin: '8px 0 4px' }}>
                  NASA&apos;s Physical Science Informatics (PSI) database groups microgravity fire
                  research into three safety pillars:
                </p>
                <ul style={{ margin: '4px 0 0', paddingLeft: '16px', display: 'grid', gap: '4px' }}>
                  <li>
                    <strong>Prevention &amp; Flammability:</strong> <em>BASS / BASS-II</em> &amp;{' '}
                    <em>Saffire-I/II/III</em> (solid fabrics/plastics in MSG/SPICE &amp; Cygnus);{' '}
                    <em>ACME</em> (6 gas-flame tests in CIR, including <em>BRE</em>,{' '}
                    <em>CFI-G</em> up to 85% O₂, and <em>E-FIELD Flames</em>).
                  </li>
                  <li>
                    <strong>Detection:</strong> <em>SAME / SAME-R</em> (smoke aerosol sizing in
                    MSG; instrument also used in <em>DAFT / DAFT-2</em> for dust).
                  </li>
                  <li>
                    <strong>Suppression:</strong> <em>FLEX / FLEX-2</em> (liquid droplet burning in
                    CIR/MDCA with CO₂ and He diluents).
                  </li>
                </ul>
              </details>

              {/* Challenge Context + Active Audience Emphasis */}
              <div
                style={{
                  border: '1px solid var(--audience-border, #1e293b)',
                  borderRadius: '8px',
                  padding: '8px 11px',
                  background: 'var(--audience-tint, rgba(15, 23, 42, 0.55))',
                  fontSize: '11px',
                  color: '#cbd5e1',
                  lineHeight: 1.45,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <strong style={{ color: 'var(--audience-accent, #38bdf8)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                    {scenario.label?.toUpperCase() ?? 'SCENARIO'} · {audience === 'Student' ? 'STUDENT GUIDED MODE' : 'ENGINEER MODE'}
                  </strong>
                </div>
                {audience === 'Student'
                  ? scenario.partialGravity
                    ? `Because ${scenario.label ?? 'this habitat'} has partial gravity and ${scenario.oxygenPct}% O₂ (vs 21% on Earth), NASA uses 0g space and 1g Earth flame tests together to stay safe.`
                    : `In ${scenario.label ?? 'this setting'} (${scenario.oxygenPct}% O₂), flames behave very differently without gravity's upward hot-air draft.`
                  : (
                    <>
                      {scenario.oxygenPct > 21
                        ? `${scenario.oxygenPct}% O₂ (+${Math.round(((scenario.oxygenPct - 21) / 21) * 100)}% vs Earth 21%) at ${scenario.pressurePsi} psi cuts EVA pre-breathe time while raising flammability. `
                        : `${scenario.oxygenPct}% O₂ at ${scenario.pressurePsi} psi (Earth sea-level baseline reference). `}
                      {scenario.partialGravity
                        ? 'No partial-gravity PSI datasets exist yet (LUCI & FM2 upcoming); 0g + 1g studies & E-FIELD Flames bound this regime.'
                        : 'Microgravity removes buoyancy, making flames spherical and diffusion-limited.'}
                    </>
                  )}
              </div>

              {/* Clean, Minimalist Study Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {rankedItems.map(({ investigation: inv, score, breakdown }, idx) => {
                  const pct = Math.round(score * 100);
                  return (
                    <div
                      key={inv.psiId ?? inv.id}
                      onClick={() => navigate(`/study/${inv.id}`)}
                      className="tri-card"
                      style={{
                        padding: '13px 15px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', minWidth: 0 }}>
                          <span
                            style={{
                              color: '#64748b',
                              fontSize: '10.5px',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {idx + 1}.
                          </span>
                          <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc' }}>
                            {inv.acronym ?? inv.name}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              color: '#64748b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {inv.hardware ?? inv.facility}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            color: inv.dataAvailable === false ? '#fbbf24' : '#34d399',
                            background:
                              inv.dataAvailable === false
                                ? 'rgba(245, 158, 11, 0.12)'
                                : 'rgba(16, 185, 129, 0.1)',
                            border:
                              inv.dataAvailable === false
                                ? '1px solid rgba(245, 158, 11, 0.28)'
                                : '1px solid rgba(16, 185, 129, 0.22)',
                            borderRadius: '6px',
                            padding: '2px 7px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {inv.dataAvailable === false
                            ? 'NO PSI DATA YET'
                            : scenario.partialGravity
                              ? `${Math.max(10, pct - 7)}%–${Math.min(100, pct + 5)}%`
                              : `${pct}%`}
                        </span>
                      </div>

                      {audience === 'Engineer' && breakdown?.length > 0 && (
                        <div className="score-bar-container" style={{ height: '4px' }}>
                          {breakdown.map((b) => (
                            <div
                              key={b.factor}
                              className="score-bar-segment"
                              title={`${b.factor}: +${(b.contribution * 100).toFixed(0)}%`}
                              style={{
                                width: `${Math.max(3, b.contribution * 100)}%`,
                                backgroundColor: FACTOR_COLORS[b.factor] ?? '#3b82f6',
                              }}
                            />
                          ))}
                        </div>
                      )}

                      <p
                        style={{
                          margin: 0,
                          fontSize: audience === 'Student' ? '12px' : '11.5px',
                          color: audience === 'Student' ? '#cbd5e1' : '#94a3b8',
                          lineHeight: 1.5,
                        }}
                      >
                        {audience === 'Engineer'
                          ? inv.aiSummary?.engineer
                          : inv.aiSummary?.student}
                      </p>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          color: '#64748b',
                        }}
                      >
                        <span>
                          {audience === 'Student'
                            ? `${inv.category ?? 'safety'} · ${inv.gravityLevel ?? '0g'}`
                            : `O₂ ${inv.oxygenRange} · ${inv.ambientPressure}`}
                        </span>
                        <span style={{ color: 'var(--audience-accent, #60a5fa)' }}>
                          {audience === 'Student' ? 'Learn more →' : 'Details →'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </aside>
      )}

      {/* Right 3D Solar System Area */}
      <div
        className="mission-hub__explorer"
        style={{
          flex: 1,
          position: 'relative',
          height: '100%',
          background: '#040711',
          overflow: 'hidden',
        }}
      >
        {/* Edge Tab Handle to Collapse / Expand Sidebar */}
        <button
          type="button"
          aria-label={panelCollapsed ? 'Open sidebar' : 'Close sidebar'}
          title={panelCollapsed ? 'Open sidebar' : 'Close sidebar'}
          onClick={() => setPanelCollapsed(!panelCollapsed)}
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 30,
            width: '20px',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(13, 19, 33, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border-subtle)',
            borderLeft: 'none',
            borderRadius: '0 8px 8px 0',
            color: '#94a3b8',
            fontSize: '15px',
            lineHeight: 1,
            cursor: 'pointer',
            boxShadow: '4px 0 14px rgba(0, 0, 0, 0.4)',
          }}
        >
          {panelCollapsed ? '›' : '‹'}
        </button>

        {/* Minimalist Top Bar Over 3D Scene */}
        <div
          style={{
            position: 'absolute',
            top: '14px',
            left: '16px',
            right: '16px',
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          {/* Left: Spacecraft Selector */}
          <div style={{ pointerEvents: 'auto' }}>
            <SpacecraftSelector shipFile={shipFile} onSelect={setShipFile} />
          </div>
        </div>

        {/* Bottom Floating Quick-Travel Planet Dock */}
        <div
          ref={targetRef}
          tabIndex={-1}
          aria-label="Planet to explore"
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '9999px',
            background: 'rgba(10, 15, 29, 0.82)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-subtle)',
            maxWidth: '94%',
            overflowX: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => setFocusPlanet(null)}
            style={{
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: !focusPlanet ? 600 : 400,
              border: 'none',
              background: !focusPlanet ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              color: !focusPlanet ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Overview
          </button>
          {[
            ...PLANETS.slice(0, 4),
            ISS_DESTINATION,
            ...PLANETS.slice(4),
          ].map((p) => {
            const active = focusPlanet === p.name;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => setFocusPlanet(active ? null : p.name)}
                style={{
                  padding: '4px 9px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: active ? 600 : 400,
                  border: 'none',
                  background: active ? 'rgba(56, 189, 248, 0.22)' : 'transparent',
                  color: active ? '#f8fafc' : '#94a3b8',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.name === 'Sol' ? 'Sun' : p.name}
              </button>
            );
          })}
        </div>

        {/* 3D Solar System Canvas */}
        <div
          className="mission-hub__canvas"
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
        >
          <SolarSystemScene
            paused={paused}
            panelCollapsed={panelCollapsed}
            shipFile={shipFile}
          />
        </div>

        {/* Planet Surface & Landing Inspection Drawer */}
        {activePlanetObj && (
          <MissionPlanetInspection
            body={activePlanetObj}
            onClose={closeInspection}
            onOpenTestbench={() => {
              setPanelCollapsed(false);
              setActiveTab('whatif');
            }}
          />
        )}
      </div>
    </div>
  );
}
