import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { CHAT_HISTORY, api } from '../../services/mockData.js';

export default function CopilotChat({ inline = false }) {
  const { chatOpen, setChatOpen, audience } = useApp();
  const [messages, setMessages] = useState(CHAT_HISTORY);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: `"${userText}"` }]);
    setLoading(true);

    try {
      const res = await api.ask(userText);
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: res.answer,
          citations: res.citations,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: 'Unable to query NASA PSI archive right now. BASS-II and Saffire-III are recommended reference sets.',
          citations: [{ label: 'Saffire-III', studyId: 'saffire-iii' }],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // If floating and not open, don't render
  if (!inline && !chatOpen) return null;

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

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid #1c2640',
          background: '#0d1321',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', color: '#4f8ef7' }}>✦</span>
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px' }}>
            Heimdall AI Copilot
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: '#34d399',
              background: 'rgba(52, 211, 153, 0.12)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid rgba(52, 211, 153, 0.2)',
            }}
          >
            ACTIVE
          </span>
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
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              background: msg.role === 'user' ? '#111827' : 'rgba(17, 24, 39, 0.65)',
              border: msg.role === 'user' ? '1px solid #1c2640' : '1px solid rgba(79, 142, 247, 0.15)',
              borderRadius: '6px',
              padding: '8px 10px',
              lineHeight: 1.45,
            }}
          >
            {msg.role === 'user' ? (
              <span style={{ color: '#93c5fd', fontStyle: 'italic' }}>{msg.text}</span>
            ) : (
              <div>
                <p style={{ color: '#e2e8f0', margin: 0 }}>{msg.text}</p>
                {msg.citations && msg.citations.length > 0 && (
                  <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {msg.citations.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => navigate(`/study/${c.studyId}`)}
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
                        Dataset ↗ {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ color: '#8892a8', fontSize: '11px', fontStyle: 'italic' }}>
            Querying PSI flight telemetry vectors...
          </div>
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={audience === 'Engineer' ? 'Ask RAG: parameters, extinction limits...' : 'Ask about space fire safety...'}
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
          disabled={loading}
          style={{
            background: '#4f8ef7',
            border: 'none',
            borderRadius: '4px',
            color: '#ffffff',
            padding: '0 10px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
