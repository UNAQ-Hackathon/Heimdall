import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';
import HeimdallLogo from '../components/ui/HeimdallLogo.jsx';

const QUICK_PROMPTS = [
  'Hi Heimdall, check the connection to the Devin API.',
  'What factors affect material flammability in microgravity?',
  'Summarize the key variables in space combustion experiments: oxygen, pressure, and gravity.',
];

export default function ChatPage() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Ask a question or choose an example to test your Devin API session.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionUrl, setSessionUrl] = useState(null);
  const [sessionStatus, setSessionStatus] = useState(null);
  const [error, setError] = useState(null);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const startPolling = (targetSessionId, baselineCount, pendingMsgId) => {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      try {
        const statusRes = await api.pollChatSession(targetSessionId, baselineCount);
        setSessionStatus(statusRes.sessionStatus);
        if (statusRes.sessionUrl) setSessionUrl(statusRes.sessionUrl);

        if (statusRes.status === 'completed' && statusRes.answer) {
          stopPolling();
          setLoading(false);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingMsgId
                ? { ...m, content: statusRes.answer, pending: false }
                : m
            )
          );
        }
      } catch (err) {
        stopPolling();
        setLoading(false);
        setError(err.message);
      }
    }, 3500);
  };

  const sendQuestion = async (rawQuestion) => {
    const question = rawQuestion.trim();
    if (!question || loading) return;

    setError(null);
    setInput('');
    setLoading(true);

    const userMsgId = `user-${Date.now()}`;
    const pendingMsgId = `assistant-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: question },
      {
        id: pendingMsgId,
        role: 'assistant',
        content: sessionId
          ? 'Sending your message to Devin…'
          : 'Starting a Devin API session…',
        pending: true,
      },
    ]);

    try {
      const res = await api.ask(question, sessionId);
      if (res.sessionId) setSessionId(res.sessionId);
      if (res.sessionUrl) setSessionUrl(res.sessionUrl);
      if (res.sessionStatus) setSessionStatus(res.sessionStatus);

      if ((res.status === 'completed' || res.status === 'unavailable') && res.answer) {
        setLoading(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsgId
              ? {
                  ...m,
                  content: res.answer,
                  citations: res.citations,
                  pending: false,
                }
              : m
          )
        );
      } else if (res.sessionId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsgId
              ? {
                  ...m,
                  content: `Devin session created (${res.sessionStatus ?? 'running'}). Waiting for a response…`,
                  pending: true,
                }
              : m
          )
        );
        startPolling(res.sessionId, res.baselineCount ?? 0, pendingMsgId);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
      setError(err.message);
      setMessages((prev) => prev.filter((m) => m.id !== pendingMsgId));
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendQuestion(input);
  };

  const resetSession = () => {
    stopPolling();
    setLoading(false);
    setSessionId(null);
    setSessionUrl(null);
    setSessionStatus(null);
    setError(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: 'Session reset. Your next message will start a new Devin session.',
      },
    ]);
  };

  return (
    <section className="chat-panel">
      <header className="chat-panel__header">
        <div>
          <p className="planet-preview__eyebrow"><HeimdallLogo /> / DEVIN API TEST</p>
          <h1>Chat Panel</h1>
        </div>
        <div className="chat-panel__meta">
          {sessionId && (
            <span className="chat-panel__badge">
              Session: <code>{sessionId.slice(0, 14)}…</code>
              {sessionStatus ? ` · ${sessionStatus}` : ''}
            </span>
          )}
          {sessionUrl && (
            <a
              href={sessionUrl}
              target="_blank"
              rel="noreferrer"
              className="chat-panel__link"
            >
              View in Devin ↗
            </a>
          )}
          {sessionId && (
            <button
              type="button"
              onClick={resetSession}
              className="chat-panel__reset"
            >
              New session
            </button>
          )}
        </div>
      </header>

      <div className="chat-panel__prompts">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={loading}
            onClick={() => sendQuestion(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="chat-panel__messages" aria-live="polite">
        {messages.map((msg) => (
          <article
            key={msg.id}
            className={`chat-msg chat-msg--${msg.role}${msg.pending ? ' chat-msg--pending' : ''}`}
          >
            <header className="chat-msg__role">
              {msg.role === 'user' ? 'You' : 'Heimdall (Devin)'}
            </header>
            <div className="chat-msg__body">{msg.content}</div>
            {msg.citations?.length > 0 && (
              <footer className="chat-msg__citations">
                PSI sources:{' '}
                {msg.citations.map((c) => c.acronym || c.title).join(', ')}
              </footer>
            )}
          </article>
        ))}
      </div>

      {error && (
        <div className="chat-panel__error" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      <form className="chat-panel__form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question to test the Devin API…"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          {loading ? 'Waiting…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
