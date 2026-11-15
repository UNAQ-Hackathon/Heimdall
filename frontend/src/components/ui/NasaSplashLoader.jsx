import { useEffect, useState } from 'react';
import nasaLogo from '../../../../docs/assets/nasa-logo.png';
import '../../styles/nasa-splash.css';

export default function NasaSplashLoader() {
  const [exiting, setExiting] = useState(false);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const holdMs = reduced ? 250 : 1250;
    const fadeMs = reduced ? 50 : 450;

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
      <div className="nasa-splash__emblem">
        <svg className="nasa-splash__ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="rgba(148, 163, 184, 0.14)"
            strokeWidth="1.25"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="#60a5fa"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeDasharray="72 220"
          />
        </svg>
        <img className="nasa-splash__logo" src={nasaLogo} alt="NASA" width={68} height={68} />
      </div>

      <div className="nasa-splash__meta">
        <p className="nasa-splash__title">HEIMDALL · NASA PSI</p>
        <div className="nasa-splash__bar" aria-hidden="true">
          <div className="nasa-splash__fill" />
        </div>
      </div>
    </div>
  );
}
