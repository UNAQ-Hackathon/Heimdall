import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import HeimdallLogo from './HeimdallLogo.jsx';

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
  const listRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || chatLoading) return;
    const text = input.trim();
    setInput('');
    await sendChatMessage(text);
  };

  // Avoid rendering duplicate overlapping chat boxes when the floating modal is open
  if (!inline && !chatOpen) return null;
  if (inline && chatOpen) return null;

  const containerStyle = inline
    ? {
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        width: '340px',
        maxHeight: '340px',
        background: 'rgba(13, 19, 33, 0.94)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #1c2640',
        borderRadius: '10px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
        zIndex: 30,
        overflow: 'hidden',
      }
    : {
        position: 'fixed',
        bottom: '36px',
        right: '24px',
        width: '380px',
        maxHeight: '480px',
        background: 'rgba(13, 19, 33, 0.96)',
        backdropFilter: 'blur(16px)',
        border: '1px solid #2a3654',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
        zIndex: 200,
        overflow: 'hidden',
      };

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
    <div className="tri-card" style={containerStyle}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HeimdallLogo size={28} />
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px' }}>
            AI Copilot
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {chatSessionUrl && (
            <a
              href={chatSessionUrl}
              target="_blank"
              rel="noreferrer"
              title={`Devin session: ${chatSessionId}`}
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                color: '#60a5fa',
                textDecoration: 'none',
                padding: '2px 5px',
                borderRadius: '4px',
                border: '1px solid rgba(96, 165, 250, 0.25)',
                background: 'rgba(79, 142, 247, 0.1)',
              }}
            >
              Devin ↗
            </a>
          )}
          {chatLoading && <span role="status" style={{ fontSize: '11px', color: '#94a3b8' }}>Thinking…</span>}
          {!inline && (
            <button
              onClick={() => setChatOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8892a8',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '0 4px',
              }}
            >
              ✕
            </button>
          )}
        </div>
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
        }}
      >
        {chatMessages.map((msg, idx) => (
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
        ))}
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={chatLoading}
          placeholder={
            audience === 'Engineer'
              ? 'Ask RAG: parameters, extinction limits...'
              : 'Ask about space fire safety...'
          }
          style={{
            flex: 1,
            background: '#111827',
            border: '1px solid #1c2640',
            borderRadius: '4px',
            color: '#e2e8f0',
            fontSize: '11px',
            padding: '6px 8px',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={chatLoading || !input.trim()}
          style={{
            background: '#4f8ef7',
            border: 'none',
            borderRadius: '4px',
            color: '#ffffff',
            padding: '0 10px',
            fontSize: '11px',
            fontWeight: 600,
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
