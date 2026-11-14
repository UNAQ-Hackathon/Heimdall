import { createContext, useContext, useState } from 'react';

/* ── Scenario definitions ── */
export const SCENARIOS = {
  iss:       { id: 'iss',       label: 'ISS / Earth',          code: 'LB-01', sysId: 'HMDL-ISS-ALPHA',    gravity: '0g (microgravity)', gravityVal: 0,     oxygenPct: 21,  pressurePsi: 14.7,  planet: 'Tierra' },
  lunarBase: { id: 'lunarBase', label: 'Lunar Base',           code: 'LB-01', sysId: 'HMDL-LUNAR-ALPHA',  gravity: '0.166g',            gravityVal: 0.166, oxygenPct: 34,  pressurePsi: 10.2,  planet: 'Luna'   },
  rover:     { id: 'rover',     label: 'Pressurized Rover',    code: 'RV-03', sysId: 'HMDL-ROVER-GAMMA',  gravity: '0.166g',            gravityVal: 0.166, oxygenPct: 30,  pressurePsi: 10.2,  planet: 'Luna'   },
  spacesuit: { id: 'spacesuit', label: 'Spacesuit',            code: 'SU-02', sysId: 'HMDL-SUIT-BETA',    gravity: '0g (microgravity)', gravityVal: 0,     oxygenPct: 100, pressurePsi: 4.3,   planet: 'Tierra' },
  mars:      { id: 'mars',      label: 'Mars',                 code: 'MR-04', sysId: 'HMDL-MARS-DELTA',   gravity: '0.38g',             gravityVal: 0.38,  oxygenPct: 30,  pressurePsi: 10.2,  planet: 'Marte'  },
};

export const AUDIENCES = ['Student', 'Engineer'];

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [scenarioKey, setScenarioKey]   = useState('lunarBase');
  const [audience, setAudience]         = useState('Engineer');
  const [category, setCategory]         = useState('all');
  const [chatOpen, setChatOpen]         = useState(false);
  const [focusPlanet, setFocusPlanet]   = useState(null);
  const [weights, setWeights]           = useState({
    oxygenConc: 25,
    pressure:   20,
    airflow:    20,
    fuelType:   20,
    gravity:    15,
  });

  const value = {
    scenarioKey, scenario: SCENARIOS[scenarioKey], setScenarioKey,
    audience, setAudience,
    category, setCategory,
    chatOpen, setChatOpen,
    focusPlanet, setFocusPlanet,
    weights, setWeights,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
