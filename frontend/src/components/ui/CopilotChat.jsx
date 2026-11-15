import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { api as backendApi } from '../../services/api.js';

const CHAT_PROMPT_LIMIT = 20;

function GeminiLogo({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Gemini logo"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="gemini-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="55%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5C12.7 7.6 16.4 11.3 21.5 12C16.4 12.7 12.7 16.4 12 21.5C11.3 16.4 7.6 12.7 2.5 12C7.6 11.3 11.3 7.6 12 2.5Z"
        fill="url(#gemini-grad)"
        opacity="0.92"
      />
    </svg>
  );
}

export default function CopilotChat({ inline = false }) {
  const {
    chatOpen,
    setChatOpen,
    audience,
    chatMessages,
    chatLoading,
    chatSessionId,
    chatSessionUrl,
    sendChatMessage,
  } = useApp();
  const [input, setInput] = useState('');
  const [devinStatus, setDevinStatus] = useState(null);
  const [tokenMenuOpen, setTokenMenuOpen] = useState(false);
  const listRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    backendApi
      .chatStatus()
      .then((data) => {
        if (active) setDevinStatus(data);
      })
      .catch(() => {
        if (active) setDevinStatus({ connected: false, quotaStatus: 'offline' });
      });
    return () => {
      active = false;
    };
  }, [chatOpen, chatMessages.length]);

  const userPromptsUsed = chatMessages.filter((m) => m.role === 'user').length;
  const sessionTotalTokens = chatMessages.reduce(
    (sum, m) => sum + (Number(m.usage?.totalTokenCount) || 0),
    0
  );
  const sessionPromptTokens = chatMessages.reduce(
    (sum, m) => sum + (Number(m.usage?.promptTokenCount) || 0),
    0
  );
  const sessionOutputTokens = chatMessages.reduce(
    (sum, m) => sum + (Number(m.usage?.candidatesTokenCount) || 0),
    0
  );
  const serverBudget = devinStatus?.tokenBudget;
  const tokenLimit = serverBudget?.limit ?? 60000;
  const providerName = (
    devinStatus?.providerLabel ??
    (devinStatus?.provider === 'openai' ? 'AI' : devinStatus?.provider) ??
    'GEMINI'
  ).toUpperCase();
  const usedTokens = Math.max(serverBudget?.usedTokens ?? 0, sessionTotalTokens);
  const promptTokens = Math.max(serverBudget?.promptTokens ?? 0, sessionPromptTokens);
  const outputTokens = Math.max(serverBudget?.outputTokens ?? 0, sessionOutputTokens);
  const remainingTokens = Math.max(0, tokenLimit - usedTokens);
  const tokenPercent = tokenLimit > 0 ? Math.min(100, (usedTokens / tokenLimit) * 100) : 0;
  const hasQuotaError = chatMessages.some((m) => m.isError && /quota|429|RESOURCE_EXHAUSTED|budget limit/i.test(m.text));
  const alertLevel = hasQuotaError || tokenPercent >= 100
    ? 'exhausted'
    : tokenPercent >= 85
      ? 'critical'
      : tokenPercent >= 60
        ? 'warning'
        : 'ok';
  const limitReached = userPromptsUsed >= CHAT_PROMPT_LIMIT || alertLevel === 'exhausted';

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || chatLoading || limitReached) return;
    const text = input.trim();
    setInput('');
    await sendChatMessage(text);
  };

  // Avoid rendering duplicate overlapping chat boxes when the floating modal is open
  if (!inline && !chatOpen) return null;
  if (inline && chatOpen) return null;

  const renderFormattedText = (text = '') => {
    const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i} style={{ color: '#f8fafc' }}>
          {part.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className={`tri-card copilot-chat ${inline ? 'copilot-chat--inline' : 'copilot-chat--modal'}`}>
      {/* Header */}
      <div
        className="lowpoly-surface"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid #1c2640',
          backgroundColor: '#0d1321',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <GeminiLogo size={18} />
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.4px' }}>
            AI Copilot
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              color: hasQuotaError ? '#fca5a5' : chatLoading ? '#93c5fd' : '#c4b5fd',
              padding: '2px 7px',
              borderRadius: '9999px',
              border: hasQuotaError
                ? '1px solid rgba(248, 113, 113, 0.35)'
                : '1px solid rgba(129, 140, 248, 0.35)',
              background: hasQuotaError
                ? 'rgba(239, 68, 68, 0.12)'
                : 'rgba(99, 102, 241, 0.12)',
            }}
          >
            <GeminiLogo size={10} />
            {chatLoading
              ? `${providerName} · THINKING…`
              : hasQuotaError
                ? `${providerName} · QUOTA LIMIT`
                : `POWERED BY ${providerName}`}
          </span>
          {!inline && (
            <button
              type="button"
              aria-label="Close AI Copilot"
              onClick={() => setChatOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8892a8',
                cursor: 'pointer',
                fontSize: '15px',
                minWidth: '28px',
                minHeight: '28px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px 4px',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Gemini Token Meter Dropdown */}
      <div style={{ borderBottom: '1px solid #1c2640', background: '#090e1a' }}>
        <button
          type="button"
          onClick={() => setTokenMenuOpen((prev) => !prev)}
          aria-expanded={tokenMenuOpen}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '7px 12px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: '#94a3b8',
            textAlign: 'left',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '9999px',
                flexShrink: 0,
                background:
                  alertLevel === 'exhausted'
                    ? '#ef4444'
                    : alertLevel === 'critical'
                      ? '#f97316'
                      : alertLevel === 'warning'
                        ? '#f59e0b'
                        : '#22c55e',
              }}
            />
            <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
              {usedTokens.toLocaleString()} / {tokenLimit.toLocaleString()} tok
            </span>
            <span style={{ color: '#64748b' }}>({tokenPercent.toFixed(1)}%)</span>
          </span>

          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span
              style={{
                width: '48px',
                height: '5px',
                borderRadius: '9999px',
                background: '#1e293b',
                overflow: 'hidden',
                display: 'inline-block',
              }}
            >
              <span
                style={{
                  display: 'block',
                  height: '100%',
                  width: `${Math.max(usedTokens > 0 ? 4 : 0, tokenPercent)}%`,
                  background:
                    alertLevel === 'exhausted'
                      ? '#ef4444'
                      : alertLevel === 'critical'
                        ? '#f97316'
                        : alertLevel === 'warning'
                          ? '#f59e0b'
                          : 'linear-gradient(90deg, #60a5fa, #818cf8)',
                  transition: 'width 0.25s ease',
                }}
              />
            </span>
            <span style={{ color: alertLevel === 'ok' ? '#a5b4fc' : '#fca5a5' }}>
              {tokenMenuOpen ? '▴' : '▾'}
            </span>
          </span>
        </button>

        {alertLevel !== 'ok' && (
          <div
            role="alert"
            style={{
              margin: '0 10px 7px',
              padding: '5px 8px',
              borderRadius: '6px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.35,
              background:
                alertLevel === 'exhausted'
                  ? 'rgba(239, 68, 68, 0.14)'
                  : alertLevel === 'critical'
                    ? 'rgba(249, 115, 22, 0.14)'
                    : 'rgba(245, 158, 11, 0.14)',
              border:
                alertLevel === 'exhausted'
                  ? '1px solid rgba(248, 113, 113, 0.4)'
                  : alertLevel === 'critical'
                    ? '1px solid rgba(251, 146, 60, 0.4)'
                    : '1px solid rgba(251, 191, 36, 0.4)',
              color:
                alertLevel === 'exhausted'
                  ? '#fca5a5'
                  : alertLevel === 'critical'
                    ? '#fdba74'
                    : '#fde68a',
            }}
          >
            {alertLevel === 'exhausted'
              ? 'Budget Limit: API token budget reached — Gemini requests are paused to protect the API key.'
              : alertLevel === 'critical'
                ? `Critical: ${tokenPercent.toFixed(1)}% of API token budget used (${remainingTokens.toLocaleString()} left).`
                : `Heads up: ${tokenPercent.toFixed(1)}% of API token budget used.`}
          </div>
        )}

        {tokenMenuOpen && (
          <div
            style={{
              padding: '8px 12px 10px',
              borderTop: '1px solid #162038',
              background: 'rgba(13, 19, 33, 0.92)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px 10px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <div style={{ gridColumn: '1 / -1', marginBottom: '2px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#94a3b8',
                  marginBottom: '4px',
                }}
              >
                <span>Model: <strong style={{ color: '#e2e8f0' }}>{devinStatus?.model ?? 'gemini-2.5-flash'}</strong></span>
                <span style={{ color: devinStatus?.connected ? '#86efac' : '#fca5a5' }}>
                  {hasQuotaError ? 'Quota limit' : devinStatus?.connected ? 'API OK' : 'Offline'}
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '9999px',
                  background: '#1e293b',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(usedTokens > 0 ? 3 : 0, tokenPercent)}%`,
                    background:
                      alertLevel === 'exhausted'
                        ? '#ef4444'
                        : alertLevel === 'critical'
                          ? '#f97316'
                          : alertLevel === 'warning'
                            ? '#f59e0b'
                            : 'linear-gradient(90deg, #60a5fa, #818cf8, #c084fc)',
                  }}
                />
              </div>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block' }}>Input tokens</span>
              <strong style={{ color: '#cbd5e1' }}>{promptTokens.toLocaleString()}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block' }}>Output tokens</span>
              <strong style={{ color: '#cbd5e1' }}>{outputTokens.toLocaleString()}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block' }}>Remaining cap</span>
              <strong style={{ color: remainingTokens === 0 ? '#fca5a5' : '#86efac' }}>
                {remainingTokens.toLocaleString()} tok
              </strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block' }}>Session prompts</span>
              <strong style={{ color: '#a5b4fc' }}>
                {userPromptsUsed} / {CHAT_PROMPT_LIMIT}
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* Message List */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontSize: '12px',
          minHeight: '140px',
        }}
      >
        {chatMessages.length === 0 ? (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              padding: '18px 14px',
              color: '#94a3b8',
              fontSize: '11.5px',
              lineHeight: 1.5,
            }}
          >
            Ask a question about NASA PSI combustion investigations, mission fire-safety rankings, or FireHazR droplet predictions.
          </div>
        ) : (
          chatMessages.map((msg, idx) => (
          <div
            key={msg.id ?? idx}
            style={{
              background: msg.role === 'user' ? '#111827' : 'rgba(17, 24, 39, 0.65)',
              border:
                msg.role === 'user'
                  ? '1px solid #1c2640'
                  : '1px solid rgba(79, 142, 247, 0.15)',
              borderRadius: '6px',
              padding: '8px 10px',
              lineHeight: 1.45,
              opacity: msg.pending ? 0.78 : 1,
            }}
          >
            {msg.role === 'user' ? (
              <span style={{ color: '#93c5fd', fontStyle: 'italic' }}>{msg.text}</span>
            ) : (
              <div>
                <p
                  style={{
                    color: '#e2e8f0',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontStyle: msg.pending ? 'italic' : 'normal',
                  }}
                >
                  {renderFormattedText(msg.text)}
                </p>
                {msg.steps && msg.steps.length > 0 && (
                  <div
                    style={{
                      marginTop: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      borderLeft: '2px solid rgba(129, 140, 248, 0.35)',
                      paddingLeft: '7px',
                    }}
                  >
                    {msg.steps.map((s, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: '5px',
                          opacity: s.status === 'running' ? 1 : 0.82,
                        }}
                      >
                        <span
                          style={{
                            color:
                              s.status === 'running'
                                ? '#93c5fd'
                                : s.status === 'failed'
                                  ? '#fca5a5'
                                  : '#86efac',
                            flexShrink: 0,
                            animation:
                              s.status === 'running' ? 'heimdall-pulse 1s ease-in-out infinite' : 'none',
                          }}
                        >
                          {s.status === 'running' ? '◌' : s.status === 'failed' ? '✕' : '✓'}
                        </span>
                        <span style={{ color: '#cbd5e1' }}>
                          {s.name}
                          {s.argsLabel ? (
                            <span style={{ color: '#64748b' }}>({s.argsLabel})</span>
                          ) : null}
                        </span>
                        {s.summary ? (
                          <span style={{ color: '#64748b' }}>→ {s.summary}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
                {msg.steps?.some((s) => s.detail?.length > 0) && (
                  <div
                    style={{
                      marginTop: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9.5px',
                      color: '#64748b',
                      borderLeft: '2px solid rgba(34, 197, 94, 0.25)',
                      paddingLeft: '7px',
                    }}
                  >
                    {msg.steps
                      .filter((s) => s.detail?.length > 0)
                      .map((s, i) => (
                        <div key={i}>
                          <span style={{ color: '#475569' }}>└ {s.name}: </span>
                          {s.detail.join('  ·  ')}
                        </div>
                      ))}
                  </div>
                )}
                {(!msg.steps || msg.steps.length === 0) &&
                  msg.toolCalls &&
                  msg.toolCalls.length > 0 && (
                  <div
                    style={{
                      marginTop: '6px',
                      display: 'flex',
                      gap: '6px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {msg.toolCalls.map((t, i) => (
                      <span
                        key={i}
                        title={t.ok ? 'Grounded tool result' : 'Tool reported an error'}
                        style={{
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          background: t.ok
                            ? 'rgba(34, 197, 94, 0.12)'
                            : 'rgba(239, 68, 68, 0.12)',
                          border: t.ok
                            ? '1px solid rgba(34, 197, 94, 0.3)'
                            : '1px solid rgba(239, 68, 68, 0.3)',
                          color: t.ok ? '#86efac' : '#fca5a5',
                          borderRadius: '4px',
                          padding: '2px 6px',
                        }}
                      >
                        {t.ok ? '⚙' : '⚠'} {t.name}
                      </span>
                    ))}
                  </div>
                )}
                {msg.citations && msg.citations.length > 0 && (
                  <div
                    style={{
                      marginTop: '6px',
                      display: 'flex',
                      gap: '6px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {msg.citations.map((c, i) => {
                      const studyId = c.studyId ?? c.id ?? 'saffire-iii';
                      const label = c.label ?? c.acronym ?? c.title ?? 'Study';
                      return (
                        <button
                          key={i}
                          onClick={() => navigate(`/study/${studyId}`)}
                          style={{
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono)',
                            background: 'rgba(79, 142, 247, 0.15)',
                            border: '1px solid rgba(79, 142, 247, 0.3)',
                            color: '#60a5fa',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            cursor: 'pointer',
                          }}
                        >
                          Dataset ↗ {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          ))
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        style={{
          display: 'flex',
          padding: '8px',
          borderTop: '1px solid #1c2640',
          background: '#0a0f1e',
          gap: '6px',
        }}
      >
        <input
          type="text"
          className="copilot-chat__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={chatLoading || limitReached}
          placeholder={
            limitReached
              ? `Session limit reached (${CHAT_PROMPT_LIMIT} prompts).`
              : audience === 'Engineer'
                ? 'Ask Gemini: parameters, extinction limits...'
                : 'Ask Gemini about space fire safety...'
          }
        />
        <button
          type="submit"
          className="copilot-chat__send"
          disabled={chatLoading || limitReached || !input.trim()}
          style={{
            cursor: chatLoading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: chatLoading || !input.trim() ? 0.6 : 1,
          }}
        >
          {chatLoading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
