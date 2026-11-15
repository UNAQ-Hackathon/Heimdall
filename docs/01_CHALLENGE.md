# 01 — Challenge and Requirements

## The challenge (NASA Space Apps)

For decades NASA has studied how flames and fire behave in microgravity,
accumulating a large body of experimental data. That knowledge matters more
than ever as humans prepare to return to the Moon and press on to Mars — yet
the volume of results makes findings hard to locate, compare, and interpret.

**Goal:** build an interactive, super-intelligence-powered web dashboard that
summarizes, ranks, and interprets combustion-science investigations from NASA's
Physical Science Informatics (PSI) database to deliver foundational fire-safety
insights for human space exploration.

## Why fire safety in space is different

- In microgravity there is no buoyancy, so hot gases do not rise. A candle
  flame becomes a blue sphere fed by diffusion rather than convection.
- NASA's fire-safety research targets three pillars: **prevention**
  (material flammability limits, ignition control), **detection** (smoke and
  aerosol sensing), and **suppression** (extinguishment).
- Planned Moon bases and pressurized rovers are expected to run enriched
  oxygen atmospheres (>= 30% O2) at reduced pressure (<= 10.2 psi) — a >40%
  increase in oxygen concentration over Earth air, which makes materials far
  more flammable. EVA suits run 100% O2 at 4.3 psi; the ISS stays near
  21% O2 / 14.7 psi.
- No partial-gravity combustion data exists in PSI yet; microgravity (0g) and
  Earth (1g) results bound the intermediate regimes (Moon 0.165g, Mars 0.38g).

## Hardware referenced by the brief

| Facility | Investigations |
|---|---|
| CIR / ACME modular hardware | 6 gaseous-flame studies (E-FIELD Flames, BRE, Flame Design, CFI-G, s-Flame, SoFIE) |
| CIR / MDCA (droplet apparatus) | FLEX, FLEX-2, CFI — liquid droplet combustion; CO2/He suppression |
| MSG + SPICE flow duct | BASS, BASS-II, SPICE, SLICE — solid and gaseous fuels |
| MSG aerosol instruments | SAME, SAME-R (smoke); DAFT, DAFT-2 (dust re-use of the SAME Pegasor) |

## Requirement → implementation mapping

| Challenge objective | Heimdall feature | Where |
|---|---|---|
| Summarize investigations | PSI Catalog cards, per-study detail pages, deterministic digests | `/studies`, `/study/:id` |
| Rank by mission relevance | Transparent multi-factor ranking engine (atmosphere, gravity, data richness, documentation) | `POST /api/ranking`, catalog UI, `rank_investigations` tool |
| Interpret findings | Agentic copilot with real tool calls; FireHazR interpretation briefs | Copilot dock, `POST /api/analytics/firehazr/interpret` |
| Identify studies relevant to habitable crew environments | Five mission scenarios (Earth, ISS, Moon base/rover, Mars base, spacesuit) that drive ranking and regime coverage | ScenarioContext, `scenarios.js` |
| Extract data for predictive modeling | CSV export of selected studies and the full matrix; FireHazR KNN predictor | Compare page exports, `/flame` |
| Next-generation fire safety controls | Earth Spin-Off section tracing microgravity findings to water-mist suppression, multi-criteria smoke detection, and material screening standards | `/compare` (Earth tab) |
| Compare similarities/differences | Side-by-side aligned comparator, "Show Differences Only", parametric conditions matrix, O2–pressure regime map | `/compare` |

## Scientific constraints the implementation enforces

1. **FireHazR predicts only what the KNN FLEX v3 model measured:**
   recorded microgravity droplet burn duration. It never outputs fire
   probability, safety scores, ignition limits, planetary combustion, or
   suppressant effectiveness.
2. **Coverage gate preserved.** Queries outside the trained envelope abstain
   (`duracion_estimada_s: null` + reason) rather than forcing an estimate.
   Argon and xenon are unsupported diluents.
3. **Planets never infer conditions.** The 3D solar-system viewer and the
   predictor are decoupled — selecting Mars does not inject values into the
   algorithm; atmospheric inputs must be entered explicitly.
4. **Partial-gravity honesty.** The UI presents 0g and 1g as bounding regimes
   and labels LUCI/FM2 as upcoming; it never fabricates lunar-g results.
