import { Outlet, NavLink } from 'react-router-dom';
import { useApp, AUDIENCES } from '../../context/AppContext.jsx';
import HeimdallLogo from '../ui/HeimdallLogo.jsx';
import CopilotChat from '../ui/CopilotChat.jsx';
import nasaLogo from '../../../../docs/assets/nasa-logo.png';

const NAV_ITEMS = [
  { to: '/', label: 'Mission Hub' },
  { to: '/flame', label: 'Fire Hazard Lab' },
  { to: '/study/saffire-iii', label: 'Study Detail' },
  { to: '/compare', label: 'Compare & Earth' },
];

export default function AppLayout() {
  const { audience, setAudience, chatOpen, setChatOpen } = useApp();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--bg-void)',
      }}
    >
      {/* Clean Minimalist NASA Top Navigation */}
      <header
        style={{
          height: '56px',
          minHeight: '56px',
          background: 'rgba(10, 15, 29, 0.94)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          zIndex: 50,
        }}
      >
        {/* Left: NASA Brand + Heimdall Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={nasaLogo}
            alt="NASA"
            style={{ width: 28, height: 28, objectFit: 'contain' }}
          />
          <HeimdallLogo size={24} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: '14px',
                letterSpacing: '0.1em',
                color: '#f8fafc',
              }}
            >
              HEIMDALL
            </span>
            <span
              style={{
                height: '14px',
                width: '1px',
                background: 'rgba(148, 163, 184, 0.24)',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.08em',
                color: '#94a3b8',
                padding: '2px 7px',
                borderRadius: '4px',
                background: 'rgba(11, 61, 145, 0.25)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
              }}
            >
              NASA PSI · FIRE SAFETY
            </span>
          </div>
        </div>

        {/* Center: Clean Pill Navigation */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                padding: '6px 14px',
                borderRadius: '7px',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#f8fafc' : '#94a3b8',
                background: isActive ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                border: isActive
                  ? '1px solid rgba(59, 130, 246, 0.35)'
                  : '1px solid transparent',
                transition: 'all 0.15s ease',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right: Mode Selector + AI Copilot Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: '#64748b',
                letterSpacing: '0.06em',
              }}
            >
              VIEW
            </span>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="tri-select"
              aria-label="Audience mode"
              style={{ padding: '5px 28px 5px 10px', fontSize: '12px' }}
            >
              {AUDIENCES.map((aud) => (
                <option key={aud} value={aud} style={{ background: '#0f172a' }}>
                  {aud} Mode
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setChatOpen(!chatOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 13px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              background: chatOpen
                ? 'rgba(59, 130, 246, 0.22)'
                : 'rgba(15, 23, 42, 0.85)',
              color: chatOpen ? '#60a5fa' : '#e2e8f0',
              border: chatOpen
                ? '1px solid rgba(59, 130, 246, 0.5)'
                : '1px solid var(--border-subtle)',
              transition: 'all 0.15s ease',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: chatOpen ? '#38bdf8' : '#fc3d21',
              }}
            />
            Heimdall AI
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        <Outlet />
        <CopilotChat />
      </main>

      {/* Minimalist NASA Footer Bar */}
      <footer
        style={{
          height: '28px',
          minHeight: '28px',
          background: 'rgba(10, 15, 29, 0.95)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: '#64748b',
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>NASA PSI ARCHIVE</span>
          <span>·</span>
          <span>Glenn Research Center · Microgravity Combustion Science</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#10b981',
            }}
          />
          <span style={{ color: '#94a3b8' }}>PSI Telemetry Nominal</span>
        </div>
      </footer>
    </div>
  );
}
