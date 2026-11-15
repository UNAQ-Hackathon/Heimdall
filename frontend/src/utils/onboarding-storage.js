export const ONBOARDING_STORAGE_KEY = 'heimdall_onboarding_v1_done';

export const TOUR_STEPS = [
  {
    id: 'welcome',
    route: '/',
    target: null,
    mobileTab: '3d',
    badge: '1 OF 9 · FULL APP TOUR',
    title: 'Explore Heimdall: How Everything Connects',
    description:
      'Heimdall links 3D spacecraft exploration, 23 verified NASA PSI studies, and the FireHazR microgravity burn predictor into one workflow.',
    highlights: [
      'Selecting habitats updates active cabin O₂/psi context',
      'Adjusting gas, pressure & droplet meters updates FLEX coverage live',
      'Engineer vs Student mode, Parametric Comparison, and Gemini AI adapt everywhere',
    ],
  },
  {
    id: 'planet-dock',
    route: '/',
    target: '[data-tour="planet-dock"]',
    mobileTab: '3d',
    badge: '2 OF 9 · MISSION HUB 3D',
    title: 'Destinations: What Changes When You Fly',
    description:
      'Tap a destination below—or click a planet in 3D—to fly your ship there and open its conceptual landing or ISS airlock preview.',
    changes:
      'Earth, ISS, Moon, and Mars switch the active habitat atmosphere (O₂% & psi) used in planetary inspection and AI mission context.',
    why:
      'Lunar and Martian habitats plan elevated O₂ (≥30%) at lower pressure, which changes which microgravity ISS baselines apply.',
  },
  {
    id: 'craft-selector',
    route: '/',
    target: '[data-tour="craft-selector"]',
    mobileTab: '3d',
    badge: '3 OF 9 · 3D CONTROLS',
    title: 'Spacecraft Model & Camera Controls',
    description:
      'Switch your 3D vessel here. Drag anywhere in space to orbit, scroll or pinch to zoom, and click Overview to pull back.',
    changes:
      'Changes the active 3D ship model, flight trajectory roll/bank cues, and synthesized Web Audio thruster/touchdown sounds—without altering science data.',
    why:
      'Free camera control lets you inspect orbital distances between Earth, ISS, Moon, and Mars before entering a surface preview.',
  },
  {
    id: 'audience-mode',
    route: '/',
    target: '[data-tour="audience-mode"]',
    mobileTab: '3d',
    badge: '4 OF 9 · EXPERTISE MODE',
    title: 'Engineer vs Student Mode (Header Switch)',
    description:
      'Switch between Engineer and Student at any time in the header. Every view in Heimdall adapts automatically.',
    changes:
      'Engineer shows PSI score breakdowns, FLEX support distances, sensors, and CSV/JSON exports; Student switches copy to guided lessons & plain-language takeaways without changing underlying data.',
    why:
      'Students learn why microgravity changes fire physics while engineers inspect exact empirical test bounds and provenance.',
  },
  {
    id: 'fire-lab',
    route: '/',
    target: '[data-tour="fire-lab"]',
    mobileTab: 'lab',
    badge: '5 OF 9 · FIREHAZR INPUTS',
    title: 'Gas Mix, Pressure & Droplet Meters',
    description:
      'Adjust Fuel (Methanol/Heptane), O₂, N₂, CO₂, He fractions, Pressure (mmHg), and Droplet Diameter (mm) before running KNN FLEX v3.',
    changes:
      'Moving any gas slider auto-rebalances the remaining mixture to sum to 1.000, clears stale results, and shifts your point on the FLEX Coverage Map.',
    why:
      'Diluents (CO₂, He) and ambient pressure alter microgravity droplet burn duration; clearing old outputs guarantees you never misread outdated predictions.',
  },
  {
    id: 'flame-page',
    route: '/flame',
    target: '[data-tour="flame-lab-view"]',
    mobileTab: 'lab',
    badge: '6 OF 9 · FIREHAZR 3D LAB',
    title: 'Full Lab: Coverage Gate, Airflow & 3D Chamber',
    description:
      'The dedicated FireHazR Lab adds a 3D Flammability Chamber (Astronaut, Spacecraft, Rover), condition presets, and Forced Ventilation (0–0.30 m/s).',
    changes:
      'O₂% and Status presets drive illustrative 3D flame visuals and sound cues, while Forced Ventilation bends the spherical 0g vs teardrop 1g flame comparison.',
    why:
      'Outside tested NASA FLEX coordinates, the Coverage Gate strictly returns null (abstains) instead of guessing—preventing false confidence in untested gases or planets.',
  },
  {
    id: 'psi-catalog',
    route: '/studies',
    target: '[data-tour="psi-catalog-controls"]',
    mobileTab: '3d',
    badge: '7 OF 9 · PSI CATALOG',
    title: 'PSI Catalog: Filtering 23 NASA Investigations',
    description:
      'Filter the full PSI archive by Mission Goal (Prevent, Detect, Suppress), Search keyword, Fuel, Hardware rack, or Empirical Data Status.',
    changes:
      'Every filter simultaneously narrows the directory, updates Stage 1 O₂ & Pressure telemetry spans, and redraws the Compare All Studies O₂ chart.',
    why:
      'Comparing tested O₂ spans against 21% ISS air and 30% Moon bases highlights verified telemetry (FLEX) vs. pending partial-gravity studies (LUCI, FM2).',
  },
  {
    id: 'compare-earth',
    route: '/compare',
    target: '[data-tour="compare-controls"]',
    mobileTab: '3d',
    badge: '8 OF 9 · PARAMETRIC COMPARISON',
    title: 'Parametric Comparison: Regimes, Matrix & Spin-Offs',
    description:
      'Use presets or pick any 2–3 studies side-by-side, toggle Show Differences Only, and scroll through the Conditions Matrix, the O₂–pressure regime map, and Earth Spin-Offs.',
    changes:
      'Study selectors and Show Differences Only isolate diverging fuels, O₂ ranges, hardware, and sensors for focused CSV export.',
    why:
      'Zero-buoyancy 0g tests plus 1g Earth baselines bound Moon/Mars risk—and transfer directly to cleaner water-mist extinguishers, smoke sensors, and flame-resistant textiles.',
  },
  {
    id: 'header-tools',
    route: '/',
    target: '[data-tour="header-tools"]',
    mobileTab: '3d',
    badge: '9 OF 9 · AI & CONTROLS',
    title: 'Gemini AI Copilot, Space Audio & Help',
    description:
      'Open Gemini AI anywhere to ask questions, toggle Web Audio sound with the speaker button (or M), and click ? anytime to replay this tour.',
    changes:
      'Gemini AI runs live backend PSI ranking and FireHazR prediction calls—showing real tool steps rather than inventing numbers.',
    why:
      'You can explore freely on any page knowing grounded NASA calculations and this full walkthrough are always one click away.',
  },
];

export function readOnboardingDone(storage = typeof window !== 'undefined' ? window.localStorage : null) {
  if (!storage) return true;
  try {
    return storage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeOnboardingDone(done = true, storage = typeof window !== 'undefined' ? window.localStorage : null) {
  if (!storage) return false;
  try {
    if (done) {
      storage.setItem(ONBOARDING_STORAGE_KEY, '1');
    } else {
      storage.removeItem(ONBOARDING_STORAGE_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

export function shouldAutoStartOnboarding({
  pathname = '/',
  search = '',
  alreadyDone = true,
} = {}) {
  if (alreadyDone) return false;
  if (pathname !== '/') return false;
  const params = new URLSearchParams(search);
  if (params.get('planet') || params.get('tab') || params.get('scenario')) {
    return false;
  }
  return true;
}
