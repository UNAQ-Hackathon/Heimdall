# Heimdall — Technical Documentation

AI-powered dashboard for NASA Physical Science Informatics (PSI) combustion-science
investigations, built for the NASA Space Apps challenge. Heimdall summarizes, ranks,
and interprets decades of microgravity fire-safety research and delivers predictive,
traceable answers for future crewed missions to the ISS, the Moon, and Mars.

## Challenge addressed

> "Create an interactive, super intelligence (SI) powered dashboard that summarizes,
> ranks, and interprets [microgravity combustion] findings to deliver fire safety
> insights for human space exploration." — NASA Space Apps, spacecraft fire safety
> challenge.

The full challenge brief is summarized in
[01 — Challenge and Requirements](01_CHALLENGE.md).

## Documentation index

| Document | Scope |
|---|---|
| [01_CHALLENGE.md](01_CHALLENGE.md) | Challenge brief, scientific context, how each requirement maps to a feature |
| [02_ARCHITECTURE.md](02_ARCHITECTURE.md) | System topology, request flows, service boundaries, deployment units |
| [03_DATA_PIPELINE.md](03_DATA_PIPELINE.md) | PSI data acquisition, ingestion pipeline, processed dataset schema, provenance rules |
| [04_API.md](04_API.md) | Node/Express API: every endpoint, service, and the transparent ranking engine |
| [05_ANALYTICS.md](05_ANALYTICS.md) | Python/FastAPI analytics service and the FireHazR KNN FLEX v3 model |
| [06_FRONTEND.md](06_FRONTEND.md) | React frontend: pages, components, 3D scenes, charts, audio, state |
| [07_AI_COPILOT.md](07_AI_COPILOT.md) | Agentic copilot: provider chain, tool calling, SSE streaming, token budgets |
| [08_DEPLOYMENT.md](08_DEPLOYMENT.md) | Local development, environment variables, Azure CI/CD pipelines |
| [09_TESTING.md](09_TESTING.md) | Test suites, verification commands, coverage per service |

Existing supplementary docs kept in this folder:

- [UI_ARCHITECTURE.md](UI_ARCHITECTURE.md) — earlier deep-dive on the frontend layer
- [AZURE_CICD.md](AZURE_CICD.md) — Azure pipeline secret/variable setup
- [assets/](assets/) — screenshots and logos referenced by the top-level README

## The product in one paragraph

Heimdall exposes 23+ verified NASA PSI investigations (BASS, Saffire, FLEX,
ACME, SAME, and more) through four surfaces: a **Mission Hub** that couples a
3D solar-system scene with the FireHazR algorithm lab; a **PSI Catalog** for
browsing, filtering, and ranking studies against mission scenarios; a
**Parametric Comparison** page that aligns conditions and O2/pressure envelopes
across studies and links findings to terrestrial spin-offs; and an **agentic
copilot** that answers questions by calling real backend tools — never by
fabricating numbers.

## Quick start

```bash
# 1. Analytics (Python) — required for FireHazR predictions
cd analytics
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. API (Node) — proxies analytics, serves PSI data, runs the AI copilot
cd api
cp .env.example .env   # fill in provider keys; Mongo optional for local data
npm install && npm run dev          # http://localhost:5000/api/health

# 3. Frontend (React + Vite)
cd frontend
npm install && npm run dev          # http://localhost:5173
```

The frontend dev server proxies `/api` to the Node API on port 5000 by default.
For a non-default API port set `VITE_API_PROXY_TARGET` in `frontend/.env.local`
(see [08_DEPLOYMENT.md](08_DEPLOYMENT.md#local-ports-and-proxies)).

## Design principles

1. **No fabricated science.** Every number shown traces to the processed PSI
   dataset, a live analytics computation, or an AI response that is explicitly
   labeled as generated text. Models abstain (return `null` + reason) when a
   query falls outside measured coverage.
2. **Traceability.** Predictions ship with neighbors, weights, coverage
   diagnostics, and training provenance. Ranking exposes every factor's
   contribution to each score.
3. **Graceful degradation.** Missing datasets, unreachable analytics, or
   exhausted AI quotas surface as honest errors — never as invented results.
4. **Audience awareness.** Engineer and Student modes adapt vocabulary and
   detail level without changing the underlying data.
