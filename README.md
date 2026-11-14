<div align="center">

  <img src="docs/assets/nasa-logo.png" alt="NASA Logo" height="105">
  &nbsp;&nbsp;&nbsp;
  <img src="docs/assets/heimdall-logo.png" alt="Heimdall Logo" height="110">
  &nbsp;&nbsp;&nbsp;
  <img src="docs/assets/unaq-logo.png" alt="UNAQ Logo" height="105">

# Heimdall

### AI-Powered Dashboard for Spacecraft Fire Safety

[![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB_Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Devin SWE](https://img.shields.io/badge/Devin_SWE-5A29E4?style=flat-square)](https://devin.ai)
[![NASA PSI](https://img.shields.io/badge/NASA_PSI-0B3D91?style=flat-square)](https://psi.nasa.gov/)
[![Blender](https://img.shields.io/badge/Blender-F5792A?style=flat-square&logo=blender&logoColor=white)](https://www.blender.org/)

<p align="center">
  An interactive, AI-driven dashboard that summarizes, ranks, and interprets decades of NASA
  microgravity combustion experiments to support fire safety in human space exploration.
</p>

<p align="center">
  <em>Named after Heimdall, the ever-watchful guardian of the Bifrost who sees and hears all —
  this dashboard watches over decades of combustion data so nothing critical goes unseen.</em>
</p>

</div>

---

## The Problem

Fire inside a spacecraft or space habitat is one of the most critical threats to a mission — Apollo 1, the fire aboard the Mir space station, and the smoke alarm during Artemis II are stark reminders. In microgravity, flames behave in ways that defy Earth-bound intuition: without buoyancy, a candle flame collapses into a blue sphere sustained only by oxygen diffusion.

NASA has spent decades studying fire prevention, detection, and suppression aboard the ISS (BASS, Saffire, SAME, FLEX, ACME, CFI, SPICE, SLICE, and more), publishing results in the **Physical Science Informatics (PSI)** database. The problem: there is so much data that it is hard to **find, compare, and interpret**.

On top of that, future lunar habitats and pressurized rovers will operate with **oxygen-enriched atmospheres (≥30% O₂) at reduced pressure (≤10.2 psi)** — conditions that make materials far more flammable. Knowing which investigations are relevant to those regimes is critical.

---

## What It Does

- **Ranks** investigations by relevance to a mission scenario (ISS, lunar base, pressurized rover, spacesuit, Mars), with adjustable weights and a transparent score breakdown.
- **Summarizes** each investigation with AI: objective, fuel, test conditions, variables, and sensors.
- **Detects trends, peaks, and drops** in data series through a Python analytics engine.
- **Generates flammability maps** (O₂ vs. flow velocity) with uncertainty intervals.
- **Compares** investigations side by side.
- **Answers natural-language questions** with citations to the source data (RAG over the dataset).
- **Visualizes in 3D** space habitats and the difference between a microgravity flame and a 1g flame.
- Surfaces **spin-off applications on Earth** (water mist suppression, smoke detectors, firefighting equipment).

---

## Design Principles

- **Scientific honesty:** PSI does not yet contain partial-gravity data. We present microgravity and 1g results as *bounds*, never as point predictions.
- **The AI never invents numbers:** the model only writes prose using values that come from the database or the analytics engine, and explicitly states when data is missing.
- **Transparency:** every score and every prediction ships with its breakdown or its uncertainty.

---

## Architecture

```
NASA PSI → Ingestion → MongoDB Atlas ←→ Node.js API ←→ FastAPI (analytics)
                                              ↓
                                    Devin API (SWE model)
                                    summaries / chat
                                              ↓
                              React + Three.js dashboard
```

### Technology Stack

| Layer | Technologies |
|---|---|
| **Design** | Figma |
| **3D Models** | Blender (+ Blender MCP) → glTF |
| **Frontend** | React, Vite, Three.js, Recharts / Plotly |
| **API** | Node.js |
| **AI** | Devin API — SWE model (summarization, ranking rationale, chat) |
| **Analytics** | Python, FastAPI, NumPy, pandas, SciPy |
| **Data** | MongoDB Atlas + Vector Search |
| **Deployment** | Vercel, Render / Railway, MongoDB Atlas |

---

## Audience

Students, educators, researchers, and aerospace engineers — with explanations that adapt to each user's level of expertise.

---

## Repository Structure

```
/frontend   /api   /analytics   /data   /assets3d   /docs
```

> 📖 **Frontend Architecture & UI Specification:** See [`docs/UI_ARCHITECTURE.md`](docs/UI_ARCHITECTURE.md) for full component breakdown, mathematical lerp formulas, 3D interaction models, and styling tokens.

---

## Limitations

- PSI contains no partial-gravity data; lunar-regime results are presented as bounded ranges.
- The flame visualization is a qualitative illustration, not a physics simulation.
- Rocket and propellant combustion are outside the scope of PSI.

---

## The Challenge

Built for the NASA hackathon at **Universidad Aeronáutica en Querétaro (UNAQ)**:

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
