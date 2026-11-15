# 05 — Analytics Service and FireHazR (Python + FastAPI)

The analytics service is the scientific compute tier. It owns the trained
FireHazR model and the flammability/trend endpoints. Node proxies to it; the
frontend never calls it directly.

## Layout

```
analytics/
├── app/
│   ├── main.py               # FastAPI app, router registration
│   ├── core/config.py        # settings (artifact paths, env)
│   ├── routers/
│   │   ├── health.py         # GET /api/health
│   │   ├── firehazr.py       # GET /firehazr, POST /firehazr/predict
│   │   ├── flammability.py   # POST /flammability-map
│   │   └── trends.py         # POST /trends
│   ├── schemas/              # Pydantic request/response models
│   └── services/
│       ├── firehazr.py       # artifact load, predict(), metadata()
│       ├── flammability_map.py
│       └── trend_detection.py
├── firehazr/                 # imports the supplied KNN FLEX v3 source
└── tests/                    # unittest suites
```

Run from `analytics/` so `app.*` imports resolve:

```bash
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/analytics/firehazr` | Model metadata: fuels, envelope bounds, trial coverage, provenance |
| POST | `/api/analytics/firehazr/predict` | KNN prediction (see contract below) |
| POST | `/api/analytics/flammability-map` | Flammability surface over an input grid |
| POST | `/api/analytics/trends` | Trend detection over provided series |

## FireHazR — KNN FLEX v3

FireHazR wraps the supplied **KNN FLEX v3** model trained on NASA FLEX
droplet-combustion trials. It predicts **recorded microgravity droplet burn
duration** only.

### Inputs

| Field | Type | Notes |
|---|---|---|
| `fuel` | `Methanol` \| `Heptane` | only fuels present in FLEX v3 |
| `pressure_mmhg` | number | chamber pressure |
| `diameter_mm` | number | droplet diameter |
| `o2_fraction` | 0..1 | oxidizer mole fraction |
| `n2_fraction` | 0..1 | balance gas |
| `co2_fraction` | 0..1 | suppressant diluent |
| `he_fraction` | 0..1 | suppressant diluent |

Mole fractions must sum to ~1 within the **original tolerance of 0.025**.
Argon and xenon are **not** supported by this model.

### Output contract

- In-coverage: `duracion_estimada_s` (seconds) + real `vecinos` (neighbors
  with weights), coverage diagnostics, and `procedencia` (training
  provenance). Published verification example: **~5.1283 s**.
- Out-of-coverage: `duracion_estimada_s: null` + abstention reason. The v3
  coverage gate is preserved — never a forced diagnostic estimate, never a
  fallback score, never a proxy.

### Artifact integrity

`services/firehazr.py` loads pre-trained JSON artifacts
(`resultados/modelo.json` + `resumen.json`) at startup — **no retraining, no
CSV reads**:

1. Verify pinned SHA-256 fingerprints of both files (UTF-8, LF normalized).
2. Validate version, training provenance, configuration, trial count.
3. `training_sha256` is retained as provenance only; the deleted source CSV
   is no longer independently verified.
4. Metadata reports `source_data_available: false` — disclosed, not hidden.

Replacing the model requires reviewing and updating these fingerprints.

### What it must never do

- No fire probability, safety rating, ignition-limit, planetary-combustion,
  or suppressant-effectiveness claims.
- No inference of inputs from a selected planet/scenario.
- No estimate when coverage abstains.

## Flammability map and trends

- `flammability_map.py` renders a grid response for the frontend
  `FlammabilityChart` over caller-supplied points/grid bounds.
- `trend_detection.py` detects trends in provided numeric series; used by
  chart surfaces that already hold real measurements.

Both operate on caller-supplied data — they compute over what exists rather
than inventing datasets.

## Failure semantics

If the service is unreachable the Node proxy surfaces a 503 and the UI shows
"FireHazR analytics is unavailable". The chain never fabricates a duration to
hide an outage — availability is part of scientific honesty.
