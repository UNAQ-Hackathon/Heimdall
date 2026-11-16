<div align="center">

  <img src="docs/assets/nasa-logo.png" alt="NASA Logo" height="105">
  &nbsp;&nbsp;&nbsp;
  <img src="docs/assets/heimdall-logo.png" alt="Heimdall Logo" height="110">
  &nbsp;&nbsp;&nbsp;
  <img src="docs/assets/unaq-logo.png" alt="UNAQ Logo" height="105">

# Heimdall

### AI-Powered Dashboard for Spacecraft Fire Safety

[![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express_5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Gemini](https://img.shields.io/badge/Gemini-4285F4?style=flat-square&logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![NASA PSI](https://img.shields.io/badge/NASA_PSI-0B3D91?style=flat-square)](https://psi.nasa.gov/)
[![Blender](https://img.shields.io/badge/Blender-F5792A?style=flat-square&logo=blender&logoColor=white)](https://www.blender.org/)

<p align="center">
  An interactive, AI-driven dashboard that summarizes, ranks, compares, and interprets decades of
  NASA microgravity combustion experiments to support fire safety in human space exploration.
</p>

<p align="center">
  <em>Named after Heimdall, the ever-watchful guardian of the Bifrost who sees and hears all —
  this dashboard watches over decades of combustion data so nothing critical goes unseen.</em>
</p>

</div>

---

## The Problem

Fire inside a spacecraft or space habitat is one of the most critical threats to a mission — Apollo 1, the fire aboard the Mir space station, and the smoke alarm during Artemis II are stark reminders. In microgravity, flames behave in ways that defy Earth-bound intuition: without buoyancy, a candle flame collapses into a blue sphere sustained only by oxygen diffusion.

NASA has spent decades studying fire prevention, detection, and suppression aboard the ISS (BASS, Saffire, SAME, FLEX, ACME, CFI, SPICE, SLICE, and more), publishing results in the **Physical Science Informatics (PSI)** database. The problem: there is so much data across heterogeneous experimental tables that it is hard to **find, compare, and interpret**.

On top of that, future lunar habitats and pressurized rovers will operate with **oxygen-enriched atmospheres (≥ 30% O₂) at reduced pressure (≤ 10.2 psi)** — conditions that make materials far more flammable, while EVA suits run near **100% O₂ at 4.3 psi**. Knowing which investigations are relevant to those regimes is critical.

---

## What It Does

- **Mission Hub & 3D Solar System (`/`)**: Interactive Three.js / React Three Fiber solar system with spacecraft transit, planetary inspection, ISS interior airlock preview, and an embedded **FireHazR KNN FLEX v3** lab.
- **FireHazR Droplet Burn Predictor (`/firehazr`, `/flame`)**: Predicts recorded microgravity droplet burn duration (**Methanol** and **Heptane**) using the verified **KNN FLEX v3** model, complete with nearest neighbors, weights, interactive `FlexCoverageMap`, coverage abstention gates, a 3D combustion chamber, deterministic readouts, and optional AI interpretation.
- **PSI Catalog & Transparent Ranking (`/studies`)**: Browse, filter, and search **23+ verified NASA PSI investigations** enriched with experimental run measurements (`experimentRuns`) and data series; rank them against five mission scenarios (**Earth 1g**, **ISS/LEO**, **Moon base/rover**, **Mars base**, **Spacesuit**) with per-factor score breakdowns.
- **Parametric Comparison & Earth Spin-Offs (`/compare`)**: Side-by-side study comparator with *"Show Differences Only"*, searchable conditions matrix, O₂–pressure regime map with ISS/Lunar/EVA reference envelopes, CSV export, and terrestrial fire-safety spin-offs (water-mist suppression, smoke detection, material screening).
- **Streaming Agentic Copilot**: Docked AI assistant (`CopilotChat`) with real-time SSE token streaming and live tool-execution traces (`search_investigations`, `get_investigation`, `rank_investigations`, `predict_burn_duration`, `list_mission_scenarios`) over a multi-provider failover chain (**Gemini → Groq / OpenAI-compatible → Devin**).
- **Immersive Synthesized Audio**: Web Audio API procedural sound engine (`SoundProvider`) driving spacecraft engines, airlock phases, O₂-scaled fire crackle, and ambient soundscapes (`M` to mute).
- **Audience-Aware Interface**: Switch between **Engineer** and **Student** modes to adapt technical vocabulary and takeaways without altering underlying scientific values.

---

## Design Principles

- **Scientific honesty & coverage gates**: PSI contains no partial-gravity data. Microgravity (`0g`) and Earth (`1g`) results are presented as *bounds*, upcoming studies (`LUCI`, `FM2`) are flagged explicitly, and FireHazR predicts recorded microgravity droplet burn duration only — abstaining (`null` + reason) outside its trained FLEX v3 envelope (Argon and Xenon are unsupported).
- **Zero fabricated numbers**: The AI copilot executes real read-only backend tools and reports `{ error }` verbatim when data or analytics are unavailable. 3D planet selection never injects values into scientific inputs.
- **Traceability & provenance**: Every ranking score ships with its per-factor breakdown; FireHazR results include nearest neighbors, weights, and SHA-256-verified JSON artifact provenance; experimental series carry PSI source tags.
- **Graceful degradation**: Missing MongoDB, unreachable FastAPI analytics, or exhausted AI quotas surface as explicit UI states instead of silent fallbacks or invented output.

---

## Architecture

```
NASA PSI + Experimental Tables CSVs
        │
        ▼
data/ingestion/ ──▶ data/processed/psi-investigations.json ──▶ MongoDB (investigations)
                                                                       │
        ┌──────────────────────────────────────────────────────────────┘
        ▼
api/ (Node + Express 5, :5000) ◀──▶ analytics/ (Python + FastAPI, :8000)
  • PSI catalog & transparent ranking      • FireHazR KNN FLEX v3 (verified JSON artifacts)
  • Read-only Mongo + JSON fallback        • Flammability map & trend detection
  • Multi-provider AI copilot (SSE)
        │
        ├──▶ AI Provider Chain: Gemini ──▶ OpenAI-compatible (Groq) ──▶ Devin (optional)
        ▼
frontend/ (React 19 + Vite 8, :5173)
  • Three.js / R3F 3D scenes • Recharts • Web Audio engine • CopilotChat
```

### Technology Stack

| Layer | Technologies |
|---|---|
| **3D Models & Assets** | Blender → `.glb` / `.gltf` (`assets3d/`, lazy-loaded via Vite) |
| **Frontend** | React 19, Vite 8, Three.js (`@react-three/fiber`, `@react-three/drei`), Recharts, Web Audio API |
| **API & Agent Layer** | Node.js (≥ 20), Express 5, Mongoose, Server-Sent Events (SSE) |
| **AI Providers** | Gemini (`gemini-2.5-flash`), OpenAI-compatible (`Groq` default), Devin (optional fallback) with function calling |
| **Analytics & ML** | Python, FastAPI, Uvicorn, NumPy, pandas, SciPy, FireHazR KNN FLEX v3 |
| **Data** | MongoDB + canonical processed JSON (`data/processed/psi-investigations.json`) |
| **Deployment** | Azure App Service (`api`, `analytics`) + Azure Static Web Apps (`frontend`) via GitHub Actions |

---

## Quick Start

```bash
# 1. Analytics (Python + FastAPI) — required for FireHazR predictions
cd analytics
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. API (Node + Express 5) — serves PSI data, ranking, analytics proxy, AI copilot
cd api
cp .env.example .env   # add GEMINI_API_KEY / OPENAI_COMPAT_API_KEY; MONGODB_URI optional
npm install && npm run dev          # http://localhost:5000/api/health

# 3. Frontend (React + Vite) — proxies /api -> :5000 by default
cd frontend
npm install && npm run dev          # http://localhost:5173
```

Optional local MongoDB via Docker:

```bash
docker compose up -d mongo
```

See [`docs/08_DEPLOYMENT.md`](docs/08_DEPLOYMENT.md) for all environment variables (`api/.env`), custom proxy ports (`frontend/.env.local`), and Azure CI/CD configuration.

---

## Testing

```bash
# Analytics (unittest)
cd analytics && .venv/bin/python -m unittest discover -s tests -v

# API (Node test runner)
cd api && node --test

# Frontend (Node test runner + production build)
cd frontend && npm test && npm run build
```

See [`docs/09_TESTING.md`](docs/09_TESTING.md) for suite details and end-to-end verification commands.

---

## Repository Structure

```
├── frontend/                   # React 19 + Vite 8 + Three.js + Recharts + Web Audio
├── api/                        # Node + Express 5 REST API, ranking, AI copilot, analytics proxy
├── analytics/                  # Python + FastAPI analytics & FireHazR KNN FLEX v3 wrapper
├── PredictorFireHazard-main/   # Supplied KNN FLEX v3 Python source & verified JSON artifacts
├── data/                       # PSI ingestion scripts & canonical processed dataset
├── assets3d/                   # Blender sources & exported planet/spacecraft GLBs
├── deploy/                     # Azure packaging & deployment scripts
└── docs/                       # Full technical documentation
```

### Documentation

Full technical documentation lives in [`docs/README.md`](docs/README.md):

- [01 — Challenge & Requirements](docs/01_CHALLENGE.md)
- [02 — System Architecture](docs/02_ARCHITECTURE.md)
- [03 — Data Pipeline & Provenance](docs/03_DATA_PIPELINE.md)
- [04 — Node API & Ranking Engine](docs/04_API.md)
- [05 — Analytics & FireHazR KNN FLEX v3](docs/05_ANALYTICS.md)
- [06 — Frontend, 3D & Audio](docs/06_FRONTEND.md)
- [07 — AI Copilot & Provider Chain](docs/07_AI_COPILOT.md)
- [08 — Deployment & Environment](docs/08_DEPLOYMENT.md)
- [09 — Testing & Verification](docs/09_TESTING.md)
- [UI Architecture Specification](docs/UI_ARCHITECTURE.md)
- [Azure CI/CD Setup](docs/AZURE_CICD.md)

---

## Limitations

- PSI contains no partial-gravity data; lunar and Martian regimes are bounded by microgravity (`0g`) and Earth (`1g`) results.
- 3D flame, planetary, and surface previews are qualitative/illustrative visuals, not physical simulations or georeferenced reconstructions.
- FireHazR KNN FLEX v3 predicts recorded microgravity droplet burn duration for **Methanol** and **Heptane** only; it does not support Ar/Xe diluents and does not estimate fire probability, ignition limits, or suppressant effectiveness.
- Rocket and propellant combustion are outside the scope of PSI.

---

## The Challenge

Built for the NASA Space Apps hackathon at **Universidad Aeronáutica en Querétaro (UNAQ)**:

> *"Build an SI-powered dashboard to summarize, rank, and interpret combustion science investigations for spacecraft fire safety."*

---

## Team

<div align="center">
<table>
  <tr>
    <td align="center">
      <a href="https://github.com/dferram">
        <img src="https://github.com/dferram.png?size=100" width="80" alt="Fernando Ramírez"><br>
        <b>Fernando Ramírez</b>
      </a><br>
      <sub>@dferram</sub>
    </td>
    <td align="center">
      <a href="https://github.com/betocovave">
        <img src="https://github.com/betocovave.png?size=100" width="80" alt="Alberto Covarrubias"><br>
        <b>Alberto Covarrubias</b>
      </a><br>
      <sub>@betocovave</sub>
    </td>
    <td align="center">
      <a href="https://github.com/cobastelano-cyber">
        <img src="https://github.com/cobastelano-cyber.png?size=100" width="80" alt="cobastelano-cyber"><br>
        <b>cobastelano-cyber</b>
      </a><br>
      <sub>@cobastelano-cyber</sub>
    </td>
    <td align="center">
      <a href="https://github.com/FabianzLc">
        <img src="https://github.com/FabianzLc.png?size=100" width="80" alt="FabianzLc"><br>
        <b>FabianzLc</b>
      </a><br>
      <sub>@FabianzLc</sub>
    </td>
    <td align="center">
      <a href="https://github.com/PablitoMix123Bv">
        <img src="https://github.com/PablitoMix123Bv.png?size=100" width="80" alt="PablitoMix123Bv"><br>
        <b>PablitoMix123Bv</b>
      </a><br>
      <sub>@PablitoMix123Bv</sub>
    </td>
  </tr>
</table>
</div>
