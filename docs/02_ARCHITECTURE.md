# 02 — System Architecture

## Overview

Heimdall is a three-service application plus a shared data folder and a 3D
asset pipeline. Each service is independently deployable and degrades honestly
when a dependency is unavailable.

```mermaid
flowchart LR
    subgraph Browser["Browser (React 19 + Vite)"]
        UI[Pages & Components]
        R3F[Three.js / R3F scenes]
        SND[Web Audio engine]
    end

    subgraph API["api/ — Node + Express 5 (port 5000)"]
        RC[Controllers & Routes]
        RANK[ranking.service]
        AGT[agent-tools]
        AIS[devin.service<br/>AI provider chain]
        MGR[mongo-reader]
        PDS[processed-dataset]
        FHP[firehazr.service proxy]
    end

    subgraph AN["analytics/ — Python + FastAPI (port 8000)"]
        FR[routers/firehazr]
        FM[routers/flammability]
        TR[routers/trends]
        KNN[(KNN FLEX v3<br/>JSON artifacts)]
    end

    subgraph Data["data/ + MongoDB"]
        RAW[raw PSI exports]
        ING[ingestion pipeline]
        PROC[processed/psi-investigations.json]
        MDB[(MongoDB<br/>investigations)]
    end

    subgraph AI["AI providers (HTTPS)"]
        GEM[Gemini 2.5 Flash]
        GRQ[Groq / OpenAI-compatible]
        DVN[Devin optional]
    end

    UI -->|/api/*| RC
    RC --> RANK
    RC --> AGT
    RC --> FHP
    AGT --> PDS
    AGT --> MGR
    AIS --> GEM
    AIS --> GRQ
    AIS -.->|optional| DVN
    FHP -->|HTTP| FR
    RC -->|trends, flammability-map| AN
    FR --> KNN
    PDS --> PROC
    MGR --> MDB
    ING --> RAW --> PROC
    PROC -->|seed| MDB
```

## Service responsibilities

| Service | Dir | Stack | Responsibility |
|---|---|---|---|
| Frontend | `frontend/` | React 19, Vite 8, Three.js/R3F, Recharts | All UI: Mission Hub, PSI Catalog, Parametric Comparison, FireHazR lab, copilot |
| API | `api/` | Node >= 20, Express 5, Mongoose | REST endpoints, PSI dataset access (Mongo + processed JSON), ranking, AI provider chain, agent tools, analytics proxy |
| Analytics | `analytics/` | Python, FastAPI, Uvicorn | FireHazR KNN FLEX v3 inference, flammability-map grid, trend detection |
| Data | `data/` | Node scripts | `raw/` -> `ingestion/` -> `processed/` -> `npm run seed` |
| Assets | `assets3d/` | Blender | `.blend` sources exported to `.gltf`/`.glb`, copied to `frontend/public/models/` |

## Key request flows

### FireHazR prediction (synchronous)

```mermaid
sequenceDiagram
    participant U as FireHazRPage
    participant N as Node API :5000
    participant P as FastAPI :8000
    participant K as KNN FLEX v3 artifacts

    U->>N: POST /api/analytics/firehazr/predict<br/>{fuel, pressure_mmhg, diameter_mm,<br/>o2/n2/co2/he fractions}
    N->>P: POST /api/analytics/firehazr/predict
    P->>K: load verified JSON artifacts<br/>(SHA-256 fingerprint check)
    K-->>P: neighbors, weights, coverage
    P-->>N: {duracion_estimada_s, vecinos, cobertura, procedencia}
    N-->>U: pass-through (never fabricates on failure)
    U->>U: render duration, coverage diagnostics,<br/>neighbor table, provenance
```

If FastAPI is down the Node proxy returns an honest 503; the UI shows
"FireHazR analytics is unavailable" rather than an invented duration.

### Copilot agent turn (SSE streaming)

```mermaid
sequenceDiagram
    participant C as CopilotChat
    participant N as Node API
    participant AI as Provider (Gemini -> Groq -> Devin)
    participant T as agent-tools
    participant D as Dataset / Mongo

    C->>N: POST /api/chat {message, stream:true}
    N->>AI: prompt + 5 relevant PSI docs + tool declarations
    AI-->>N: functionCall(search_investigations, ...)
    N->>T: execute tool (real read)
    T->>D: query processed JSON / MongoDB
    D-->>T: investigation records
    T-->>N: {error} or result payload
    N-->>C: SSE tool_call + tool_result events (live trace)
    N->>AI: tool result fed back into loop
    AI-->>N: delta tokens (streamed text)
    N-->>C: SSE delta events -> typewriter render
    N-->>C: final answer event + toolCalls trace + usage
```

Tool failures are returned to the model as `{error}` so it reports the
limitation verbatim — the UI renders the real trace, never simulated steps.

### Provider failover chain

```mermaid
flowchart TD
    REQ[chat() or interpretFirehazrResult] --> ORDER{AI_PROVIDER}
    ORDER -->|auto| P1[Gemini]
    ORDER -->|forced| PX[selected provider only]
    P1 -->|ok| OUT[streamed response]
    P1 -->|429 / 5xx / network<br/>before any output| P2[OpenAI-compatible Groq]
    P2 -->|ok| OUT
    P2 -->|fails before output| P3[Devin if configured]
    P3 -->|ok| OUT
    P1 & P2 & P3 -->|fail after partial output| NO[No failover —<br/>never duplicate a response]
    P3 -->|all exhausted| ERR[honest error to client]
```

Each provider has an independent token budget (60,000 tokens) so one
provider's exhaustion does not block fallback.

## Data sources at runtime

The API resolves investigation records from two sources:

1. **MongoDB** (`mongo-reader.service.js`) — read-only; no inserts, updates,
   deletes, `$out`, or `$merge` from the AI path.
2. **Processed JSON fallback** (`utils/processed-dataset.js`) — loads
   `data/processed/psi-investigations.json` (also checked at
   `api/data/processed/` for the Azure package layout). Missing or corrupt
   files degrade to an empty list with a logged warning — never a crash.

The frontend `api.js` adds a third tier: if the API is unreachable it falls
back to the bundled processed dataset so the catalog still renders offline.

## Boundaries and trust rules

- The frontend never holds secrets. `VITE_*` variables carry only the proxy
  target; provider keys live exclusively in `api/.env` (gitignored).
- The analytics service owns all model inference; Node is a pass-through.
- The AI layer may read data through tools but may not write anywhere.
- The 3D layer is presentational: planet selection cannot inject values into
  scientific inputs.
