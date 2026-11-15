/**
 * Heimdall procedural sound engine — zero audio assets, everything is synthesized
 * live with the Web Audio API (oscillators + filtered noise).
 *
 * - Lazily creates a single AudioContext; browsers keep it suspended until the
 *   first user gesture, so `init()` wires one-time pointer/key listeners that
 *   resume it. Any play() call made while still suspended is skipped silently.
 * - `play(name)` fires short one-shot effects; `startLoop(name)` keeps named
 *   ambient loops (engine hum, fire crackle, space drone) whose intensity can
 *   be steered with `setLoopLevel(name, 0..1)`.
 * - Safe outside the browser (tests / SSR): every public method no-ops when
 *   `window` or `AudioContext` is unavailable.
 */

const MUTE_STORAGE_KEY = 'heimdall.sound.muted';
const MASTER_GAIN = 0.85;

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;
let listenersAttached = false;
const loops = new Map();
const subscribers = new Set();
const readyCallbacks = new Set();

function hasAudio() {
  return (
    typeof window !== 'undefined' &&
    typeof (window.AudioContext ?? window.webkitAudioContext) === 'function'
  );
}

function readMuted() {
  try {
    return window.localStorage?.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMuted(value) {
  try {
    window.localStorage?.setItem(MUTE_STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* storage unavailable — mute stays session-only */
  }
}

function notify() {
  subscribers.forEach((cb) => {
    try {
      cb();
    } catch {
      /* listener errors must never break audio */
    }
  });
}

function ensureContext() {
  if (!hasAudio()) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_GAIN;
    master.connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  if (ctx.state === 'suspended') {
    ctx
      .resume()
      .then(() => {
        if (ctx.state === 'running') {
          readyCallbacks.forEach((cb) => {
            try {
              cb();
            } catch {
              /* listener errors must never break audio */
            }
          });
        }
      })
      .catch(() => {});
  }
  return ctx;
}

/* ── primitive builders ─────────────────────────────────────────────── */

function tone({ freq = 440, freqEnd, dur = 0.15, type = 'sine', gain = 0.08, attack = 0.006, filterFreq, delay = 0 }) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freq), t0);
  if (freqEnd) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  if (filterFreq) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    g.connect(f);
    f.connect(master);
  } else {
    g.connect(master);
  }
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.3, gain = 0.08, attack = 0.01, type = 'bandpass', freq = 900, freqEnd, q = 1, delay = 0, rate = 1 }) {
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  src.playbackRate.value = rate;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(Math.max(20, freq), t0);
  f.Q.value = q;
  if (freqEnd) {
    f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t0, Math.random() * 1.2);
  src.stop(t0 + dur + 0.05);
}

/* ── one-shot recipes ───────────────────────────────────────────────── */

const RECIPES = {
  'ui-tick': () => {
    tone({ freq: 1250, freqEnd: 880, dur: 0.055, gain: 0.045 });
  },
  'ui-deny': () => {
    tone({ freq: 210, freqEnd: 150, dur: 0.22, type: 'triangle', gain: 0.06, filterFreq: 900 });
  },
  'panel-whoosh': () => {
    noise({ dur: 0.34, gain: 0.07, freq: 500, freqEnd: 1800, q: 0.9, attack: 0.06 });
  },
  'panel-close': () => {
    noise({ dur: 0.3, gain: 0.06, freq: 1700, freqEnd: 420, q: 0.9, attack: 0.04 });
  },
  'ship-select': () => {
    tone({ freq: 62, freqEnd: 128, dur: 0.3, type: 'sawtooth', gain: 0.05, filterFreq: 640, attack: 0.05 });
    noise({ dur: 0.24, gain: 0.05, type: 'lowpass', freq: 500, freqEnd: 1400, attack: 0.05 });
  },
  'ship-launch': () => {
    noise({ dur: 0.95, gain: 0.16, type: 'lowpass', freq: 320, freqEnd: 2900, attack: 0.22 });
    tone({ freq: 88, freqEnd: 215, dur: 0.9, type: 'sawtooth', gain: 0.045, filterFreq: 950, attack: 0.14 });
    tone({ freq: 132, freqEnd: 322, dur: 0.9, type: 'sawtooth', gain: 0.028, filterFreq: 1100, attack: 0.18 });
  },
  'ship-arrive': () => {
    noise({ dur: 1.05, gain: 0.13, type: 'lowpass', freq: 2400, freqEnd: 260, attack: 0.06 });
    tone({ freq: 175, freqEnd: 58, dur: 0.85, type: 'sawtooth', gain: 0.045, filterFreq: 820 });
    tone({ freq: 118, freqEnd: 46, dur: 0.42, gain: 0.2, delay: 0.6 });
  },
  dock: () => {
    tone({ freq: 320, freqEnd: 135, dur: 0.2, type: 'triangle', gain: 0.16 });
    noise({ dur: 0.12, gain: 0.1, freq: 2500, q: 2.2 });
    tone({ freq: 95, freqEnd: 44, dur: 0.34, gain: 0.2, delay: 0.03 });
    tone({ freq: 1950, freqEnd: 1500, dur: 0.045, type: 'square', gain: 0.045, delay: 0.2 });
    tone({ freq: 1950, freqEnd: 1500, dur: 0.045, type: 'square', gain: 0.04, delay: 0.34 });
  },
  'retro-burn': () => {
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.85;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(420, t0);
    f.frequency.exponentialRampToValueAtTime(1500, t0 + 1.4);
    f.frequency.exponentialRampToValueAtTime(240, t0 + 2.85);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.2, t0 + 0.35);
    g.gain.setValueAtTime(0.2, t0 + 2.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.85);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0, Math.random());
    src.stop(t0 + 3);
    tone({ freq: 74, freqEnd: 40, dur: 2.8, type: 'sawtooth', gain: 0.05, filterFreq: 300, attack: 0.3 });
  },
  touchdown: () => {
    tone({ freq: 72, freqEnd: 36, dur: 0.5, gain: 0.32 });
    noise({ dur: 0.42, gain: 0.13, type: 'lowpass', freq: 420, attack: 0.02, rate: 0.8 });
    noise({ dur: 0.7, gain: 0.06, type: 'bandpass', freq: 750, q: 0.7, attack: 0.12, delay: 0.1 });
  },
  'suit-servo': () => {
    tone({ freq: 340, freqEnd: 500, dur: 0.28, type: 'square', gain: 0.02, filterFreq: 1600 });
    noise({ dur: 0.22, gain: 0.025, freq: 1200, q: 1.4, attack: 0.04 });
  },
  'airlock-pressurize': () => {
    noise({ dur: 1.1, gain: 0.055, type: 'highpass', freq: 500, freqEnd: 2300, attack: 0.3 });
    tone({ freq: 540, dur: 0.09, gain: 0.04, delay: 0.15 });
    tone({ freq: 540, dur: 0.09, gain: 0.04, delay: 0.4 });
  },
  'airlock-door': () => {
    noise({ dur: 0.72, gain: 0.075, freq: 480, freqEnd: 1250, q: 1.1, attack: 0.1 });
    tone({ freq: 88, freqEnd: 142, dur: 0.68, type: 'square', gain: 0.022, filterFreq: 520, attack: 0.08 });
    tone({ freq: 1600, freqEnd: 1200, dur: 0.05, type: 'square', gain: 0.04, delay: 0.66 });
  },
  'airlock-seal': () => {
    tone({ freq: 112, freqEnd: 44, dur: 0.4, gain: 0.28 });
    noise({ dur: 0.09, gain: 0.09, freq: 2100, q: 1.6 });
    noise({ dur: 0.5, gain: 0.045, type: 'highpass', freq: 1800, attack: 0.05, delay: 0.1 });
  },
  'fire-ignition': () => {
    noise({ dur: 0.4, gain: 0.16, type: 'lowpass', freq: 380, freqEnd: 2600, attack: 0.05 });
    tone({ freq: 170, freqEnd: 58, dur: 0.18, gain: 0.14 });
  },
  flashover: () => {
    noise({ dur: 0.75, gain: 0.26, type: 'lowpass', freq: 240, freqEnd: 1900, attack: 0.06 });
    tone({ freq: 92, freqEnd: 34, dur: 0.65, gain: 0.24 });
    noise({ dur: 0.5, gain: 0.08, freq: 3000, q: 0.8, delay: 0.12 });
  },
  alarm: () => {
    for (let i = 0; i < 3; i += 1) {
      const at = i * 0.36;
      tone({ freq: 880, dur: 0.09, type: 'square', gain: 0.035, filterFreq: 2400, delay: at });
      tone({ freq: 660, dur: 0.1, type: 'square', gain: 0.035, filterFreq: 2400, delay: at + 0.11 });
    }
  },
  'predict-start': () => {
    tone({ freq: 980, dur: 0.06, gain: 0.05 });
    tone({ freq: 1320, dur: 0.07, gain: 0.05, delay: 0.09 });
  },
  'predict-success': () => {
    tone({ freq: 660, dur: 0.1, gain: 0.055 });
    tone({ freq: 880, dur: 0.11, gain: 0.055, delay: 0.09 });
    tone({ freq: 1320, dur: 0.18, gain: 0.05, delay: 0.18 });
  },
  'predict-abstain': () => {
    tone({ freq: 330, freqEnd: 245, dur: 0.4, type: 'triangle', gain: 0.055, filterFreq: 1200 });
  },
  'predict-error': () => {
    tone({ freq: 250, freqEnd: 140, dur: 0.45, type: 'sawtooth', gain: 0.05, filterFreq: 800 });
  },
  'chat-send': () => {
    tone({ freq: 1150, freqEnd: 1520, dur: 0.07, gain: 0.045 });
  },
  'chat-receive': () => {
    tone({ freq: 1520, freqEnd: 1140, dur: 0.08, gain: 0.045 });
    tone({ freq: 1900, dur: 0.06, gain: 0.03, delay: 0.09 });
  },
};

/* ── ambient loops ──────────────────────────────────────────────────── */

function buildEngineLoop() {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 620;
  filter.Q.value = 0.6;

  const o1 = ctx.createOscillator();
  o1.type = 'sawtooth';
  const o2 = ctx.createOscillator();
  o2.type = 'sawtooth';
  o2.detune.value = 9;
  const sub = ctx.createOscillator();
  sub.type = 'sine';

  const og = ctx.createGain();
  og.gain.value = 0.5;
  const sg = ctx.createGain();
  sg.gain.value = 0.85;
  o1.connect(og);
  o2.connect(og);
  sub.connect(sg);
  og.connect(filter);
  sg.connect(filter);

  const n = ctx.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  n.playbackRate.value = 0.7;
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 360;
  const ng = ctx.createGain();
  ng.gain.value = 0.55;
  n.connect(nf);
  nf.connect(ng);
  ng.connect(filter);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 11.5;
  const lg = ctx.createGain();
  lg.gain.value = 0.035;
  lfo.connect(lg);
  lg.connect(gain.gain);

  filter.connect(gain);
  gain.connect(master);
  o1.start();
  o2.start();
  sub.start();
  n.start();
  lfo.start();

  return {
    setLevel(l) {
      const t = ctx.currentTime;
      const clamped = Math.min(1, Math.max(0, l));
      gain.gain.setTargetAtTime(0.025 + clamped * 0.15, t, 0.12);
      const f = 44 + clamped * 30;
      o1.frequency.setTargetAtTime(f, t, 0.15);
      o2.frequency.setTargetAtTime(f * 1.5, t, 0.15);
      sub.frequency.setTargetAtTime(f * 0.5, t, 0.2);
      filter.frequency.setTargetAtTime(460 + clamped * 950, t, 0.15);
    },
    stop() {
      const t = ctx.currentTime;
      gain.gain.setTargetAtTime(0, t, 0.18);
      window.setTimeout(() => {
        [o1, o2, sub, n, lfo].forEach((node) => {
          try {
            node.stop();
          } catch {
            /* already stopped */
          }
        });
        gain.disconnect();
      }, 700);
    },
  };
}

/**
 * Chemical rocket propulsion: a wide, roaring combustion bed (filtered noise
 * with thrust "flutter") over a heavy sub-bass rumble, plus sporadic exhaust
 * crackle. Used by the nave* spaceships.
 */
function buildRocketLoop() {
  const gain = ctx.createGain();
  gain.gain.value = 0;

  // Roaring combustion noise.
  const n = ctx.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  n.playbackRate.value = 1;
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 750;
  nf.Q.value = 0.35;
  const ng = ctx.createGain();
  ng.gain.value = 0.75;
  const flutter = ctx.createOscillator();
  flutter.frequency.value = 9.2;
  const flutterG = ctx.createGain();
  flutterG.gain.value = 0.2;
  flutter.connect(flutterG);
  flutterG.connect(ng.gain);
  n.connect(nf);
  nf.connect(ng);
  ng.connect(gain);

  // Sub-bass rumble + rough growl.
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = 33;
  const sg = ctx.createGain();
  sg.gain.value = 0.5;
  sub.connect(sg);
  sg.connect(gain);
  const growl = ctx.createOscillator();
  growl.type = 'sawtooth';
  growl.frequency.value = 52;
  const gf = ctx.createBiquadFilter();
  gf.type = 'lowpass';
  gf.frequency.value = 150;
  const gg = ctx.createGain();
  gg.gain.value = 0.45;
  growl.connect(gf);
  gf.connect(gg);
  gg.connect(gain);

  gain.connect(master);
  n.start();
  flutter.start();
  sub.start();
  growl.start();

  // Sporadic combustion crackle, like exhaust popping.
  let alive = true;
  let level = 0.5;
  let timer = null;
  const pop = () => {
    if (!alive) return;
    const t0 = ctx.currentTime + 0.01;
    const p = ctx.createBufferSource();
    p.buffer = noiseBuf;
    p.playbackRate.value = 0.4 + Math.random() * 0.7;
    const pf = ctx.createBiquadFilter();
    pf.type = 'bandpass';
    pf.frequency.value = 240 + Math.random() * 700;
    pf.Q.value = 1.6;
    const pg = ctx.createGain();
    const dur = 0.03 + Math.random() * 0.07;
    pg.gain.setValueAtTime((0.01 + Math.random() * 0.05) * (0.4 + level), t0);
    pg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    p.connect(pf);
    pf.connect(pg);
    pg.connect(master);
    p.start(t0, Math.random() * 1.5);
    p.stop(t0 + dur + 0.02);
    timer = window.setTimeout(pop, 90 + Math.random() * 420);
  };
  pop();

  return {
    setLevel(l) {
      const t = ctx.currentTime;
      const clamped = Math.min(1, Math.max(0, l));
      level = clamped;
      gain.gain.setTargetAtTime(0.03 + clamped * 0.16, t, 0.12);
      nf.frequency.setTargetAtTime(420 + clamped * 1050, t, 0.15);
      growl.frequency.setTargetAtTime(40 + clamped * 48, t, 0.18);
      sub.frequency.setTargetAtTime(26 + clamped * 14, t, 0.2);
    },
    stop() {
      alive = false;
      if (timer) window.clearTimeout(timer);
      const t = ctx.currentTime;
      gain.gain.setTargetAtTime(0, t, 0.18);
      window.setTimeout(() => {
        [n, flutter, sub, growl].forEach((node) => {
          try {
            node.stop();
          } catch {
            /* already stopped */
          }
        });
        gain.disconnect();
      }, 700);
    },
  };
}

/**
 * Millennium-Falcon-style freighter: an uneven, growling engine (detuned
 * saws with ~5 Hz amplitude grumble), a slowly wandering mid-band roar, and a
 * high howl that only appears as thrust climbs — the freighter "wheeze".
 */
function buildFalconLoop() {
  const gain = ctx.createGain();
  gain.gain.value = 0;

  // Growling twin engine.
  const o1 = ctx.createOscillator();
  o1.type = 'sawtooth';
  o1.frequency.value = 55;
  const o2 = ctx.createOscillator();
  o2.type = 'sawtooth';
  o2.frequency.value = 82;
  o2.detune.value = 14;
  const og = ctx.createGain();
  og.gain.value = 0.6;
  const am = ctx.createOscillator();
  am.frequency.value = 5.2;
  const amG = ctx.createGain();
  amG.gain.value = 0.26;
  am.connect(amG);
  amG.connect(og.gain);
  const gf = ctx.createBiquadFilter();
  gf.type = 'lowpass';
  gf.frequency.value = 340;
  gf.Q.value = 0.5;
  o1.connect(og);
  o2.connect(og);
  og.connect(gf);
  gf.connect(gain);

  // Wandering mid-band roar.
  const n = ctx.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  n.playbackRate.value = 0.85;
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 460;
  nf.Q.value = 0.9;
  const ng = ctx.createGain();
  ng.gain.value = 0.5;
  const wob = ctx.createOscillator();
  wob.frequency.value = 0.85;
  const wobG = ctx.createGain();
  wobG.gain.value = 170;
  wob.connect(wobG);
  wobG.connect(nf.frequency);
  n.connect(nf);
  nf.connect(ng);
  ng.connect(gain);

  // High freighter howl — silent at cruise, audible at high thrust.
  const whine = ctx.createOscillator();
  whine.type = 'triangle';
  whine.frequency.value = 780;
  const whineG = ctx.createGain();
  whineG.gain.value = 0;
  whine.connect(whineG);
  whineG.connect(gain);

  gain.connect(master);
  o1.start();
  o2.start();
  am.start();
  n.start();
  wob.start();
  whine.start();

  return {
    setLevel(l) {
      const t = ctx.currentTime;
      const clamped = Math.min(1, Math.max(0, l));
      gain.gain.setTargetAtTime(0.028 + clamped * 0.15, t, 0.12);
      o1.frequency.setTargetAtTime(46 + clamped * 34, t, 0.16);
      o2.frequency.setTargetAtTime(68 + clamped * 50, t, 0.16);
      nf.frequency.setTargetAtTime(360 + clamped * 680, t, 0.18);
      // The howl kicks in above ~40% thrust, rising like the freighter's whine.
      whine.frequency.setTargetAtTime(620 + clamped * 1050, t, 0.25);
      whineG.gain.setTargetAtTime(Math.max(0, clamped - 0.4) * 0.06, t, 0.3);
    },
    stop() {
      const t = ctx.currentTime;
      gain.gain.setTargetAtTime(0, t, 0.2);
      window.setTimeout(() => {
        [o1, o2, am, n, wob, whine].forEach((node) => {
          try {
            node.stop();
          } catch {
            /* already stopped */
          }
        });
        gain.disconnect();
      }, 750);
    },
  };
}

/**
 * Burning firewood: a very low, quiet ember bed (no continuous hiss — that's
 * what made it sound like a hair dryer) plus irregular wood-crack pops and the
 * occasional resin-pocket hiss. Pop density scales with the intensity level.
 */
function buildFireLoop() {
  const gain = ctx.createGain();
  gain.gain.value = 0;

  // Glowing ember bed: slow, deep rumble only.
  const n = ctx.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  n.playbackRate.value = 0.35;
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 150;
  nf.Q.value = 0.4;
  const ng = ctx.createGain();
  ng.gain.value = 0.55;
  const ember = ctx.createOscillator();
  ember.frequency.value = 0.8;
  const emberG = ctx.createGain();
  emberG.gain.value = 45;
  ember.connect(emberG);
  emberG.connect(nf.frequency);
  n.connect(nf);
  nf.connect(ng);
  ng.connect(gain);
  gain.connect(master);
  n.start();
  ember.start();

  let alive = true;
  let level = 0.5;
  let timer = null;

  const pop = (delay, amp) => {
    const t0 = ctx.currentTime + delay;
    const p = ctx.createBufferSource();
    p.buffer = noiseBuf;
    p.playbackRate.value = 0.5 + Math.random() * 1.3;
    const pf = ctx.createBiquadFilter();
    pf.type = 'bandpass';
    pf.frequency.value = 650 + Math.random() * 3600;
    pf.Q.value = 3 + Math.random() * 7;
    const pg = ctx.createGain();
    const dur = 0.012 + Math.random() * 0.05;
    pg.gain.setValueAtTime(amp, t0);
    pg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    p.connect(pf);
    pf.connect(pg);
    pg.connect(master);
    p.start(t0, Math.random() * 1.5);
    p.stop(t0 + dur + 0.02);
  };

  const hiss = (delay) => {
    const t0 = ctx.currentTime + delay;
    const h = ctx.createBufferSource();
    h.buffer = noiseBuf;
    h.playbackRate.value = 0.8 + Math.random() * 0.6;
    const hf = ctx.createBiquadFilter();
    hf.type = 'highpass';
    hf.frequency.value = 2300 + Math.random() * 1800;
    const hg = ctx.createGain();
    const dur = 0.06 + Math.random() * 0.16;
    hg.gain.setValueAtTime(0, t0);
    hg.gain.linearRampToValueAtTime(0.012 + 0.02 * level, t0 + 0.025);
    hg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    h.connect(hf);
    hf.connect(hg);
    hg.connect(master);
    h.start(t0, Math.random() * 1.5);
    h.stop(t0 + dur + 0.02);
  };

  const crackle = () => {
    if (!alive) return;
    const amp = (0.015 + Math.random() * 0.1) * (0.3 + level);
    pop(0.01, amp);
    // Wood cracks often snap in bursts of 2–3 pops.
    if (Math.random() < 0.38) {
      pop(0.02 + Math.random() * 0.05, amp * (0.4 + Math.random() * 0.6));
    }
    // Resin pocket releases a short fizzle now and then.
    if (Math.random() < 0.05 + level * 0.05) {
      hiss(0.02 + Math.random() * 0.08);
    }
    const gap = (20 + Math.random() * 160) / (0.4 + level);
    timer = window.setTimeout(crackle, gap);
  };
  crackle();

  return {
    setLevel(l) {
      level = Math.min(1, Math.max(0, l));
      // Ember bed stays subtle — the pops carry the sound.
      gain.gain.setTargetAtTime(0.014 + level * 0.05, ctx.currentTime, 0.15);
    },
    stop() {
      alive = false;
      if (timer) window.clearTimeout(timer);
      const t = ctx.currentTime;
      gain.gain.setTargetAtTime(0, t, 0.15);
      window.setTimeout(() => {
        try {
          n.stop();
          ember.stop();
        } catch {
          /* already stopped */
        }
        gain.disconnect();
      }, 550);
    },
  };
}

function buildAmbienceLoop() {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 38;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = 57.5;
  const og = ctx.createGain();
  og.gain.value = 0.5;
  o1.connect(og);
  o2.connect(og);
  og.connect(gain);

  const n = ctx.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  n.playbackRate.value = 0.5;
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 140;
  const ng = ctx.createGain();
  ng.gain.value = 0.6;
  n.connect(nf);
  nf.connect(ng);
  ng.connect(gain);

  const shimmer = ctx.createOscillator();
  shimmer.frequency.value = 0.07;
  const shimmerG = ctx.createGain();
  shimmerG.gain.value = 45;
  shimmer.connect(shimmerG);
  shimmerG.connect(nf.frequency);

  gain.connect(master);
  o1.start();
  o2.start();
  n.start();
  shimmer.start();

  return {
    setLevel(l) {
      gain.gain.setTargetAtTime(Math.min(1, Math.max(0, l)) * 0.05, ctx.currentTime, 0.4);
    },
    stop() {
      const t = ctx.currentTime;
      gain.gain.setTargetAtTime(0, t, 0.4);
      window.setTimeout(() => {
        [o1, o2, n, shimmer].forEach((node) => {
          try {
            node.stop();
          } catch {
            /* already stopped */
          }
        });
        gain.disconnect();
      }, 1400);
    },
  };
}

const LOOP_BUILDERS = {
  engine: buildEngineLoop,
  'engine-rocket': buildRocketLoop,
  'engine-falcon': buildFalconLoop,
  fire: buildFireLoop,
  ambience: buildAmbienceLoop,
};

/* ── public API ─────────────────────────────────────────────────────── */

export const soundEngine = {
  init() {
    if (!hasAudio() || listenersAttached) return;
    listenersAttached = true;
    muted = readMuted();
    const unlock = () => {
      ensureContext();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('touchstart', unlock, { capture: true });
  },

  subscribe(cb) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  },

  /** Fires each time the AudioContext transitions into `running`. */
  onReady(cb) {
    readyCallbacks.add(cb);
    return () => readyCallbacks.delete(cb);
  },

  get muted() {
    return muted;
  },

  get unlocked() {
    return Boolean(ctx && ctx.state === 'running');
  },

  setMuted(next) {
    muted = Boolean(next);
    writeMuted(muted);
    if (master && ctx) {
      master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, ctx.currentTime, 0.03);
    }
    notify();
  },

  toggleMuted() {
    this.setMuted(!muted);
    return muted;
  },

  play(name) {
    const audio = ensureContext();
    if (!audio || audio.state !== 'running' || muted) return;
    const recipe = RECIPES[name];
    if (!recipe) return;
    try {
      recipe();
    } catch {
      /* a broken recipe must never crash the UI */
    }
  },

  startLoop(name, level = 0.5) {
    const audio = ensureContext();
    if (!audio || muted) return;
    const existing = loops.get(name);
    if (existing) {
      existing.setLevel(level);
      return;
    }
    if (audio.state !== 'running') return;
    const build = LOOP_BUILDERS[name];
    if (!build) return;
    try {
      loops.set(name, build());
      loops.get(name).setLevel(level);
    } catch {
      /* loop construction failure is non-fatal */
    }
  },

  setLoopLevel(name, level) {
    loops.get(name)?.setLevel(level);
  },

  stopLoop(name) {
    const handle = loops.get(name);
    if (!handle) return;
    loops.delete(name);
    try {
      handle.stop();
    } catch {
      /* teardown is best-effort */
    }
  },

  stopAllLoops() {
    [...loops.keys()].forEach((name) => this.stopLoop(name));
  },
};
