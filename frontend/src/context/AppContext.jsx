import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api as backendApi } from '../services/api.js';
import { SCENARIOS, DEFAULT_WEIGHTS, resolveScenarioKey } from './ScenarioContext.jsx';
import { loadSavedShipFile, saveShipFile } from '../utils/spacecraft-storage.js';

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
  const [shipFile, setShipFileState] = useState(() => loadSavedShipFile());

  const setScenarioKey = useCallback((nextKey) => {
    setScenarioKeyState(resolveScenarioKey(nextKey));
  }, []);

  const setShipFile = useCallback((nextShipFile) => {
    const resolved = saveShipFile(nextShipFile);
    setShipFileState(resolved);
  }, []);

  /* ── Shared Copilot Chat State (single session across inline & modal) ── */
  const [chatMessages, setChatMessages] = useState([]);
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
                    text: `Error consulting Devin AI: ${err.message}`,
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
            ? 'Gemini AI analyzing NASA PSI archive…'
            : 'Gemini AI querying NASA PSI combustion context…',
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

        if ((res.status === 'completed' || res.status === 'unavailable') && res.answer) {
          setChatLoading(false);
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === pendingMsgId
                ? {
                    ...m,
                    text: res.answer,
                    citations: res.citations,
                    toolCalls: res.toolCalls ?? [],
                    usage: res.usage ?? null,
                    isError: res.status === 'unavailable',
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
                    text: 'Devin AI synthesizing NASA PSI parameters and bounds…',
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
        const isQuotaError =
          /out_of_quota|billing_restricted|429|RESOURCE_EXHAUSTED|budget limit/i.test(err?.message ?? '');
        const isHighDemand =
          /503|high demand|UNAVAILABLE|overloaded/i.test(err?.message ?? '');
        const text = isQuotaError
          ? `Gemini API quota or token budget limit reached (${err.message}).`
          : isHighDemand
            ? 'Gemini is temporarily experiencing high demand (503). Please try again in a few seconds.'
            : `Gemini API error: ${err.message}. Check that the API server and GEMINI_API_KEY are available.`;
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsgId
              ? {
                  ...m,
                  text,
                  isError: true,
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
    setChatMessages([]);
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
    shipFile,
    setShipFile,
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
