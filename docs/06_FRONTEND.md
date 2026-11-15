# 06 — Frontend (React 19 + Vite 8)

The frontend is a single-page app under `frontend/src/`. Styling uses plain
CSS design tokens; charts use Recharts; 3D uses Three.js via React Three
Fiber.

## Routes (`src/App.jsx`)

| Path | Page | Purpose |
|---|---|---|
| `/` | `MissionHub.jsx` | 3D solar system + FireHazR algorithm lab (default compact tab) |
| `/studies`, `/investigations`, `/study`, `/study/:id`, `/telemetry`, `/telemetry/:id` | `PsiCatalogPage.jsx` | Catalog browse, filters, study detail, telemetry |
| `/flame`, `/firehazr`, `/flame-3d` | `FireHazRPage.jsx` | Standalone FireHazR predictor + 3D flame lab |
| `/compare` | `ComparePage.jsx` | Parametric comparison: side-by-side, matrix, regime map, Earth spin-offs |
| `*` | `NotFoundPage.jsx` | 404 |

## Pages in detail

### MissionHub

Two-panel layout: `SolarSystemScene` (3D planets, selection, scenario
context) on the left; a stacked lab panel on the right headed by
`ALGORITHM · KNN FLEX v3` mounting `<FireHazRPage compact />`. A static
header replaced the old Predictor/Fire-3D tab switcher; `?tab=` links now
only expand the panel. Mobile switches between "Solar System 3D" and
"Algorithm Lab".

### FireHazRPage (the algorithm lab)

- **Inputs**: NASA PSI / FLEX preset dropdown (Mongo or local), segmented
  fuel selector (Methanol/Heptane), mixture controls (O2/N2/CO2/He) with live
  FLEX trial counts, and bounded meters for pressure, O2, diluent, and
  droplet diameter. `updateMeterCondition` clamps to the active envelope and
  rebalances N2 automatically (`flex-coverage.js`).
- **Coverage map**: `FlexCoverageMap` interactive view with "snap to nearest
  FLEX trial" when between clusters.
- **Results column**: predicted duration, coverage diagnostics,
  `FireHazrResultChart`, neighbors + weights, provenance, disclosures.
- **Interpretation**: two clearly separated blocks —
  `DETERMINISTIC READOUT` (local summary from real model output) and an
  AI-generated brief labeled with the live provider name
  (`GET /api/chat/status` drives the label; when no provider is configured
  the button shows "AI offline" and a note explains only the deterministic
  readout is available).
- **3D chamber**: `FlameVisualization`, subject selector, state pills,
  airflow, and a Web-Audio fire loop mapped to suit state.
- Requests are cancellable (`AbortController`); stale responses are
  invalidated when inputs change.

### PsiCatalogPage

Browse/filter/search over 23+ studies (query, pillar, fuel, hardware family,
data status), study detail with objectives/variables/sensors/conditions,
telemetry views, scenario-aware ranking integration, and per-study AI
summaries (audience-aware).

### ComparePage (Parametric Comparison)

Four section tabs — **All Sections**, **Side-by-Side**, **Conditions
Matrix**, **Earth Spin-Offs** — each scrolling to its section
(`scrollIntoView` + `scroll-margin-top`):

1. **Side-by-Side**: presets (Solids, Suppression & High-O2, Partial-g & Moon
   Gap, Smoke & Dust), 2–3 study slots, an aligned attribute table (pillar,
   hardware, fuel, O2 envelope with `OxygenBar`, pressure & flow, gravity,
   empirical series count, variables/sensors/objective), "Show Differences
   Only" row filter, verified-similarities/key-differences digest
   (`summarizeInvestigationDifferences`), CSV export of the selection.
2. **Conditions Matrix**: searchable table of O2 range, ambient pressure,
   fuel geometry, and regime behavior with "Highlight Extremes" + CSV export.
3. **O2–Pressure Regime Map**: Recharts scatter of each study at its tested
   O2 fraction vs chamber pressure (colored by pillar via `CATEGORY_STYLE`),
   dashed reference markers for ISS cabin (21%/14.7 psi), lunar habitat
   (>=30%/<=10.2 psi), EVA suit (100%/4.3 psi); plus a per-study tested-O2
   envelope list (min–max bars, 21% Earth reference tick).
4. **Earth Spin-Offs + Cross-Study Findings**: technology-transfer cards
   (water-mist suppression, smoke detection, material screening) with
   standards and linked studies; findings on gravity bounds, oxygen regimes,
   and hardware taxonomy.

### CopilotChat

Global docked assistant. SSE-driven: streamed `delta` tokens render as
typewriter text; `tool_call`/`tool_result` events render a live execution
timeline; provider label comes from `/api/chat/status` (e.g. "POWERED BY
GROQ"). Never simulates tool steps.

## State and contexts

- `AppContext` — audience (`Engineer`/`Student`) which adapts vocabulary
  (e.g. "Test Variables" vs "Plain-Language Takeaway").
- `ScenarioContext` + `scenarios.js` — five mission environments (Earth 1g,
  ISS/LEO, Moon base/rover, Mars base, spacesuit/airlock) feeding ranking and
  regime coverage; **never** feeding FireHazR inputs.
- `SoundContext` — must wrap the app *outside* `AppProvider`; delegated
  `ui-tick`, mute (`M` key / header button, persisted), named loops.

## Services (`src/services/`)

| File | Role |
|---|---|
| `api.js` | REST client; merges API + bundled processed data; `local-processed-fallback` when the API is down; SSE chat reader |
| `mockData.js` | `INVESTIGATIONS`, `COMPARISON_MATRIX`, `CROSS_FINDINGS`, `EARTH_APPLICATIONS`, flame-comparison qualitative data |
| `psi-catalog.js` | Filters, `getHardwareFamily`, `CATEGORY_STYLE`, CSV builders, difference digest, oxygen bounds |
| `flex-coverage.js` | FLEX envelope clamps, mixture balancing, meter updates |
| `regime-coverage.js`, `telemetry-f1.js`, `ranking.js` | Regime coverage math, telemetry helpers, client ranking glue |

## 3D layer (`src/components/three/`)

`SolarSystemScene` + `SolarSystemPlanet` (adapter resolving mock filenames to
canonical `planet-catalog` IDs); `PlanetModel`/`PlanetViewer` normalize
cloned GLB scenes without disposing shared cached geometry;
`planet-analysis.js` defines **schematic** Earth latitude bands (not real
biomes); `surface-preview.js`/`EnvironmentLandscape.jsx` render deterministic,
conceptual terrain — never reconstructions of clicked locations;
`StationInteriorPreview`/`IssInteriorPreviewStage` drive airlock phases.
GLBs load lazily; no GLB is fetched until viewed or preloaded.

## Audio (`src/audio/sound-engine.js`)

All sound is synthesized via Web Audio API — no audio files. `play(name)`
one-shots; `startLoop`/`setLoopLevel`/`stopLoop` named loops (`engine`,
`engine-rocket`, `fire`, `ambience`). No-ops without `AudioContext` so Node
tests are unaffected. Mount-only loop cleanup uses refs — never depend on the
whole `sfx` object in cleanup deps.

## Component inventory

- `charts/`: `FireHazrResultChart`, `FlammabilityChart`, `TimeSeriesChart`
- `ui/`: `CopilotChat`, `FlexCoverageMap`, `HeimdallLogo`,
  `MissionPlanetInspection`, `NasaSplashLoader`, `OnboardingTour`,
  `PlanetAnalysisPanel`, `SpacecraftSelector`
- `layout/`: `AppLayout` (nav: Mission Hub, PSI Catalog, FireHazR Lab,
  Parametric Comparison)
