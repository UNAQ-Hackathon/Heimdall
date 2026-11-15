import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { soundEngine } from '../audio/sound-engine.js';

const SoundContext = createContext(null);

/**
 * Global immersive-audio provider:
 * - Unlocks the Web Audio engine on the first user gesture (browser policy).
 * - Starts a subtle deep-space ambience drone once audio is live.
 * - Adds a quiet synthesized tick to every button / link / select click.
 * - `M` toggles mute anywhere (persisted to localStorage).
 */
export function SoundProvider({ children }) {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    soundEngine.init();
    setMuted(soundEngine.muted);

    const offReady = soundEngine.onReady(() => {
      soundEngine.startLoop('ambience', 0.8);
    });

    const handleClick = (event) => {
      const interactive = event.target?.closest?.(
        'button, a[href], [role="button"], summary, select'
      );
      if (interactive && !interactive.disabled) {
        soundEngine.play('ui-tick');
      }
    };

    const handleKey = (event) => {
      if (event.key?.toLowerCase() !== 'm') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.target?.isContentEditable) return;
      soundEngine.toggleMuted();
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKey);
      offReady();
      soundEngine.stopAllLoops();
    };
  }, []);

  useEffect(
    () => soundEngine.subscribe(() => setMuted(soundEngine.muted)),
    []
  );

  const toggleMuted = useCallback(() => soundEngine.toggleMuted(), []);

  // API methods are stable references — only `muted` changes on toggle, so
  // consumers can safely use them in mount-only cleanup effects.
  const sfx = useMemo(
    () => ({
      play: (name) => soundEngine.play(name),
      startLoop: (name, level) => soundEngine.startLoop(name, level),
      setLoopLevel: (name, level) => soundEngine.setLoopLevel(name, level),
      stopLoop: (name) => soundEngine.stopLoop(name),
      toggleMuted,
    }),
    [toggleMuted]
  );

  const value = useMemo(() => ({ ...sfx, muted }), [sfx, muted]);

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export const useSound = () => useContext(SoundContext);
