import { useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { useSound } from '../../context/SoundContext.jsx';
import { readOnboardingDone, shouldAutoStartOnboarding } from '../../utils/onboarding-storage.js';
import HeimdallLogo from '../ui/HeimdallLogo.jsx';
import CopilotChat from '../ui/CopilotChat.jsx';
import OnboardingTour from '../ui/OnboardingTour.jsx';
import nasaLogo from '../../../../docs/assets/nasa-logo.png';
import '../../styles/app-shell.css';

const NAV_ITEMS = [
  { to: '/', label: 'Mission Hub', hint: '3D solar system & FireHazR burn lab', matchPaths: ['/'] },
  { to: '/studies', label: 'PSI Catalog', hint: 'Browse 23 verified NASA PSI studies', matchPaths: ['/studies', '/investigations', '/study', '/telemetry'] },
  { to: '/flame', label: 'FireHazR Lab', hint: 'Microgravity droplet burn duration predictor', matchPaths: ['/flame', '/firehazr', '/flame-3d'] },
  { to: '/compare', label: 'Parametric Comparison', hint: 'Cross-study O₂ / pressure regime analysis', matchPaths: ['/compare'] },
];

function isNavItemActive(pathname, { to, matchPaths }) {
  if (to === '/') return pathname === '/';
  return matchPaths.some((prefix) =>
    prefix.endsWith('/') ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default function AppLayout() {
  const { chatOpen, setChatOpen, audience, setAudience, tourOpen, startTour } = useApp();
  const { muted, toggleMuted } = useSound();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!shouldAutoStartOnboarding({ pathname, search, alreadyDone: readOnboardingDone() })) {
      return undefined;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const delayMs = reduced ? 350 : 1850;
    const timer = window.setTimeout(() => {
      startTour();
    }, delayMs);
    return () => window.clearTimeout(timer);
    // Run once on initial entry only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-shell" data-audience={audience === 'Student' ? 'student' : 'engineer'}>
      {/* Minimalist Top Navigation */}
      <header className="app-header">
        {/* Left: Heimdall Identity */}
        <div className="app-header__identity">
          <Link to="/" className="app-header__brand" aria-label="Heimdall home">
            <HeimdallLogo size={40} />
            <div className="app-header__wordmark">
              <strong>Heimdall</strong>
            </div>
          </Link>
        </div>

        {/* Center: Pill Navigation */}
        <nav className="app-nav" aria-label="Main navigation" data-tour="main-nav">
          {NAV_ITEMS.map((item) => {
            const active = isNavItemActive(pathname, item);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                title={item.hint}
                className={`app-nav__link${active ? ' app-nav__link--active' : ''}`}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Right: Audience Mode Switcher + Tour + Sound + AI Copilot + NASA Seal */}
        <div className="app-header__actions">
          <div className="app-header__audience" role="group" aria-label="Audience mode" data-tour="audience-mode">
            {['Engineer', 'Student'].map((mode) => (
              <button
                key={mode}
                type="button"
                className="app-header__audience-btn"
                title={mode === 'Engineer' ? 'Technical metrics & PSI rankings' : 'Guided space-fire explanations'}
                aria-pressed={audience === mode}
                onClick={() => setAudience(mode)}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="app-header__tool-group" data-tour="header-tools">
            <button
              type="button"
              className="app-header__help"
              aria-label="Guided tour"
              title="Start guided tour"
              aria-pressed={tourOpen}
              onClick={() => {
                if (pathname !== '/') navigate('/');
                startTour();
              }}
            >
              ?
            </button>

            <button
              type="button"
              className="app-header__sound"
              aria-label={muted ? 'Unmute sound (M)' : 'Mute sound (M)'}
              title={muted ? 'Unmute sound (M)' : 'Mute sound (M)'}
              aria-pressed={!muted}
              onClick={toggleMuted}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
                {muted ? (
                  <>
                    <line x1="16" y1="9" x2="21" y2="14" />
                    <line x1="21" y1="9" x2="16" y2="14" />
                  </>
                ) : (
                  <>
                    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                  </>
                )}
              </svg>
            </button>

            <button type="button" className="app-header__copilot" aria-label="Toggle Gemini AI assistant" aria-pressed={chatOpen} onClick={() => setChatOpen(!chatOpen)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z" />
                <path d="M8 9h8M8 13h5" />
              </svg>
              <span>Gemini AI</span>
            </button>
          </div>

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
        <OnboardingTour />
      </main>

      {/* Minimalist NASA Footer Bar */}
      <footer className="app-footer">
        <span>NASA PSI Archive</span>
        <span>Microgravity combustion research</span>
      </footer>
    </div>
  );
}
