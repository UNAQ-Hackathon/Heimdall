import { createContext, useContext, useState } from 'react';
import { SCENARIOS, DEFAULT_WEIGHTS, resolveScenarioKey } from './scenarios.js';

export { SCENARIOS, DEFAULT_WEIGHTS, resolveScenarioKey };

const ScenarioContext = createContext(null);

export function ScenarioProvider({ children }) {
  const [scenarioKey, setScenarioKeyState] = useState('moon');
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);

  const setScenarioKey = (nextKey) => {
    setScenarioKeyState(resolveScenarioKey(nextKey));
  };

  const value = {
    scenarioKey,
    scenario: SCENARIOS[scenarioKey] ?? SCENARIOS.moon,
    setScenarioKey,
    weights,
    setWeights,
  };

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export const useScenario = () => useContext(ScenarioContext);
