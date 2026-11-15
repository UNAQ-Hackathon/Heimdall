import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MissionPlanetInspection from '../components/ui/MissionPlanetInspection.jsx';
import FireHazRPage from './FireHazRPage.jsx';
import SpacecraftSelector from '../components/ui/SpacecraftSelector.jsx';
import SolarSystemScene from '../components/three/SolarSystemScene.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useSound } from '../context/SoundContext.jsx';
import { PLANETS, ISS_DESTINATION } from '../services/mockData.js';
import { TOUR_STEPS } from '../utils/onboarding-storage.js';
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
      'Test CO₂ and nitrogen below in the Algorithm lab to see how crews stop flames.',
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
    'Try switching the planet or opening the Algorithm lab to compare burning droplets and spacesuits.',
  ];
}

export default function MissionHub() {
  const {
    setScenarioKey,
    scenario,
    audience,
    focusPlanet,
    setFocusPlanet,
    shipFile,
    setShipFile,
    chatOpen,
    setChatOpen,
    tourOpen,
    tourStep,
  } = useApp();

  const sfx = useSound();
  const [searchParams] = useSearchParams();
  const [paused, setPaused] = useState(false);
  const [inspectionMinimized, setInspectionMinimized] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      return !searchParams.get('tab');
    }
    return false;
  });
  const navigate = useNavigate();
  const targetRef = useRef(null);

  useEffect(() => {
    const qPlanet = searchParams.get('planet');
    if (qPlanet) {
      setFocusPlanet(qPlanet);
      if (typeof window !== 'undefined' && window.innerWidth <= 900) {
        setPanelCollapsed(true);
      }
    }
    const qScenario = searchParams.get('scenario');
    if (qScenario) setScenarioKey(qScenario);
    if (searchParams.get('tab')) setPanelCollapsed(false);
  }, [searchParams, setFocusPlanet, setScenarioKey]);

  const closeInspection = useCallback(() => {
    sfx?.play('panel-close');
    setFocusPlanet(null);
    targetRef.current?.focus({ preventScroll: true });
  }, [setFocusPlanet, sfx]);

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

  useEffect(() => {
    setInspectionMinimized(false);
  }, [focusPlanet]);

  useEffect(() => {
    if (!tourOpen) return;
    const step = TOUR_STEPS[tourStep];
    if (!step) return;
    if (step.mobileTab === 'lab') {
      setPanelCollapsed(false);
    } else if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      setPanelCollapsed(true);
    }
  }, [tourOpen, tourStep]);

  return (
    <div className="mission-hub">
      {/* Mobile-only top switcher between 3D Solar System and the Fire Lab & PSI panel */}
      <div className="mission-hub__mobile-switcher" role="group" aria-label="Mission Hub view">
        <button
          type="button"
          className="mission-hub__mobile-tab"
          aria-pressed={panelCollapsed}
          onClick={() => setPanelCollapsed(true)}
        >
          Solar System 3D
        </button>
        <button
          type="button"
          className="mission-hub__mobile-tab"
          aria-pressed={!panelCollapsed}
          onClick={() => setPanelCollapsed(false)}
        >
          Fire Lab & PSI
        </button>
      </div>

      {/* Left Minimalist Analytical Panel */}
      {!panelCollapsed && (
        <aside className="mission-hub__sidebar" data-tour="fire-lab">
          {audience === 'Student' && (
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
                  fontFamily: 'var(--font-sans)',
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
                    fontFamily: 'var(--font-sans)',
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
          )}

          {/* Single FireHazR Algorithm lab (predictor meters + 3D flame chamber) */}
          <div
            style={{
              padding: '7px 10px',
              borderRadius: '9px',
              background: 'rgba(8, 13, 26, 0.85)',
              border: '1px solid var(--border-subtle)',
              textAlign: 'center',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.08em',
              color: '#fbbf24',
            }}
          >
            ALGORITHM · KNN FLEX v3
          </div>

          <FireHazRPage compact />
        </aside>
      )}

      {/* Right 3D Solar System Area */}
      <div
        className={`mission-hub__explorer${!panelCollapsed ? ' mission-hub__explorer--hidden-mobile' : ''}${activePlanetObj ? ' mission-hub__explorer--inspecting' : ''}${activePlanetObj && inspectionMinimized ? ' mission-hub__explorer--panel-minimized' : ''}`}
      >
        {/* Edge Tab Handle to Collapse / Expand Sidebar (Desktop) */}
        <button
          type="button"
          className="mission-hub__collapse-btn"
          aria-label={panelCollapsed ? 'Open sidebar' : 'Close sidebar'}
          title={panelCollapsed ? 'Open sidebar' : 'Close sidebar'}
          onClick={() => setPanelCollapsed(!panelCollapsed)}
        >
          {panelCollapsed ? '›' : '‹'}
        </button>

        <div className="mission-hub__stage">
          {/* Minimalist Top Bar Over 3D Scene */}
          <div className="mission-hub__top-overlay">
            {/* Left: Spacecraft Selector */}
            <div style={{ pointerEvents: 'auto' }} data-tour="craft-selector">
              <SpacecraftSelector shipFile={shipFile} onSelect={setShipFile} />
            </div>

            {!focusPlanet && !tourOpen && (
              <div className="mission-hub__stage-hint" aria-hidden="true">
                <span className="mission-hub__stage-hint-full">Drag to orbit · Scroll to zoom · Tap any planet to fly</span>
                <span className="mission-hub__stage-hint-compact">Drag to orbit · Tap a planet</span>
              </div>
            )}
          </div>

          {/* 3D Solar System Canvas */}
          <div
            className="mission-hub__canvas"
            style={{ position: 'absolute', inset: 0 }}
          >
            <SolarSystemScene
              paused={paused}
              panelCollapsed={panelCollapsed}
              shipFile={shipFile}
            />
          </div>
        </div>

        {/* Planet Surface & Landing Inspection Drawer */}
        {activePlanetObj && (
          <MissionPlanetInspection
            body={activePlanetObj}
            minimized={inspectionMinimized}
            onToggleMinimize={() => setInspectionMinimized((v) => !v)}
            onClose={closeInspection}
            onOpenTestbench={() => setPanelCollapsed(false)}
          />
        )}

        {/* Bottom Floating Quick-Travel Planet Dock */}
        <div
          ref={targetRef}
          tabIndex={-1}
          aria-label="Planet to explore"
          className="mission-hub__planet-dock"
          data-tour="planet-dock"
        >
          <span className="mission-hub__dock-label" aria-hidden="true">Fly to</span>
          <button
            type="button"
            className="mission-hub__planet-chip"
            onClick={() => setFocusPlanet(null)}
            style={{
              fontWeight: !focusPlanet ? 600 : 400,
              background: !focusPlanet ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              color: !focusPlanet ? '#38bdf8' : '#94a3b8',
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
                className="mission-hub__planet-chip"
                onClick={() => setFocusPlanet(active ? null : p.name)}
                style={{
                  fontWeight: active ? 600 : 400,
                  background: active ? 'rgba(56, 189, 248, 0.22)' : 'transparent',
                  color: active ? '#f8fafc' : '#94a3b8',
                }}
              >
                {p.name === 'Sol' ? 'Sun' : p.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
