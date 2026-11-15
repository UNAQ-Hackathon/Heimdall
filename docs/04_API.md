# 04 — API (Node + Express 5)

The API serves investigation data, transparent ranking, the AI copilot, and a
pass-through proxy to the Python analytics service. Source is ESM
(`"type": "module"`), kebab-case files under `api/src/`.

## Route map

Base path: `/api` (`src/routes/index.js`).

| Method | Path | Controller | Description |
|---|---|---|---|
| GET | `/health` | inline | Liveness probe |
| GET | `/investigations` | `investigation.controller.list` | List PSI studies with filters (query, category, fuel, hardware, dataStatus) |
| GET | `/investigations/:id` | `getById` | Single study detail |
| GET | `/investigations/:id/telemetry` | `getTelemetry` | Measured series for a study |
| POST | `/investigations/:id/summarize` | `summarize` | AI-generated summary via provider chain |
| GET | `/telemetry` · `/telemetry/:id` | `getTelemetry` | Telemetry aliases |
| POST | `/ranking` | `ranking.controller.rank` | Weighted multi-factor ranking (body: `{scenario}`) |
| GET | `/chat/status` | `chat.controller.status` | Active provider, fallbacks, token budgets, connectivity |
| POST | `/chat` | `chat.controller.ask` | Copilot turn — JSON or SSE (`stream:true` / `Accept: text/event-stream`) |
| GET | `/chat/sessions/:sessionId` | `pollSession` | Poll an async chat session |
| GET | `/analytics/firehazr` | `firehazrMetadata` | Model metadata + envelope (proxied) |
| GET | `/analytics/firehazr/presets` | `firehazrPresets` | NASA PSI / FLEX input presets |
| POST | `/analytics/firehazr/predict` | `predictFirehazr` | KNN inference (proxied) |
| POST | `/analytics/firehazr/interpret` | `firehazrInterpret` | AI interpretation of a completed prediction |
| POST | `/analytics/trends` | `trends` | Trend detection over series (proxied) |
| POST | `/analytics/flammability-map` | `flammability` | Flammability grid (proxied) |

## Service layer (`api/src/services/`)

| File | Role |
|---|---|
| `ranking.service.js` | Transparent weighted scoring — see below |
| `devin.service.js` | AI provider chain, agent tool loop, SSE streaming, interpretation (see 07_AI_COPILOT.md) |
| `agent-tools.js` | 5 tool declarations + executors reading real data |
| `firehazr.service.js` | Thin HTTP proxy to FastAPI `/api/analytics/firehazr*` |
| `analytics.service.js` | Proxy for `/trends` and `/flammability-map` |
| `mongo-reader.service.js` | Read-only Mongo context for the copilot (no writes, no `$out`/`$merge`) |

`utils/processed-dataset.js` resolves the canonical investigation dataset with
Mongo/JSON merge semantics (`psiStatus` respected, `series` prefer live docs).

## Transparent ranking engine

`rankInvestigations(investigations, scenario, weights)` computes
`score = sum(weight_i * factor_i)` and returns every factor's contribution —
the UI can show *why* a study ranks where it does.

| Factor | Label | What it measures |
|---|---|---|
| `atmosphereMatch` | Habitat Atmosphere (O2 & Pressure) | Distance between the scenario's O2% and the study's tested O2 range (min/max aware) |
| `gravityMatch` | Gravity Regime & Proxies | Exact regime match = 1; `partial-gravity-proxy` tagged studies (E-FIELD Flames) score 0.9 for Moon/Mars; microgravity bounds at 0.5 |
| `dataRichness` | Telemetry & Condition Coverage | Measured conditions + series coverage |
| `documentation` | Experimental Documentation | Objective/variables/sensors completeness |

Rules:

- Placeholder studies (`dataAvailable === false` or `status === 'upcoming'`)
  score 0 on `atmosphereMatch` — pending studies cannot pretend to have data.
- Callers may pass custom `weights`; defaults are uniform over the factors.
- Scores carry a per-factor breakdown so the ranking is auditable, not a
  black box.

## Investigation endpoints

`list` merges API results with the processed dataset so studies missing from
Mongo still appear (deduplicated by acronym). `getById` falls back to the
processed JSON when Mongo misses. `getTelemetry` returns measured series only.

`summarize` calls the same provider chain as chat; without a configured
provider it responds honestly instead of fabricating a summary.

## Error behavior

- `POST /analytics/firehazr/predict` -> analytics down: **503** pass-through;
  Node never invents a duration.
- `POST /analytics/firehazr/interpret` -> no provider configured: **503**
  `{error:{message}}`; a coverage abstention (`skipped`) is a legitimate
  200 with `interpretation: null`.
- Missing processed dataset: warning + `[]`, not ENOENT.
- Tool executor failures: `{error}` returned to the model so it can state
  the limitation to the user.

## Validation and middleware

- `chat.routes.js` uses `validateBody` for required fields.
- `ranking.routes.js` requires `{scenario: object}`.
- Input edits on the frontend cancel in-flight requests via `AbortController`
  (`signal` passed through `api.js`).

## Configuration surface

Runtime env lives in `api/src/config/env.js` — port, `MONGODB_URI`,
`AI_PROVIDER`, per-provider keys/models/limits, and
`AI_INTERPRET_MAX_TOKENS`. See [08_DEPLOYMENT.md](08_DEPLOYMENT.md#environment-variables).
