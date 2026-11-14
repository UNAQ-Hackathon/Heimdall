# Climate Trend Predictor

A Python tool that answers two questions from a historical temperature series (or another suitable time-series variable):

1. **What has the variable done so far?** Estimate the historical trend and assess its statistical significance.
2. **What may happen next?** Forecast future periods and classify the change as increasing, decreasing, or stable.

Originally developed for the UNAQ hackathon using NASA and Mexico's National Meteorological Service (SMN/CONAGUA) data. It is now an independent Python package within Heimdall's analytics workspace.

> The bundled benchmarks concern Earth's climate. They do not validate forecasts of combustion, partial gravity, or planetary habitat fire risk. The existing FastAPI trend and flammability endpoints remain separate scaffolds.

## Trend Analysis

### Historical trends

The tool fits a line to the full series and reports its slope (°C per decade for monthly and annual series).

| Output value | Meaning |
|---|---|
| `ascendente` / `descendente` | Significant increasing / decreasing slope (p < 0.05). |
| `sin evidencia suficiente` | Insufficient evidence to distinguish the slope from noise. |
| `exploratoria` | Exploratory estimate: short, incomplete, hourly, or daily series; no significance claim. |

For monthly and annual series spanning at least 30 years with 80% coverage, it also calculates:

- A 95% confidence interval and p-value using Newey–West standard errors to account for serial correlation.
- Monthly fixed effects for monthly data to separate seasonality from the trend.
- Kendall's tau and Sen's slope for annual data as nonparametric checks.

### Forecasting changes

The main model is **k-nearest neighbors regression (KNN)**. Instead of directly predicting temperature, it learns changes observed in similar past situations and adds the estimated change to the latest observation. A separate model is fitted for each horizon using only information available at each forecast origin.

Each forecast includes the expected value, direction relative to its reference, and a nominal 90% interval based on past forecast errors when enough calibration errors exist.

### Chronological evaluation

The first 60% of the series provides initial history, the next 20% selects KNN settings, and the final 20% measures error. Reports include MSE and directional accuracy, compared with linear regression and persistence. The original temperature benchmark targets MSE ≤ 0.9 °C²; this threshold is not a universal criterion for other variables or units.

## Recorded Results

These are results reported by the original project, not newly validated performance claims.

| Series | Horizon | KNN MSE (°C²) | Directional accuracy | Target ≤ 0.9 °C² |
|---|---|---:|---:|---|
| Annual NASA GISTEMP, global, 1880–2025 | 1–5 years | 0.0189 | 66.0% | Met |
| Chicago O'Hare hourly | 1 hour | 0.7701 | 57.7% | Met |
| Chicago O'Hare daily | 1–3 days | 18.4562 | 95.2% | Above target |

The daily Chicago test uses only March 2014, with 5–7 evaluated forecasts per horizon, so its high error is not conclusive.

### Mexico: 32 states through 2032

Monthly SMN data is aggregated into annual temperatures for 1985–2025. A shared KNN learns from all 32 states.

| Model | Mean seven-year MSE (°C²) | States with MSE ≤ 0.9 °C² |
|---|---:|---:|
| Shared KNN | 0.5365 | 26 of 32 |
| Local KNN | 0.7558 | 24 of 32 |
| Linear regression | 0.6177 | 27 of 32 |
| Persistence | 0.7646 | 22 of 32 |

A second iteration (`--iteracion 2`) uses five-year means, reporting annual MSE of 0.4927 °C² and 77.4% directional accuracy. Its five-year trend compares observed 2021–2025 means with forecast 2028–2032 means. Each state report includes the 2032 forecast, change from the latest observed year, anomaly relative to 1991–2020, and historical slope significance.

## Installation and Usage

Run from the repository's `analytics/` directory:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt

# NASA GISTEMP: five years ahead
python -m predictor --salida /tmp/heimdall-gistemp

# Custom CSV with date and value columns
python -m predictor --csv my_series.csv --frecuencia monthly --fecha date --valor value --unidad '°C' --horizonte 12 --salida /tmp/heimdall-region

# Mexico forecasts and charts
python -m predictor.mexico_2032
python -m predictor.plots.graficar_mexico

# Second iteration
python -m predictor.mexico_2032 --iteracion 2
python -m predictor.plots.graficar_mexico --resultados predictor/resultados/mexico_iteracion_2 --salida /tmp/heimdall-mexico-charts
```

`python -m predictor --help` lists all options. Supported frequencies: `hourly`, `daily`, `monthly`, `annual`. Original Spanish CLI flags and output keys are retained for compatibility with the supplied datasets, reports, and plotting scripts. Mexico's default commands regenerate the corresponding bundled results; use their `--help` options to select alternative output locations.

## Outputs

| File | Contents |
|---|---|
| `tendencia.png` | Observations, fitted trend, and forecast. |
| `pronostico.csv` | Forecast value, direction, and nominal 90% interval by future period. |
| `validacion.csv` | Predictions versus observations by origin and horizon. |
| `resumen.json` | Historical trend, KNN settings, errors, and directional accuracy. |

For Mexico, `resultados/mexico*/` contains `resumen.csv`, `pronosticos.csv`, `validacion.csv`, `historial.csv`, and `configuraciones.csv`. `plots/` contains a 32-state panel and individual state PNGs. Original report contents, labels, and filenames remain unchanged for reproducibility.

## Package Layout

| Path | Responsibility |
|---|---|
| `predictor.py` | Single-series historical trend, validation, forecast, and CLI. |
| `climate_knn.py` | Horizon-specific change-based KNN. |
| `climate_data.py` | GISTEMP, NOAA LCD, and generic CSV loading. |
| `climate_plot.py` | Trend and forecast charts. |
| `mexico_2032.py` | Mexico's 32-state forecasting workflow. |
| `plots/` | Plotting modules and original chart artifacts. |
| `data/` | Bundled GISTEMP and SMN CSVs. |
| `resultados/` | Original benchmark reports. |

## Scope

Forecasts are **statistical extrapolations**, not physical climate simulations. Reliability depends on available history and series-specific error. Mexico's evaluation window contains only nine years, so its results describe that evaluated period.

See [technical documentation](README_TECNICO.md) for methodology, NOAA samples, and Giovanni guidance.

## Data Sources

- [NASA GISTEMP v4](https://data.giss.nasa.gov/gistemp/) · [Lenssen et al. (2024)](https://doi.org/10.1029/2023JD040179)
- [SMN/CONAGUA](https://smn.conagua.gob.mx/es/component/content/article?id=33), via [DataMX](https://www.datamx.io/en/dataset/temperaturas-mensuales-en-mexico-1985-2025/resource/917506fc-a09d-4e81-9d75-5e1f11bf1a14)
- [NOAA LCD](https://www.ncei.noaa.gov/) (Chicago O'Hare, March 2014)
