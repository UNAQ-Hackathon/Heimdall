import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CHAT_HISTORY } from '../services/mockData.js';
import { api as backendApi } from '../services/api.js';
import { SCENARIOS, DEFAULT_WEIGHTS, resolveScenarioKey } from './ScenarioContext.jsx';

export { SCENARIOS, DEFAULT_WEIGHTS, resolveScenarioKey };

export const AUDIENCES = ['Student', 'Engineer'];

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [scenarioKey, setScenarioKeyState] = useState('moon');
  const [audience, setAudience] = useState('Engineer');
  const [category, setCategory] = useState('all');
  const [chatOpen, setChatOpen] = useState(false);
  const [focusPlanet, setFocusPlanet] = useState(null);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);

  const setScenarioKey = useCallback((nextKey) => {
    setScenarioKeyState(resolveScenarioKey(nextKey));
  }, []);

  /* ── Shared Devin Copilot Chat State (single session across inline & modal) ── */
  const [chatMessages, setChatMessages] = useState(CHAT_HISTORY);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(null);
  const [chatSessionUrl, setChatSessionUrl] = useState(null);
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
                    text: `Error consulting Heimdall AI: ${err.message}`,
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

      const activeScenario = SCENARIOS[scenarioKey] ?? SCENARIOS.moon;
      const pendingMsgId = `ai-${Date.now()}`;

      setChatLoading(true);
      setChatMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, role: 'user', text: `"${userText}"` },
        {
          id: pendingMsgId,
          role: 'ai',
          text: chatSessionId
            ? 'Heimdall AI analyzing NASA PSI archive…'
            : 'Heimdall AI initializing NASA PSI combustion telemetry…',
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
                    text: 'Heimdall AI synthesizing NASA PSI parameters and bounds…',
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
                  text: `Heimdall AI backend unavailable (${err.message}). Make sure the API is running on port 5000 (cd api && npm run dev).`,
                  citations: [{ label: 'Saffire-III', studyId: 'psi-saffire-iii' }],
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
    scenarioKey,
    scenario: SCENARIOS[scenarioKey] ?? SCENARIOS.moon,
    setScenarioKey,
    audience,
    setAudience,
    category,
    setCategory,
    chatOpen,
    setChatOpen,
    focusPlanet,
    setFocusPlanet,
    weights,
    setWeights,
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
