import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { TOUR_STEPS } from '../../utils/onboarding-storage.js';
import '../../styles/onboarding-tour.css';

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), Math.max(min, max));
}

function getViewportSize() {
  if (typeof window === 'undefined') return { vw: 375, vh: 812 };
  const vw = document.documentElement?.clientWidth || window.innerWidth;
  const vh = document.documentElement?.clientHeight || window.innerHeight;
  return { vw, vh };
}

function measureSpotlightAndCard(selector, cardHeight = 320) {
  if (typeof window === 'undefined' || !selector) {
    return { spotlight: null, cardStyle: undefined };
  }

  const el = document.querySelector(selector);
  if (!el) {
    return { spotlight: null, cardStyle: undefined };
  }

  const raw = el.getBoundingClientRect();
  if (raw.width < 2 || raw.height < 2) {
    return { spotlight: null, cardStyle: undefined };
  }

  const { vw, vh } = getViewportSize();
  const pad = 6;
  const spotlight = {
    top: Math.max(4, raw.top - pad),
    left: Math.max(4, raw.left - pad),
    width: Math.min(vw - 8, raw.width + pad * 2),
    height: Math.min(vh - 8, raw.height + pad * 2),
  };

  const cardW = Math.min(410, vw - 24);
  const estCardH = Math.min(Math.max(cardHeight, 240), vh - 24);
  const margin = 14;

  // Tall left sidebar on desktop: dock card smoothly to the right of the spotlight
  if (raw.height > vh * 0.55 && raw.right + cardW + 30 < vw) {
    return {
      spotlight,
      cardStyle: {
        top: `${clamp(raw.top + 36, 72, vh - estCardH - margin)}px`,
        left: `${raw.right + 18}px`,
      },
    };
  }

  // Tall full-width panel on narrow screens: dock near bottom so top controls stay visible
  if (spotlight.height > vh * 0.55) {
    return {
      spotlight,
      cardStyle: {
        top: `${clamp(vh - estCardH - margin, 12, vh - estCardH - 12)}px`,
        left: `${Math.round(Math.max(12, (vw - cardW) / 2))}px`,
      },
    };
  }

  const spaceBelow = vh - (spotlight.top + spotlight.height);
  const spaceAbove = spotlight.top;
  const placeBelow = spaceBelow >= estCardH + margin || spaceBelow >= spaceAbove;

  const targetTop = placeBelow
    ? spotlight.top + spotlight.height + margin
    : spotlight.top - estCardH - margin;
  const targetLeft = clamp(
    spotlight.left + spotlight.width / 2 - cardW / 2,
    12,
    vw - cardW - 12
  );

  return {
    spotlight,
    cardStyle: {
      top: `${clamp(targetTop, 12, vh - estCardH - 12)}px`,
      left: `${targetLeft}px`,
    },
  };
}

export default function OnboardingTour() {
  const { tourOpen, tourStep, setTourStep, closeTour } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const cardRef = useRef(null);
  const [layout, setLayout] = useState({
    spotlight: null,
    cardStyle: undefined,
  });

  const step = TOUR_STEPS[tourStep] ?? TOUR_STEPS[0];
  const isFirst = tourStep === 0;
  const isLast = tourStep === TOUR_STEPS.length - 1;

  // Automatically navigate across pages as the user steps through the app tour
  useEffect(() => {
    if (!tourOpen || !step?.route) return;
    if (pathname !== step.route) {
      navigate(step.route);
    }
  }, [tourOpen, step?.route, pathname, navigate]);

  const updateLayout = useCallback(() => {
    if (!tourOpen || (step?.route && pathname !== step.route)) return;
    const measuredHeight = cardRef.current?.getBoundingClientRect().height || 320;
    setLayout(measureSpotlightAndCard(step?.target ?? null, measuredHeight));
  }, [tourOpen, step, pathname]);

  useLayoutEffect(() => {
    if (!tourOpen) return undefined;
    if (step?.route && pathname !== step.route) {
      setLayout({ spotlight: null, cardStyle: undefined });
      return undefined;
    }

    // Bring subpage target bars cleanly into viewport before measuring
    if (step?.target && step.route && step.route !== '/') {
      const targetEl = document.querySelector(step.target);
      targetEl?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }

    updateLayout();
    const t1 = window.setTimeout(updateLayout, 90);
    const t2 = window.setTimeout(updateLayout, 280);
    window.addEventListener('resize', updateLayout);
    window.addEventListener('scroll', updateLayout, true);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', updateLayout);
      window.removeEventListener('scroll', updateLayout, true);
    };
  }, [tourOpen, step, pathname, updateLayout]);

  useEffect(() => {
    if (!tourOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeTour();
      } else if (event.key === 'ArrowRight') {
        if (isLast) closeTour();
        else setTourStep(tourStep + 1);
      } else if (event.key === 'ArrowLeft' && !isFirst) {
        setTourStep(tourStep - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tourOpen, tourStep, isFirst, isLast, setTourStep, closeTour]);

  if (!tourOpen || !step) return null;

  return (
    <div
      className={`onboarding-overlay${layout.spotlight ? '' : ' onboarding-overlay--center'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      {layout.spotlight ? (
        <div
          className="onboarding-spotlight"
          style={{
            top: `${layout.spotlight.top}px`,
            left: `${layout.spotlight.left}px`,
            width: `${layout.spotlight.width}px`,
            height: `${layout.spotlight.height}px`,
          }}
          aria-hidden="true"
        />
      ) : (
        <div className="onboarding-backdrop" aria-hidden="true" />
      )}

      <div ref={cardRef} className="onboarding-card" style={layout.cardStyle}>
        <div className="onboarding-card__top">
          <span className="onboarding-card__badge">{step.badge}</span>
          <button
            type="button"
            className="onboarding-card__skip"
            onClick={closeTour}
          >
            Skip tour
          </button>
        </div>

        <h2 id="onboarding-title" className="onboarding-card__title">
          {step.title}
        </h2>

        <p className="onboarding-card__desc">{step.description}</p>

        {Array.isArray(step.highlights) && step.highlights.length > 0 && (
          <ul className="onboarding-card__list">
            {step.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}

        {(step.changes || step.why) && (
          <div className="onboarding-card__notes">
            {step.changes && (
              <div className="onboarding-card__note">
                <span className="onboarding-card__note-tag">MODIFIES</span>
                <span>{step.changes}</span>
              </div>
            )}
            {step.why && (
              <div className="onboarding-card__note onboarding-card__note--why">
                <span className="onboarding-card__note-tag">WHY</span>
                <span>{step.why}</span>
              </div>
            )}
          </div>
        )}

        <div className="onboarding-card__footer">
          <div className="onboarding-card__dots" role="tablist" aria-label="Tour steps">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={idx === tourStep}
                aria-label={`Step ${idx + 1} of ${TOUR_STEPS.length}: ${s.title}`}
                className={`onboarding-card__dot${idx === tourStep ? ' onboarding-card__dot--active' : ''}`}
                onClick={() => setTourStep(idx)}
              />
            ))}
          </div>

          <div className="onboarding-card__actions">
            {!isFirst && (
              <button
                type="button"
                className="onboarding-card__btn"
                onClick={() => setTourStep(tourStep - 1)}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className="onboarding-card__btn onboarding-card__btn--primary"
              onClick={() => (isLast ? closeTour() : setTourStep(tourStep + 1))}
            >
              {isLast ? 'Start Exploring' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
