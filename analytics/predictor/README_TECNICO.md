# Climate Trend Predictor — Technical Documentation

Python historical trend estimation and change-direction forecasting with k-nearest neighbors regression (KNN). The default example uses NASA GISTEMP v4 annual global temperature anomalies for 1880–2025, in °C relative to 1951–1980. The bundled series uses the annual J-D column from the table accessed on November 13, 2026.

[NASA GISTEMP v4](https://data.giss.nasa.gov/gistemp/) · [Original NASA table](https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts%2BdSST.txt) · [Lenssen et al. (2024)](https://doi.org/10.1029/2023JD040179)

## Integration and Installation

The predictor lives in `analytics/predictor/`. Run commands from `analytics/` so Python can resolve package-relative imports. Dataset paths are resolved relative to the package, not the current working directory. The model and original report schemas have been preserved. CLI options, CSV headers, JSON keys, and archived chart labels retain their original Spanish names for compatibility.

```bash
python -m pip install -r requirements.txt
python -m predictor --salida /tmp/heimdall-gistemp
```

For a custom series, supply its path and exact column names. This example forecasts 12 months starting with observations from January 1991:

```bash
python -m predictor --csv my_series.csv --frecuencia monthly --fecha date --valor value --unidad '°C' --etiqueta 'Regional mean temperature' --horizonte 12 --desde 1991-01 --salida /tmp/heimdall-region
```

A generic CSV has one row per period, with dates such as `2020`, `2020-01`, `2020-01-15`, or `2020-01-15T13:00`, depending on frequency. Use a decimal point and leave missing observations blank. If several stations appear in `STATION`, select one with `--station ID`.

`--horizonte` is measured in hours, days, months, or years according to `--frecuencia`. KNN is the default; `--modelo regresion` selects linear regression and `--modelo referencia` selects persistence. Run `python -m predictor --help` for all options.

The requirements constrain pandas to version 2 because the original model uses its annual PeriodIndex frequency representation (`Y-DEC`). Matplotlib and scikit-learn are included through `predictor/requirements.txt`.

## Output Files

| File | Contents |
|---|---|
| `tendencia.png` | Observations, fitted trend, and forecast. |
| `pronostico.csv` | Forecast values and directions by period, with estimated intervals when enough past errors exist. |
| `validacion.csv` | Predictions, observations, and change direction by origin and horizon. |
| `resumen.json` | Trend, KNN configuration, MSE in squared input units, directional accuracy, and forecast counts by horizon. |

## Reported KNN Results

| Series | Horizon | KNN MSE (°C²) | Directional accuracy | Target ≤ 0.9 °C² |
|---|---|---:|---:|---|
| Annual NASA GISTEMP | 1–5 years | 0.0189 | 66.0% | Met |
| Chicago O'Hare hourly | 1 hour | 0.7701 | 57.7% | Met |
| Chicago O'Hare daily | 1–3 days | 18.4562 | 95.2% | Above target |

Linear regression achieved GISTEMP MSE of 0.0123 °C². At a one-hour horizon in Chicago, persistence achieved 1.2210 °C². Both Chicago examples use March 2014 weather observations. The daily test contains only 5–7 evaluated forecasts per horizon. These figures are the original project's reported benchmarks; the temperature-specific MSE target must not be generalized to other units.

## External NOAA Samples

The original documentation refers to these external sample files; they are not bundled in this repository:

| File | Observed coverage |
|---|---|
| `LCD_sample_csv.csv` | Chicago O'Hare, March 2014: 742 hourly FM-15 temperature readings in °C, allowing 31 daily means. |
| `gsoy_sample_csv.csv` | One annual 2015 record for each of two New York stations. |
| `Marine_CSV_sample.csv` | 55 observations in January 2015 from a moving ship; sea-surface temperature is empty. |
| `PRECIP_15_sample_csv.csv` | 158 fifteen-minute precipitation records from January 1984 in Cataloochee, North Carolina; HI means hundredths of an inch. |
| `PRECIP_HLY_sample_csv.csv` | Three hourly precipitation records from January 1–2, 2010, in Asheville, North Carolina; one contains code 99999. |

Use `--lcd` to reproduce the Chicago examples. The reader uses `HourlyDryBulbTemperatureC` from FM-15 records and requires at least 18 distinct valid hours per day for daily aggregation.

```bash
python -m predictor --csv ~/Downloads/LCD_sample_csv.csv --lcd --frecuencia hourly --horizonte 1 --salida /tmp/heimdall-lcd-hourly
python -m predictor --csv ~/Downloads/LCD_sample_csv.csv --lcd --horizonte 3 --salida /tmp/heimdall-lcd-daily
```

The other samples contain too few comparable periods or changing locations. Precipitation analysis also requires checking units and missing/accumulated-value flags before computing totals.

[NOAA 15-minute precipitation documentation](https://www.ncei.noaa.gov/pub/data/cdo/documentation/PRECIP_15_documentation.pdf)

## Regional Giovanni Series

1. In [NASA Giovanni](https://giovanni.gsfc.nasa.gov/giovanni/), choose **Area-Averaged Time Series**, a monthly variable, a fixed region, and several decades of coverage. Download CSV. See the [Giovanni guide](https://giovanni.gsfc.nasa.gov/giovanni/doc/UsersManualworkingdocument.docx.html).
2. Keep a date column and the variable column. If metadata precedes the header, preserve it separately and make the header the first CSV row. Retain the product, region, and original units for provenance.
3. Use one row per month. Leave product-defined missing values blank. Convert absolute temperature from kelvin to °C by subtracting 273.15; for anomalies, a 1 K difference equals a 1 °C difference.
4. Run `python -m predictor` with `--frecuencia monthly`, matching `--fecha` and `--valor` column names, and the chosen `--unidad`.

## Mexico: 32 States Through 2032

`data/mexico_smn_mensual.csv` is the DataMX CSV of SMN/CONAGUA monthly summaries. The copy downloaded on November 13, 2026 contains January 1985–October 2026. The analysis uses MEDIA (°C), excludes the national row, and weights monthly means by days per month to obtain annual means. It uses 41 complete years per state, 1985–2025.

[SMN/CONAGUA](https://smn.conagua.gob.mx/es/component/content/article?id=33) · [DataMX record](https://www.datamx.io/en/dataset/temperaturas-mensuales-en-mexico-1985-2025/resource/917506fc-a09d-4e81-9d75-5e1f11bf1a14) · [Original CSV](https://datamx.io/dataset/af0e01e5-7867-44bc-84ac-0b31573aa0ae/resource/917506fc-a09d-4e81-9d75-5e1f11bf1a14/download/data.csv)

```bash
python -m predictor.mexico_2032
python -m predictor.plots.graficar_mexico
```

Default commands regenerate the corresponding bundled results. Check `--help` to choose a separate destination.

Each horizon from one to seven years has its own KNN fit. Shared KNN pools examples from all states and learns change from the origin year. Inputs are deviations from each state's trailing ten-year mean and changes from the previous three years. Local KNN uses the same inputs with one state's examples.

Neighbor count and weighting are selected using calibration forecasts whose targets end by 2010. For evaluation targets in 2017–2025, each forecast uses only examples already observed by its origin year across all states. The 2025→2032 shared KNN forecast uses 960 historical origin-target pairs, 30 per state.

| Model | Mean seven-year MSE (°C²) | States with MSE ≤ 0.9 °C² |
|---|---:|---:|
| Shared KNN | 0.5365 | 26 of 32 |
| Local KNN | 0.7558 | 24 of 32 |
| Linear regression | 0.6177 | 27 of 32 |
| Persistence | 0.7646 | 22 of 32 |

Each state's seven-year MSE uses nine historical forecasts. `resultados/mexico/resumen.csv` includes 2032 forecasts, changes from the latest observation, anomalies relative to state-specific 1991–2020 means, historical slopes, and errors for all four models. `pronosticos.csv` covers every forecast year through 2032; `validacion.csv` preserves out-of-sample forecasts. The 1991–2020 baseline is for presenting anomalies; historical slopes use the full series and individual state tests.

[WMO climatological normals](https://community.wmo.int/site/knowledge-hub/programmes-and-initiatives/climate-services/wmo-climatological-normals)

`plots/méxico/` contains a common-scale anomaly panel for 32 states and an individual PNG per state in °C. Filenames correspond to CVE_ENT in the summary. Green lines represent statistical extrapolations; reliability depends on each state's history and error.

### Second Iteration

```bash
python -m predictor.mexico_2032 --iteracion 2
python -m predictor.plots.graficar_mexico --resultados predictor/resultados/mexico_iteracion_2 --salida /tmp/heimdall-mexico-charts
```

The shared variant anchors forecasts to each state's five-year mean. It finds neighbors using a mean level over up to ten years, its slope, and the difference between the two means. All windows end at the forecast origin. This variant was selected using seven-year calibration MSE with targets through 2010. Both models are compared on the same nine origins (2010–2018) at a seven-year horizon.

| Metric | Iteration 1 | Iteration 2 |
|---|---:|---:|
| Seven-year annual temperature MSE (°C²) | 0.5365 | 0.4927 |
| Seven-year directional accuracy relative to origin | 72.2% | 77.4% |
| Five-year mean MSE (°C²) | 0.3010 | 0.3144 |
| Five-year mean directional accuracy | 83.3% | 87.5% |

The five-year trend compares the five observed years through the origin against forecast horizons 3–7. The final forecast compares observed 2021–2025 with projected 2028–2032. `resumen.csv` reports both iterations by state, and `comparacion_mse.png` shows where annual error increased or decreased. Historical windows overlap, so these results describe the evaluation period rather than independent trials.

## Statistical Interpretation

- **Historical slope:** least-squares regression, adding calendar-month fixed effects for monthly series. With at least 30 years and 80% coverage, a 95% confidence interval and two-sided p-value use Newey–West errors to accommodate autocorrelation and heteroskedasticity. Annual series also report Kendall's tau and Sen's slope. [Trend tests](https://medium.com/@snp.kriss/statistical-test-methods-to-detect-trends-in-time-series-data-b361a0ec530b) · [Newey and West](https://www.nber.org/papers/t0055) · [Statistical significance](https://www.statsig.com/perspectives/a-comprehensive-guide-to-statistical-significance)
- **KNN:** predicts changes from the origin at each horizon, using the current level and differences from three previous lags. Hourly and monthly data include 24-hour or 12-month cycles. Input scaling and fitting use only origin-target pairs available at that forecast date. Adding predicted changes to the origin value restores original units. [scikit-learn neighbors regression](https://scikit-learn.org/stable/modules/neighbors.html#nearest-neighbors-regression)
- **Evaluation split:** initial 60% history; next 20% for KNN selection by MSE; final 20% for fixed-configuration evaluation using available history at each origin. Mean MSE weights evaluated horizons equally. Counts indicate how many forecasts each model produced.
- **Direction:** accuracy distinguishes increasing, decreasing, and stable values. Monthly changes are relative to the latest available value for the same calendar month; other frequencies use the origin value. If the reference is unavailable, direction is blank.
- **Intervals:** nominal 90% intervals use the 5th and 95th percentiles of signed calibration errors, separately by horizon, requiring at least ten errors. `resumen.json` reports final evaluation coverage. Nominal coverage is not a guarantee.

## Boundaries for Heimdall

The package is reusable for suitable calendar-indexed series, but its supplied validation concerns climate data only. It does not model combustion physics, detect experiment-scale flame peaks, or justify partial-gravity predictions. No new FastAPI endpoint is exposed as part of this organizational integration. Original datasets and archived results remain unchanged.
