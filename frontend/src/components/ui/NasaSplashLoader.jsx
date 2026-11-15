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
      <div className="nasa-splash__content">
        <img className="nasa-splash__logo" src={nasaLogo} alt="NASA" width={88} height={88} />
        <div className="nasa-splash__bar" aria-hidden="true">
          <div className="nasa-splash__fill" />
        </div>
      </div>
    </div>
  );
}
