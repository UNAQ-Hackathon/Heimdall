import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MissionPlanetInspection from '../components/ui/MissionPlanetInspection.jsx';
import FireHazRPage from './FireHazRPage.jsx';
import FireHazrPredictor from '../components/ui/FireHazrPredictor.jsx';
import SpacecraftSelector from '../components/ui/SpacecraftSelector.jsx';
import SolarSystemScene from '../components/three/SolarSystemScene.jsx';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../services/api.js';
import { rankLocalInvestigations } from '../services/ranking.js';
import { PLANETS, ISS_DESTINATION } from '../services/mockData.js';
import '../styles/mission-hub.css';

const PLANET_TO_SCENARIO = {
  Earth: 'earth',
  ISS: 'iss',
  Moon: 'moon',
  Mars: 'mars',
};

function getStudentDiscoveryPoints(scenario) {
  if (scenario?.id === 'iss') {
    return [
      'Hot air does not rise in orbit, so flames form slow-burning round spheres.',
      'Smoke floats everywhere instead of rising to a ceiling alarm.',
      'Test CO₂ and nitrogen below in Fire 3D or Predictor to see how crews stop flames.',
    ];
  }
  if (scenario?.partialGravity) {
    return [
      `This habitat runs near ${scenario.oxygenPct}% O₂ (Earth air is 21%) at lower pressure (${scenario.pressurePsi} psi).`,
      'NASA still has no real combustion tests in 1/6g Moon or 0.38g Mars gravity.',
      'Scientists bracket risk between 0g ISS tests and 1g Earth tests until LUCI and FM2 fly.',
    ];
  }
  return [
    'On Earth (21% O₂, 1g), buoyancy lifts hot exhaust upward into a classic teardrop flame.',
    'Use this 1g baseline to compare how much harder flames behave once gravity drops.',
    'Try switching the planet or switching to Fire 3D to compare burning droplets and spacesuits.',
  ];
}

export default function MissionHub() {
  const {
    setScenarioKey,
    scenario,
    audience,
    category,
    focusPlanet,
    setFocusPlanet,
    weights,
    shipFile,
    setShipFile,
    chatOpen,
    setChatOpen,
  } = useApp();

  const [searchParams] = useSearchParams();
  const [paused, setPaused] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab');
    return tab === 'whatif' || tab === '3d' ? 'whatif' : 'prediction';
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
          {/* Audience-Specific Top Context: Quantitative PSI Ranking (Engineer) vs Guided Fire Lesson (Student) */}
          {audience === 'Student' ? (
            <div
              style={{
                border: '1px solid var(--audience-border, rgba(52, 211, 153, 0.45))',
                borderRadius: '10px',
                padding: '12px 13px',
                background: 'var(--audience-tint, rgba(16, 185, 129, 0.12))',
                display: 'flex',
                flexDirection: 'column',
                gap: '7px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--audience-accent, #34d399)',
                  letterSpacing: '0.6px',
                }}
              >
                <span>STUDENT DISCOVERY · {scenario.label.toUpperCase()}</span>
                <button
                  type="button"
                  onClick={() => navigate('/studies')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#6ee7b7',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Catalog ↗
                </button>
              </div>
              <strong style={{ fontSize: '13px', color: '#f8fafc' }}>
                What changes in space fire here?
              </strong>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontSize: '11.5px',
                  color: '#d1fae5',
                  lineHeight: 1.45,
                }}
              >
                {getStudentDiscoveryPoints(scenario).map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
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
                      onClick={() => navigate('/studies')}
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
                  Engineering envelope · {scenario.oxygenPct}% O₂ · {scenario.pressurePsi} psi
                </strong>
                <p style={{ margin: 0 }}>
                  Microgravity removes buoyant convection, making diffusion flames spherical (<strong>BASS</strong>,{' '}
                  <strong>Saffire</strong>, <strong>ACME</strong>, <strong>FLEX</strong>).{' '}
                  {scenario.partialGravity
                    ? 'No partial-g PSI datasets exist yet; 0g and 1g baselines bound lunar/Mars risk.'
                    : 'Nominal 0g and 1g experimental references apply directly.'}
                </p>
              </div>
            </>
          )}

          {/* Clean 2-Tab Sidebar Switcher: Predictor vs Fire 3D */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '4px',
              padding: '3px',
              borderRadius: '9px',
              background: 'rgba(8, 13, 26, 0.85)',
              border: '1px solid var(--border-subtle)',
            }}
          >
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
              aria-pressed={activeTab === 'whatif'}
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
              Fire 3D
            </button>
          </div>

          {activeTab === 'prediction' ? <FireHazrPredictor /> : <FireHazRPage compact />}
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
