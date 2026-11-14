# Heimdall — UI Architecture & Frontend Documentation

> **AI-Powered Dashboard for Spacecraft Fire Safety**  
> *NASA Space Apps Challenge 2024 / Project Heimdall AI*

---

## 1. Executive Summary & Stack Overview

Heimdall is a high-performance web dashboard built to visualize, rank, and synthesize microgravity combustion science from NASA's **Physical Science Informatics (PSI)** repository.

The frontend is implemented under the following stack:
- **Framework:** React 19 (`StrictMode`, functional components, Context API, Hooks)
- **Bundler & Tooling:** Vite 8 (ESM modules, Rollup/Rolldown production builds, HMR)
- **3D Graphics & WebGL:** Three.js, `@react-three/fiber` (R3F), `@react-three/drei`
- **Data Visualization:** Recharts (responsive SVG charts with dual axes, areas, and scatter boundaries)
- **Styling Architecture:** Pure CSS Design Tokens (`tokens.css` + `global.css`) without heavyweight utility dependencies, delivering a sub-millisecond dark-space theme.
- **Routing:** React Router v7

---

## 2. Directory Structure

```
frontend/
├── public/
│   ├── favicon.png
│   └── models/
│       └── planetas/               # GLB assets exported from Blender
│           ├── Sol.glb
│           ├── Mercurio.glb
│           ├── Venus.glb
│           ├── Tierra.glb
│           ├── Luna.glb
│           ├── Marte.glb
│           ├── Jupiter.glb
│           ├── Saturno.glb
│           ├── Urano.glb
│           └── Neptuno.glb
└── src/
    ├── assets/                     # Static imagery and SVG assets
    ├── components/
    │   ├── charts/
    │   │   ├── FlammabilityChart.jsx  # Recharts scatter/boundary envelope
    │   │   └── TimeSeriesChart.jsx    # Dual-axis temperature & heat flux
    │   ├── layout/
    │   │   └── AppLayout.jsx          # Header, navigation, audience toggle & telemetry footer
    │   ├── three/
    │   │   ├── SolarSystemScene.jsx   # R3F Canvas, orbit loops, camera lerp controller
    │   │   ├── PlanetModel.jsx        # useGLTF loader, axial spin & selection rings
    │   │   └── FlameVisualization.jsx # Procedural 0g (spherical) & 1g (teardrop) flames
    │   └── ui/
    │       ├── ScenarioHUD.jsx        # Floating mission scenario switcher (ISS, Moon, Mars)
    │       └── CopilotChat.jsx        # RAG chat assistant with dataset citation links
    ├── context/
    │   └── AppContext.jsx             # Global state: scenario, audience, category, weights
    ├── hooks/
    │   └── useApi.js                  # Asynchronous data fetching & state handler
    ├── pages/
    │   ├── MissionHub.jsx             # Split-screen dashboard with slidable drawer
    │   ├── StudyDetailPage.jsx        # Investigation telemetry breakdown (Saffire-III, etc.)
    │   ├── Flame3DPage.jsx            # 0g vs 1g combustion morphology comparison
    │   ├── ComparePage.jsx            # Multi-experiment correlation matrix & Earth spin-offs
    │   └── NotFoundPage.jsx           # 404 Route fallback
    ├── services/
    │   ├── api.js                     # REST API client (Node / FastAPI)
    │   └── mockData.js                # Structured NASA PSI datasets & ranking engine
    ├── styles/
    │   ├── tokens.css                 # CSS variables (colors, fonts, radii, shadows)
    │   └── global.css                 # Base resets, badges, buttons, scrollbars
    ├── App.jsx                        # Route configuration
    └── main.jsx                       # Application entry point & Context Provider
```

---

## 3. Design System & Visual Tokens

Heimdall adopts a **deep space telemetry aesthetic**, featuring muted pastel accents, strict monochrome background hierarchies, and zero visual saturation to avoid eye fatigue during flight telemetry analysis.

### Color Palette (`tokens.css`)

| Token | Value | Semantic Meaning |
|---|---|---|
| `--color-bg` | `#060a14` | Primary viewport background (deep void) |
| `--color-surface` | `#0d1321` | Base card and container surface |
| `--color-surface-2` | `#111827` | Elevated containers, buttons, and HUD panels |
| `--color-border` | `#1c2640` | Subtle structural dividers |
| `--color-border-light` | `#2a3654` | Active borders and focus indicators |
| `--color-accent` | `#4f8ef7` | Primary interface blue / active selection |
| `--color-cyan` | `#38bdf8` | Flight telemetry highlights, 0g flame, match scores |
| `--color-green` | `#34d399` | Nominal system status, telemetry health, verification |
| `--color-amber` | `#f59e0b` | Scientific calibration notices, 1g flame, O₂ warnings |
| `--color-rose` | `#fb7185` | Extinction boundaries, radiant flux peaks |

### Typography

- **Interface Body & Headings:** `Inter`, system-ui (`400`, `600`, `700`, `800`)
- **Telemetry & Technical Specs:** `JetBrains Mono`, `Consolas`, monospace (`400`, `700`)
  - Used for dataset IDs, coordinates, sensor readouts, ratios, and all telemetry labels with `letter-spacing: 0.5px - 1px`.

---

## 4. Navigation & Global Layout (`AppLayout.jsx`)

The layout shell wraps all pages and remains persistently fixed:

1. **Top Navigation Bar (Height: 52px):**
   - **Brand:** `HEIMDALL` + badge `ORBITAL AI` + subtitle `SPACECRAFT FIRE DYNAMICS`.
   - **Navigation Tabs:**
     - `MISSION HUB` (`/`)
     - `STUDY DETAIL` (`/study/saffire-iii`)
     - `FLAME 3D` (`/flame-3d`)
     - `COMPARE & EARTH` (`/compare`)
   - **Audience Mode Switcher (`Student` | `Engineer`):** Updates global context to tailor AI summaries and technical density.
   - **Copilot Button (`✦ ASK HEIMDALL AI`):** Toggles the floating chat assistant from anywhere in the app.
   - **User Avatar Placeholder:** Indicating investigator profile.

2. **Telemetry Footer Bar (Height: 28px):**
   - Left: `NASA Space Apps Challenge // Project Heimdall AI`
   - Right: Real-time status `● Telemetry Stream Nominal` + Mission Elapsed Time `MET: 042:18:09:22`.

---

## 5. Core Views & Component Breakdown

### 5.1 Mission Hub (`/`)

The primary operational dashboard, designed with a dynamic split-screen layout:

#### Left Analytical Panel (Slidable & Adaptable)
- **Collapsible Architecture:** Contained inside a sliding drawer with CSS `transform: translateX(-100%)` and width interpolation (`transition: 0.4s cubic-bezier(0.16, 1, 0.3, 1)`).
- **Controls:**
  - Header button: `« Hide Panel`
  - Vertical border tab: Fixed at `left: 0px`, labeled `« HIDE PANEL` / `» TELEMETRY`
  - Floating 3D HUD pill: `» Show Telemetry` appears when collapsed.
- **Regime Header:** Displays active scenario telemetry (`LB-01`, `0.166g`, `10.2 psi`, `Elevated O₂ (34%)`).
- **Scientific Notice Banner:** Warning emphasizing that NASA PSI lacks partial-gravity data, bounding all predictions between 0g and 1g limits.
- **Interactive Controls:**
  - Category filters: `ALL`, `PREVENTION`, `DETECTION`, `SUPPRESSION`.
  - Expandable Algorithm Bias Weights (`Oxygen Conc`, `Pressure`, `Airflow`, `Fuel Type`, `Gravity`).
- **Ranked Investigation Cards:**
  - Experiment name (`Saffire-III`, `BASS-II`, `ACME`) with facility badge and match score (`● 94% Match`).
  - Multi-segment stacked score bar breaking down individual factor contributions.
  - Persona-adaptive AI summary (`Student` vs `Engineer`).
  - Dataset links routing directly to `/study/:id`.

#### Right 3D Planetary Simulation
- **React Three Fiber Canvas:** Rendered using real `.glb` models loaded from `/public/models/planetas/`.
- **Dynamic Camera Adaptation:**
  - **Panel Open:** Camera offsets rightward (`target: [4, 0, 0]`, `position: [14, 18, 28]`) to balance the left analytical panel.
  - **Panel Collapsed:** Canvas expands to 100% and camera automatically re-centers to `[0, 0, 0]` with position `[0, 18, 30]`.
- **Smooth Planetary Camera Lerp (Toggle Zoom In / Zoom Out):**
  - Clicking any 3D planet or top bar chip (`MERCURY` through `NEPTUNE`) executes an exponential damped lerp focusing that planet at a calibrated inspection distance (`zoomDist = Math.max(1.8, size * 3.6)`).
  - Pauses orbital revolution while maintaining axial rotation and activating a glowing target ring.
  - **Free 360° Inspection:** Once the camera arrives (or on user drag), OrbitControls seamlessly handles free rotation around the planet without constraint fighting.
  - Clicking the same planet or `⟳ Reset View / Zoom Out` returns smoothly to the solar system overview.
- **Earth-Moon Compound Hierarchy:** The Moon is parented to Earth's orbital coordinate system, orbiting Earth at distance 1.4 with its own orbit ring.
- **Scenario HUD:** Bottom-left floating glassmorphic panel to switch scenarios (`ISS / Earth`, `Lunar Base`, `Rover`, `Spacesuit`, `Mars`).
- **Inline Copilot:** Bottom-right floating assistant with preloaded RAG queries and clickable dataset citations.

---

### 5.2 Study Detail (`/study/:id`)

The technical investigation dossier (e.g. `Saffire-III`, `BASS-II`):

1. **Mission Header & Badges:**
   - Archive reference (`EXP-SAFFIRE-03`), mission name, duration, and verification badge (`VERIFIED FLIGHT DATA (NASA GLENN RC)`).
   - Fuel tags (`PMMA Solid Sample (0.4m × 1.0m)`, `Microgravity (10⁻⁴ g)`, `Forced Convection Duct`).
2. **AI Synthesis & Extracted Metric Envelope (2x2 Grid):**
   - `01 // MISSION OBJECTIVE`: Investigation goals and uncrewed vehicle context.
   - `02 // FUEL & GEOMETRY`: Material specs (PMMA thickness, dimensions, ignition setup).
   - `03 // TEST CONDITIONS`: Pressure, oxygen range, flow rates.
   - `04 // TELEMETRY ARRAY`: Calibrated radiometers, thermocouples, UV/IR cameras.
   - `⚡ HEIMDALL INSIGHT`: Highlight box describing critical transition kinetics.
3. **Regime Flammability Boundary Chart (`FlammabilityChart.jsx`):**
   - Recharts scatter plot of forced flow velocity $u_\infty$ (0 to 0.40 m/s) vs. ambient O₂ % (12% to 38%).
   - Displays Saffire-III 0g Boundary line, extinction limits, shaded flammable zone, and Lunar Base Habitat specification reference point.
4. **Radiant Flux & Pyrolysis Temperature vs. Time (`TimeSeriesChart.jsx`):**
   - Recharts dual-axis composed chart:
     - Left Axis (Blue line): Thermocouple array temperature (0 to 950 °C).
     - Right Axis (Rose dashed line): Radiant heat flux (0 to 50 kW/m²).
   - Annotated Reference Dots at critical peaks (`Peak 1: Ignition & Flashover` at +78s, `Peak 2: Sustained Steady Peak` at +195s).
5. **Reduced-Gravity Extrapolation Card:**
   - Outlines mathematical limitations of scaling 0g Cygnus data to Lunar 0.166g.
   - CTAs: `📥 Download Raw Telemetry (HDF5 / CSV)`, `⚡ Send Boundary to 3D Flame Simulation`, and `● OVERLAY TERRESTRIAL 1G BASELINE`.

---

### 5.3 Flame 3D (`/flame-3d`)

A qualitative comparative combustion morphology testbench:

1. **Microgravity Flame (0g) Panel:**
   - Procedural WebGL flame rendered as a symmetric, cooler dim blue sphere ($CH^*$ chemiluminescence, pure radicals, diffusion-dominated).
   - Telemetry readouts: Buoyancy vector ($0.00\text{ m/s}^2$), soot radiation ($\sim 0.1\%$), radial expansion ($17.7\text{ mm}$), core temperature ($643^\circ\text{C}$).
2. **Earth Gravity Flame (1g) Panel:**
   - Procedural WebGL flame rendered as an elongated incandescent yellow/orange teardrop (buoyancy-induced convection, soot radiation).
   - Telemetry readouts: Buoyancy vector ($9.81\text{ m/s}^2$), upward draft ($1.8\text{ m/s}$), flame height ($25.5\text{ mm}$), core temperature ($958^\circ\text{C}$).
3. **Aerospace Testbench Parameters & Convection Controls:**
   - **Oxygen Concentration Slider:** 15.0% (Hypoxic) to 40.0% (Max). Reactively scales flame diameter and luminosity.
   - **Forced Ventilation (Airflow) Slider:** 0.00 m/s (Still) to 0.30 m/s (Turbulent). Dynamically elongates convective flame geometry.
   - **Gravity Vector Field Selector:** Toggle between `0g ISS`, `0.166g Moon`, `0.38g Mars`, and `1g Earth`.
   - Control actions: `⟳ RESET BASELINE` and `📥 EXPORT TELEMETRY (HDF5)`.

---

### 5.4 Compare & Earth (`/compare`)

Cross-experiment parametric synthesis and terrestrial technology transfer:

1. **Microgravity Experiment Comparison Matrix:**
   - Multi-study comparative table across 5 parametric axes:
     - *Study & Testbed* (`Saffire-III`, `BASS-II`, `FLEX-2`)
     - *Oxygen Conc. (% O₂)*
     - *Ambient Pressure (psi / kPa)*
     - *Fuel & Geometry*
     - *Critical Regime Behavior*
   - Toggle button: `● Differential Highlight Active` to emphasize boundary discrepancies.
2. **Cross-Findings Cards:**
   - Highlights cross-study discoveries: *Oxygen Threshold Delta*, *Pressure Quench Divergence*, and *Zero-Buoyancy Stagnation*.
3. **Earth Spin-Off Applications:**
   - Direct translation of microgravity physics to public safety codes:
     - **Water Mist Suppression (`NSF // SPIN-758`):** Ultra-fine water mist derived from droplet kinetics for Halon replacement in data centers and maritime hulls (`NFPA 750`).
     - **Early Smoke Detection (`NSG // SPIN-429`):** Sub-micron soot detection detecting pyrolysis aerosols up to 15 min prior to open ignition in mines and transit tunnels (`NIOSH`).
     - **Firefighter Protective Gear (`SAT // SPIN-1071`):** Heat flux models and char-layer pyrolysis measurements optimizing lightweight thermal suits (`NFPA 1971`).

---

## 6. State Management (`AppContext.jsx`)

Global application state is orchestrated using a lightweight React Context provider:

```javascript
const value = {
  scenarioKey,       // 'iss' | 'lunarBase' | 'rover' | 'spacesuit' | 'mars'
  scenario,          // Scenario metadata (label, code, gravity, O2%, pressure)
  setScenarioKey,
  audience,          // 'Student' | 'Engineer'
  setAudience,
  category,          // 'all' | 'prevention' | 'detection' | 'suppression'
  setCategory,
  chatOpen,          // boolean (global floating copilot state)
  setChatOpen,
  focusPlanet,       // null | string (active 3D inspected planet)
  setFocusPlanet,
  weights,           // Algorithm bias weights object
  setWeights,
};
```

---

## 7. Mathematical & Animation Architecture

### Damped Exponential Camera Lerp
To prevent frame-rate dependent animation stutter across 60Hz and 144Hz monitors, camera target interpolation utilizes the exact exponential decay formula:

$$\alpha = 1 - e^{-\lambda \cdot \Delta t}$$

where $\lambda = 4.5$ is the damping constant and $\Delta t$ is the frame delta time in seconds.

### View Angle Decoupling
To allow the investigator to rotate 360° around a planet after zooming in:
1. `isTransitioningRef` tracks flight travel.
2. During travel, `camera.position.lerp(targetCamPos, \alpha)` and `controls.target.lerp(worldPos, \alpha)` fly to the target.
3. Upon arrival (or immediately when the user initiates a mouse drag), `isTransitioningRef` flips to `false`.
4. Thereafter, `controls.target` continuously copies `worldPos`, giving `OrbitControls` free rotational authority around the planet without clamp conflicts.

---

## 8. Verifying & Running the Frontend

To start the interface locally:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173/` in any modern WebGL2-enabled browser. Production builds are validated via `npm run build`.
