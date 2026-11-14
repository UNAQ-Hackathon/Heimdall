import { NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import CopilotChat from '../ui/CopilotChat.jsx';
import HeimdallLogo from '../ui/HeimdallLogo.jsx';
import nasaLogo from '../../../../docs/assets/nasa-logo.png';

const links = [
  { to: '/', label: 'Mission Hub', end: true },
  { to: '/study/saffire-iii', label: 'Study Detail' },
  { to: '/flame-3d', label: 'Flame 3D' },
  { to: '/compare', label: 'Compare & Earth' },
];

export default function AppLayout() {
  const { audience, setAudience, chatOpen, setChatOpen } = useApp();

  return (
    <div
      className="app-shell lowpoly-surface"
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: '#060a12',
      }}
    >
      {/* ── Top Minimalist NASA Faceted Header Bar ── */}
      <header
        className="lowpoly-surface"
        style={{
          height: '54px',
          backgroundColor: 'rgba(8, 12, 22, 0.96)',
          borderBottom: '1px solid #18263e',
          boxShadow: 'inset 0 2px 0 0 #0b3d91',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
          zIndex: 100,
        }}
      >
        {/* Left: NASA Insignia + Heimdall Logo + Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <NavLink
            to="/"
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <img
              src={nasaLogo}
              alt="NASA"
              style={{ width: '28px', height: '28px', objectFit: 'contain' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HeimdallLogo size={38} />
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 800,
                  color: '#f8fafc',
                  letterSpacing: '1.8px',
                }}
              >
                HEIMDALL
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: '#94a3b8',
                  letterSpacing: '0.6px',
                  borderLeft: '2px solid #fc3d21',
                  paddingLeft: '8px',
                }}
              >
                NASA PSI · FIRE SAFETY
              </span>
            </div>
          </NavLink>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', gap: '6px' }}>
            {links.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className="tri-pill"
                style={({ isActive }) => ({
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 500,
                  padding: '6px 13px',
                  textDecoration: 'none',
                  color: isActive ? '#f8fafc' : '#94a3b8',
                  background: isActive ? 'rgba(11, 61, 145, 0.42)' : 'transparent',
                  border: isActive ? '1px solid rgba(79, 142, 247, 0.45)' : '1px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                })}
              >
                {({ isActive }) => (
                  <>
                    <span
                      style={{
                        fontSize: '8px',
                        color: isActive ? '#fc3d21' : '#475569',
                      }}
                    >
                      ▲
                    </span>
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right: Minimalist Audience Dropdown & Copilot Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: '#94a3b8',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#64748b' }}>
              MODE:
            </span>
            <select
              className="tri-select"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              style={{
                border: '1px solid #1e293b',
                color: '#e2e8f0',
                fontSize: '11.5px',
                fontWeight: 500,
                padding: '5px 10px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="Engineer">Engineer Mode</option>
              <option value="Student">Student Mode</option>
            </select>
          </label>

          <button
            className="tri-pill"
            onClick={() => setChatOpen(!chatOpen)}
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              background: chatOpen ? '#0b3d91' : '#0b1324',
              border: chatOpen ? '1px solid #4f8ef7' : '1px solid #1e293b',
              color: '#f8fafc',
              padding: '6px 13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ color: '#fc3d21', fontSize: '10px' }}>▲</span>
            <span>AI Copilot</span>
          </button>
        </div>
      </header>

      {/* ── Main Viewport Content ── */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <Outlet />
      </main>

      {/* ── Global Floating Copilot Chat ── */}
      <CopilotChat />

      {/* ── Minimalist NASA Telemetry Footer Bar ── */}
      <footer
        className="lowpoly-surface"
        style={{
          height: '26px',
          backgroundColor: '#080c16',
          borderTop: '1px solid #162032',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          color: '#64748b',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#fc3d21', fontSize: '8px' }}>▲</span>
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>NASA PSI ARCHIVE</span>
          <span>·</span>
          <span>Glenn Research Center // Microgravity Combustion Science</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8' }}>
            <span style={{ color: '#34d399', fontSize: '8px' }}>▲</span>
            Keplerian Orbits · Telemetry Nominal
          </span>
        </div>
      </footer>
    </div>
  );
}
