# Heimdall — dev guide

AI-powered dashboard for NASA PSI combustion-science investigations (spacecraft fire safety).

## Layout

| Dir | What runs there |
|---|---|
| `frontend/` | React 19 + Vite 8 + Three.js (R3F) + Recharts — port 5173 |
| `api/` | Node + Express 5 + Mongoose REST API — port 5000 |
| `analytics/` | Python + FastAPI analytics engine — port 8000 |
| `data/` | PSI ingestion: `raw/` → `ingestion/` → `processed/` → `npm run seed` (in api/) |
| `assets3d/` | `.blend` sources → exported `.gltf` → copy to `frontend/public/models/` |
| `docs/` | Project docs + README assets |

## Run

```bash
# Mongo (local option; Atlas also works — set MONGODB_URI in api/.env)
docker compose up -d mongo

# API
cd api && cp .env.example .env   # fill DEVIN_API_KEY, MONGODB_URI
npm run dev                      # http://localhost:5000/api/health

# Analytics
cd analytics && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload    # http://localhost:8000/api/health

# Frontend (proxies /api → :5000)
cd frontend && npm run dev       # http://localhost:5173
```

## Notes

- Node code is ESM (`"type": "module"`), kebab-case files in `api/src`.
- AI calls go through `api/src/services/devin.service.js` (Devin API + SWE model, `DEVIN_*` env vars). The model must never invent numbers — prompts enforce this.
- Ranking is transparent: `ranking.service.js` returns per-factor score breakdowns.
- Python runs from the `analytics/` dir so `app.*` imports resolve.

## Planet viewer integration

- GLB source assets live in `assets3d/planetas/`. Vite imports them as URLs, serves them in development, and emits hashed assets in production; do not duplicate them in `frontend/public/`.
- `frontend/src/components/three/PlanetViewer.jsx` is a self-contained viewer. Import it with React `lazy` when embedding it to keep Three.js out of the initial page bundle.
- `planetId` accepts `mercury`, `venus`, `earth`, `moon`, `mars`, `jupiter`, `saturn`, `uranus`, `neptune`, or `sun`. The catalog in `planet-catalog.js` supplies IDs, labels, and filenames.
- Example: `<PlanetViewer planetId="mars" style={{ height: 440 }} onLoad={(model) => console.log(model.id)} onError={handleError} />`. The host UI owns selection and layout. Give the container a definite height (minimum viewer height: 240px).
- Optional props: `className`, `style`, `autoRotate` (default false), `autoRotateSpeed`, `loadingFallback`, and `renderError(error, retry)`. Automatic rotation respects reduced-motion preferences. The canvas is transparent.
- `PlanetModel` is available separately for an existing React Three Fiber Canvas. It normalizes a cloned scene without disposing shared cached geometry/materials. Lighting and controls are then the host scene's responsibility.
- `preloadPlanet(id)` optionally warms a single model on hover/focus; no GLB is fetched until viewed or preloaded.
- All models, including Saturn's rings, are centered and normalized independently. Display size, lighting, and rotation are illustrative, not physical scale or simulation. No planetary facts or experimental data are inferred from geometry.
- `/habitat` is a minimal integration preview, not the final dashboard UI. No backend is required to view models.
- `spaceBackground` (default false) adds a flat navy background and sparse, static, instanced octahedral stars (`LowPolySpace`), matching the low-poly models without glow, textures, or twinkling. Bounds fit only the planet, with a fixed camera far plane to keep distant stars visible.
- Analysis is opt-in: pass `enableAnalysis`, controlled `selection`, and `onRegionSelect(region)` to `PlanetViewer`. Regions have `{ planetId, zoneId, point }`; `point` is a normalized-scene world-space array, or null for a keyboard-selected zone. Set selection to null to recenter the global view. Orbiting pauses during inspection; drags are not treated as clicks. Reduced motion disables camera and layout transitions.
- `planet-analysis.js` defines four schematic Earth latitude bands on the model's Y axis, not real biome boundaries. No land/ocean masks, georeferenced orientation, environmental measurements, or analysis outputs are inferred from the GLB. Other planets support point inspection only.
- `PlanetAnalysisPanel` owns the analysis-route placeholder UI. Its lazy `PlanetSurfacePreview` uses `surface-preview.js` for deterministic, conceptual environments: four Earth landscapes, rocky Mercury/Venus/Moon/Mars, atmospheric Jupiter/Saturn/Uranus/Neptune, and solar plasma. These are not reconstructions of clicked locations. Previews are square (1:1) at every breakpoint, with body-specific cameras and constrained look-around controls rather than an overhead diorama. All explorer copy is English. No backend or Blender re-export is needed; never depict solid ground for gas/ice giants or the Sun.
- Model loading uses a null-rendering Suspense signal and a normal DOM overlay, not Drei `Html`: nested HTML roots caused React DOM `removeChild` exceptions when loading or switching models in StrictMode.
- `/habitat` keeps the terrain panel alongside the planet on desktop and below it on narrow screens. Close or Escape returns to a centered global view with a subtle transition; the panel remains inert during its brief exit.
- Non-Earth previews use `environment-perspective.js` and `EnvironmentLandscape.jsx`: continuous faceted heightfields, per-body camera/light/fog settings, raised crater rims on Mercury/Moon, mesas on Mars, curved cloud decks with illustrative vortices, an inclined ring-plane impression on Saturn, and an unlit emissive-looking solar layer with rooted curved prominence strands. Display coordinates and shapes are artistic, not measurements or simulation. Earth retains its existing stylized terrain. Static previews render on demand; only rocky non-Earth scenes enable shadow maps.
- The Mission Hub's `SolarSystemScene` uses `SolarSystemPlanet`, not `PlanetModel` directly. The adapter resolves mock-data model filenames through `solar-system-model.js` to canonical catalog IDs, then applies display scale, orbital distance/motion, selection callbacks and focus registration around the normalized model. Legacy `/models/planetas/` strings are metadata, not fetch URLs. `PlanetModel` itself still requires an explicit `planetId`; do not silently default missing IDs to Earth. Earth/Moon parent groups own their compound orbits.
- Verification from `frontend/`: `npm test` checks all ten GLBs, normalization, illustrative zone classification, centered camera targets, deterministic terrain, camera clearance, finite indexed environment geometry, and solar-system catalog integration; `npm run build` verifies production asset URLs and lazy loading.

## FireHazR integration

- The previous climate predictor (`analytics/predictor/`) and all CSV/Excel files under `PredictorFireHazard-main/` were explicitly removed at the user's request, including Git index entries. `analytics/firehazr/` imports the supplied KNN FLEX v3 directly from `PredictorFireHazard-main/Sensibilidad de gases/knn/`; keep that Python source folder and `resultados/modelo.json` and `resumen.json` available when deploying analytics. Inference and coverage rules are unchanged. The original inference CLI still works; retraining, graph regeneration, and reproduction of the original validation require restoring the deleted source data.
- Run analytics from `analytics/`: `.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000`. Node proxies `GET /api/analytics/firehazr` and `POST /api/analytics/firehazr/predict`. Inputs are `fuel` (`Methanol` or `Heptane`), `pressure_mmhg`, `diameter_mm`, and mole fractions `o2_fraction`, `n2_fraction`, `co2_fraction`, `he_fraction` (0–1, not percentages). Preserve the original sum tolerance of 0.025.
- Use the supplied trained JSON artifacts without retraining on startup or reading CSV files. The loader verifies pinned SHA-256 fingerprints of both JSON files (UTF-8 with normalized LF newlines), then checks their version, training provenance, configuration, and trial count. Replacing the model requires reviewing and updating these fingerprints. `training_sha256` retains the original training-source hash as provenance only; the deleted CSV is no longer independently verified. Metadata explicitly reports `source_data_available: false`.
- Predict recorded microgravity droplet burn duration only, never fire probability, safety, ignition limits, planetary combustion, or suppressant effectiveness. Preserve the v3 coverage gate: unsupported queries return a null duration and a reason, never a forced diagnostic estimate or fallback score. Ar and Xe are not supported by this FLEX model.
- `FireHazRPage` is available at `/firehazr` and `/flame`, and is embedded in the Mission Hub testbench. It does not infer experimental inputs from the selected planet/scenario. Its results include real neighbors, weights, coverage diagnostics, provenance, and supplied out-of-sample validation, with disclosures closed by default. The old qualitative What-if hazard index is no longer mounted in these testing flows.
- Verify from `analytics/`: `.venv/bin/python -m unittest discover -s tests -v`; from `api/`: `node --test tests/firehazr.test.js`; from `frontend/`: `npm test` and `npm run build`. FireHazR tests compare the API with the original CLI (published example: 5.1283 s), validate inputs, check abstention, JSON artifact integrity and CSV-free inference, and ensure the Node proxy never fabricates results when analytics is unavailable.
