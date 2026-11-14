import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CHAT_HISTORY } from '../services/mockData.js';
import { api as backendApi } from '../services/api.js';

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

  /* ── Shared Devin Copilot Chat State (single session across inline & modal) ── */
  const [chatMessages, setChatMessages]       = useState(CHAT_HISTORY);
  const [chatLoading, setChatLoading]         = useState(false);
  const [chatSessionId, setChatSessionId]     = useState(null);
  const [chatSessionUrl, setChatSessionUrl]   = useState(null);
  const [chatSessionStatus, setChatSessionStatus] = useState(null);
  const pollTimerRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback(
    (targetSessionId, baselineCount, pendingMsgId) => {
      stopPolling();
      pollTimerRef.current = setInterval(async () => {
        try {
          const statusRes = await backendApi.pollChatSession(targetSessionId, baselineCount);
          if (statusRes.sessionStatus) setChatSessionStatus(statusRes.sessionStatus);
          if (statusRes.sessionUrl) setChatSessionUrl(statusRes.sessionUrl);

          if (statusRes.status === 'completed' && statusRes.answer) {
            stopPolling();
            setChatLoading(false);
            setChatMessages((prev) =>
              prev.map((m) =>
                m.id === pendingMsgId
                  ? {
                      ...m,
                      text: statusRes.answer,
                      citations: statusRes.citations,
                      pending: false,
                    }
                  : m
              )
            );
          }
        } catch (err) {
          stopPolling();
          setChatLoading(false);
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === pendingMsgId
                ? {
                    ...m,
                    text: `Error polling Devin session: ${err.message}`,
                    pending: false,
                  }
                : m
            )
          );
        }
      }, 3500);
    },
    [stopPolling]
  );

  const sendChatMessage = useCallback(
    async (rawText) => {
      const userText = rawText?.trim();
      if (!userText || chatLoading) return;

      const activeScenario = SCENARIOS[scenarioKey];
      const pendingMsgId = `ai-${Date.now()}`;

      setChatLoading(true);
      setChatMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, role: 'user', text: `"${userText}"` },
        {
          id: pendingMsgId,
          role: 'ai',
          text: chatSessionId
            ? 'Sending query to active Devin SWE-2-Medium session…'
            : 'Starting Devin SWE-2-Medium session (first reply takes ~20–45s)…',
          pending: true,
        },
      ]);

      try {
        const res = await backendApi.ask(userText, {
          sessionId: chatSessionId,
          audience,
          scenario: activeScenario,
        });

        if (res.sessionId) setChatSessionId(res.sessionId);
        if (res.sessionUrl) setChatSessionUrl(res.sessionUrl);
        if (res.sessionStatus) setChatSessionStatus(res.sessionStatus);

        if (res.status === 'completed' && res.answer) {
          setChatLoading(false);
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === pendingMsgId
                ? {
                    ...m,
                    text: res.answer,
                    citations: res.citations,
                    pending: false,
                  }
                : m
            )
          );
        } else if (res.sessionId) {
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === pendingMsgId
                ? {
                    ...m,
                    text: `Devin session active (${res.sessionStatus ?? 'running'}). Generating PSI analysis…`,
                    pending: true,
                  }
                : m
            )
          );
          startPolling(res.sessionId, res.baselineCount ?? 0, pendingMsgId);
        } else {
          setChatLoading(false);
        }
      } catch (err) {
        setChatLoading(false);
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsgId
              ? {
                  ...m,
                  text: `Devin API unavailable (${err.message}). Make sure the backend is running on port 5000 (cd api && npm run dev).`,
                  citations: [{ label: 'Saffire-III', studyId: 'saffire-iii' }],
                  pending: false,
                }
              : m
          )
        );
      }
    },
    [audience, chatLoading, chatSessionId, scenarioKey, startPolling]
  );

  const resetChatSession = useCallback(() => {
    stopPolling();
    setChatLoading(false);
    setChatSessionId(null);
    setChatSessionUrl(null);
    setChatSessionStatus(null);
    setChatMessages(CHAT_HISTORY);
  }, [stopPolling]);

  const value = {
    scenarioKey, scenario: SCENARIOS[scenarioKey], setScenarioKey,
    audience, setAudience,
    category, setCategory,
    chatOpen, setChatOpen,
    focusPlanet, setFocusPlanet,
    weights, setWeights,
    chatMessages,
    chatLoading,
    chatSessionId,
    chatSessionUrl,
    chatSessionStatus,
    sendChatMessage,
    resetChatSession,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
