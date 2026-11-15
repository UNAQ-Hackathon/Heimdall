import { Outlet, NavLink, Link } from 'react-router-dom';
import { useApp, AUDIENCES } from '../../context/AppContext.jsx';
import HeimdallLogo from '../ui/HeimdallLogo.jsx';
import CopilotChat from '../ui/CopilotChat.jsx';
import nasaLogo from '../../../../docs/assets/nasa-logo.png';
import '../../styles/app-shell.css';

const NAV_ITEMS = [
  { to: '/', label: 'Mission Hub' },
  { to: '/flame', label: 'FireHazR Lab' },
  { to: '/study/saffire-iii', label: 'Study Detail' },
  { to: '/compare', label: 'Compare & Earth' },
];

export default function AppLayout() {
  const { audience, setAudience, chatOpen, setChatOpen } = useApp();

  return (
    <div className="app-shell">
      {/* Clean Minimalist NASA Top Navigation */}
      <header className="app-header">
        {/* Left: NASA Brand + Heimdall Identity */}
        <div className="app-header__identity">
          <Link to="/" className="app-header__brand" aria-label="Heimdall home">
            <HeimdallLogo size={42} />
            <div className="app-header__wordmark">
              <strong>Heimdall</strong>
              <span>Spacecraft fire research</span>
            </div>
          </Link>
          <img className="app-header__nasa" src={nasaLogo} alt="NASA" width={34} height={34} />
        </div>

        {/* Center: Clean Pill Navigation */}
        <nav className="app-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `app-nav__link${isActive ? ' app-nav__link--active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right: Mode Selector + AI Copilot Button */}
        <div className="app-header__actions">
          <label className="app-header__audience">
            <span>View</span>
            <select value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Audience mode">
              {AUDIENCES.map((aud) => <option key={aud} value={aud}>{aud} mode</option>)}
            </select>
          </label>
          <button type="button" className="app-header__copilot" aria-label="Toggle Heimdall AI assistant" aria-pressed={chatOpen} onClick={() => setChatOpen(!chatOpen)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z" />
              <path d="M8 9h8M8 13h5" />
            </svg>
            <span>Heimdall AI</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-shell__main">
        <Outlet />
        <CopilotChat />
      </main>

      {/* Minimalist NASA Footer Bar */}
      <footer className="app-footer">
        <span>NASA PSI Archive</span>
        <span>Microgravity combustion research</span>
      </footer>
    </div>
  );
}
