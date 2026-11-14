import { NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import CopilotChat from '../ui/CopilotChat.jsx';

const links = [
  { to: '/', label: 'MISSION HUB', end: true },
  { to: '/study/saffire-iii', label: 'STUDY DETAIL' },
  { to: '/flame-3d', label: 'FLAME 3D' },
  { to: '/compare', label: 'COMPARE & EARTH' },
];

export default function AppLayout() {
  const { audience, setAudience, chatOpen, setChatOpen } = useApp();

  return (
    <div className="app-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Top Header Bar ── */}
      <header
        style={{
          height: '52px',
          background: '#0a0f1e',
          borderBottom: '1px solid #1c2640',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0,
          zIndex: 100,
        }}
      >
        {/* Left: Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <NavLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc', letterSpacing: '2px' }}>
              HEIMDALL
            </span>
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.12)',
                padding: '2px 6px',
                borderRadius: '3px',
                border: '1px solid rgba(56, 189, 248, 0.25)',
              }}
            >
              ORBITAL AI
            </span>
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                color: '#64748b',
                letterSpacing: '0.8px',
                marginLeft: '4px',
              }}
            >
              SPACECRAFT FIRE DYNAMICS
            </span>
          </NavLink>

          {/* Navigation Tabs */}
          <nav style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
            {links.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                style={({ isActive }) => ({
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  color: isActive ? '#f8fafc' : '#8892a8',
                  background: isActive ? '#151d2e' : 'transparent',
                  border: isActive ? '1px solid #2a3654' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                })}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right: Controls & Audience Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Audience Mode Switcher */}
          <div
            style={{
              display: 'flex',
              background: '#111827',
              border: '1px solid #1c2640',
              borderRadius: '4px',
              overflow: 'hidden',
              padding: '2px',
            }}
          >
            {['Student', 'Engineer'].map((aud) => {
              const active = audience === aud;
              return (
                <button
                  key={aud}
                  onClick={() => setAudience(aud)}
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '3px 10px',
                    border: 'none',
                    borderRadius: '3px',
                    background: active ? '#4f8ef7' : 'transparent',
                    color: active ? '#ffffff' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {aud}
                </button>
              );
            })}
          </div>

          {/* Ask Heimdall AI Trigger Button */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              background: chatOpen ? 'rgba(79, 142, 247, 0.2)' : '#111827',
              border: chatOpen ? '1px solid #4f8ef7' : '1px solid #1c2640',
              color: chatOpen ? '#93c5fd' : '#cbd5e1',
              padding: '5px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ color: '#4f8ef7' }}>✦</span>
            <span>ASK HEIMDALL AI</span>
          </button>

          {/* User Profile Avatar */}
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#111827',
              border: '1px solid #1c2640',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8892a8',
              fontSize: '12px',
              cursor: 'pointer',
            }}
            title="NASA Investigator"
          >
            👤
          </div>
        </div>
      </header>

      {/* ── Main Viewport Content ── */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <Outlet />
      </main>

      {/* ── Global Floating Copilot Chat (when triggered via header) ── */}
      <CopilotChat />

      {/* ── Bottom Telemetry Footer Bar ── */}
      <footer
        style={{
          height: '28px',
          background: '#0a0f1e',
          borderTop: '1px solid #1c2640',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          color: '#64748b',
          flexShrink: 0,
        }}
      >
        <span>NASA Space Apps Challenge // Project Heimdall AI</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }} />
            Telemetry Stream Nominal
          </span>
          <span>MET: 042:18:09:22</span>
        </div>
      </footer>
    </div>
  );
}
