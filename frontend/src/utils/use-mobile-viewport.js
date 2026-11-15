import { useEffect, useState } from 'react';

export const MOBILE_VIEWPORT_QUERY = '(max-width: 900px)';

export function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
  }
  return window.innerWidth <= 900;
}

export function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(isMobileViewport);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mql = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const handleChange = (event) => setIsMobile(event.matches);
    setIsMobile(mql.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
    mql.addListener(handleChange);
    return () => mql.removeListener(handleChange);
  }, []);

  return isMobile;
}
