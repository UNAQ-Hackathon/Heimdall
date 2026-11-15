import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import HeimdallLogo from '../ui/HeimdallLogo.jsx';
import CopilotChat from '../ui/CopilotChat.jsx';
import nasaLogo from '../../../../docs/assets/nasa-logo.png';
import '../../styles/app-shell.css';

const NAV_ITEMS = [
  { to: '/', label: 'Mission Hub', matchPaths: ['/'] },
  { to: '/studies', label: 'PSI Catalog', matchPaths: ['/studies', '/investigations', '/study/'] },
  { to: '/flame', label: 'FireHazR Lab', matchPaths: ['/flame', '/firehazr'] },
  { to: '/flame-3d', label: 'Flame 3D', matchPaths: ['/flame-3d'] },
  { to: '/compare', label: 'Compare & Earth', matchPaths: ['/compare'] },
];

function isNavItemActive(pathname, { to, matchPaths }) {
  if (to === '/') return pathname === '/';
  return matchPaths.some((prefix) =>
    prefix.endsWith('/') ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default function AppLayout() {
  const { chatOpen, setChatOpen } = useApp();
  const { pathname } = useLocation();

  return (
    <div className="app-shell">
      {/* Minimalist Top Navigation */}
      <header className="app-header">
        {/* Left: Heimdall Identity */}
        <div className="app-header__identity">
          <Link to="/" className="app-header__brand" aria-label="Heimdall home">
            <HeimdallLogo size={40} />
            <div className="app-header__wordmark">
              <strong>Heimdall</strong>
              <span>Spacecraft fire research</span>
            </div>
          </Link>
        </div>

        {/* Center: Pill Navigation */}
        <nav className="app-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const active = isNavItemActive(pathname, item);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={`app-nav__link${active ? ' app-nav__link--active' : ''}`}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Right: AI Copilot + NASA Seal */}
        <div className="app-header__actions">
          <button type="button" className="app-header__copilot" aria-label="Toggle Gemini AI assistant" aria-pressed={chatOpen} onClick={() => setChatOpen(!chatOpen)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z" />
              <path d="M8 9h8M8 13h5" />
            </svg>
            <span>Gemini AI</span>
          </button>

          <span className="app-header__divider" aria-hidden="true" />

          <img
            className="app-header__nasa"
            src={nasaLogo}
            alt="NASA"
            title="NASA Physical Sciences Informatics (PSI)"
            width={48}
            height={48}
          />
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
