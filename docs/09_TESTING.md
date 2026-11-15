# 09 — Testing and Verification

## Commands per service

| Service | Directory | Command |
|---|---|---|
| Frontend | `frontend/` | `npm test` (`node --test tests/*.test.js`) and `npm run build` |
| API | `api/` | `node --test` (all suites) or `node --test tests/<file>` |
| Analytics | `analytics/` | `.venv/bin/python -m unittest discover -s tests -v` |
| API syntax | `api/` | `node --check src/...` for quick syntax validation |

## API suites (`api/tests/`)

| File | Coverage |
|---|---|
| `firehazr.test.js` | Model parity with the original CLI (published example ~5.1283 s), input validation, coverage abstention, JSON artifact integrity, CSV-free inference, and that the Node proxy never fabricates results when analytics is unavailable |
| `ai-provider.test.js` | Provider resolution, Gemini->OpenAI-compatible failover on 429, OpenAI-compatible tool loop, interpretation output cap, provider-aware status |
| `agent-tools.test.js` | Tool declarations and real executor reads |
| `ranking.test.js` | Factor math, weighting, per-factor breakdowns, placeholder handling |
| `telemetry.test.js` | Telemetry endpoint contracts |

Current state: **25 API tests passing**.

## Frontend suites (`frontend/tests/`)

| Area | Files |
|---|---|
| Planet viewer | `planet-models`, `planet-analysis`, `solar-system-model`, `surface-preview`, `environment-perspective` |
| Mission hardware | `iss-and-falcon`, `spacecraft-storage`, `ship-hazard-models` |
| FireHazR inputs | `flex-coverage`, `regime-coverage` |
| Catalog + ranking | `psi-catalog`, `psi-ranking-and-scenarios` |
| Telemetry + UX | `telemetry-f1`, `onboarding` |

Current state: **97 frontend tests passing**. `npm run build` also verifies
production asset URLs and lazy loading of the Three.js layer.

## Analytics suites (`analytics/tests/`)

`test_predictor.py` (FireHazR inference + abstention),
`test_flammability_map.py`, `test_trend_detection.py`.

## End-to-end checks used during development

```bash
# Real KNN prediction through the Vite proxy (all three services up)
curl -X POST :5173/api/analytics/firehazr/predict \
  -H 'Content-Type: application/json' \
  -d '{"fuel":"Methanol","pressure_mmhg":760,"diameter_mm":1.0,
       "o2_fraction":0.21,"n2_fraction":0.79,"co2_fraction":0,"he_fraction":0}'
# -> duracion_estimada_s ~ 5.1283

# FireHazR interpretation (provider chain, failover visible in logs)
curl -X POST :5080/api/analytics/firehazr/interpret -H 'Content-Type: application/json' -d '{...result payload...}'

# Copilot status
curl :5080/api/chat/status   # -> provider, fallbackProviders, budget
```

## What the tests guarantee

1. **No fabricated science** — FireHazR abstains out-of-coverage and the Node
   proxy never synthesizes a result on outage.
2. **Real agent behavior** — tool loops execute against real data; failover
   produces honest provider labels.
3. **Deterministic visuals** — planet normalization, schematic zones, and
   terrain are deterministic and tested.
4. **Graceful degradation** — missing datasets and offline APIs produce
   explicit states, not crashes or invented numbers.
