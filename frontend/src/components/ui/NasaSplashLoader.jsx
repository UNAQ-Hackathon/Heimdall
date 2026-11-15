import { useEffect, useState } from 'react';
import nasaLogo from '../../../../docs/assets/nasa-logo.png';
import '../../styles/nasa-splash.css';

export default function NasaSplashLoader() {
  const [exiting, setExiting] = useState(false);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const holdMs = reduced ? 250 : 1250;
    const fadeMs = reduced ? 50 : 480;

    const fadeTimer = window.setTimeout(() => setExiting(true), holdMs);
    const doneTimer = window.setTimeout(() => setMounted(false), holdMs + fadeMs);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={`nasa-splash ${exiting ? 'nasa-splash--exiting' : ''}`}
      role="status"
      aria-label="Loading Heimdall NASA PSI Dashboard"
    >
      <div className="nasa-splash__grid" aria-hidden="true" />
      <div className="nasa-splash__corners" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="nasa-splash__content">
        <div className="nasa-splash__emblem">
          <div className="nasa-splash__halo" aria-hidden="true" />

          <svg className="nasa-splash__dial" viewBox="0 0 140 140" aria-hidden="true">
            <circle
              cx="70"
              cy="70"
              r="65"
              fill="none"
              stroke="rgba(148, 163, 184, 0.16)"
              strokeWidth="1"
              strokeDasharray="1 11.78"
            />
          </svg>

          <svg className="nasa-splash__ring" viewBox="0 0 140 140" aria-hidden="true">
            <defs>
              <linearGradient id="nasa-orbit-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
                <stop offset="65%" stopColor="#60a5fa" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#fc3d21" stopOpacity="0.95" />
              </linearGradient>
            </defs>
            <circle
              cx="70"
              cy="70"
              r="55"
              fill="none"
              stroke="rgba(148, 163, 184, 0.1)"
              strokeWidth="1"
            />
            <circle
              cx="70"
              cy="70"
              r="55"
              fill="none"
              stroke="url(#nasa-orbit-grad)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeDasharray="96 250"
            />
          </svg>

          <svg className="nasa-splash__ring-inner" viewBox="0 0 140 140" aria-hidden="true">
            <circle
              cx="70"
              cy="70"
              r="46"
              fill="none"
              stroke="rgba(56, 189, 248, 0.22)"
              strokeWidth="0.9"
              strokeDasharray="18 24 6 24"
            />
          </svg>

          <img className="nasa-splash__logo" src={nasaLogo} alt="NASA" width={78} height={78} />
        </div>

        <div className="nasa-splash__meta">
          <span className="nasa-splash__kicker">NASA PHYSICAL SCIENCES INFORMATICS</span>
          <h1 className="nasa-splash__wordmark">HEIMDALL</h1>
          <div className="nasa-splash__bar" aria-hidden="true">
            <div className="nasa-splash__fill" />
          </div>
          <p className="nasa-splash__subtitle">Spacecraft Fire Safety · 3D &amp; KNN FLEX v3</p>
        </div>
      </div>
    </div>
  );
}
