"""Detección de tendencias y pronóstico cronológico para series climáticas."""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import kendalltau, t, theilslopes
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, root_mean_squared_error

from .climate_data import FREQUENCIES, load_series
from .climate_knn import KNN_CONFIGS, KnnForecast
from .climate_plot import plot_results


NASA_SERIES = Path(__file__).resolve().parent / "data" / "gistemp_annual.csv"
MODELS = ("knn", "regresion", "referencia")
PER_YEAR = {"M": 12, "Y-DEC": 1}
WINDOW = {"h": 24 * 60, "D": 60, "M": 360, "Y-DEC": 30}
DEFAULT_HORIZON = {"hourly": 1, "daily": 3, "monthly": 12, "annual": 5}
MODEL_LABELS = {"knn": "KNN", "regresion": "Regresión lineal", "referencia": "Persistencia"}
MSE_TARGET = 0.9
DIRECTIONS = {-1: "descendente", 0: "estable", 1: "ascendente"}


def features(index: pd.PeriodIndex, origin: int, months: np.ndarray | None) -> np.ndarray:
    """Usa tiempo de calendario y, para datos mensuales, efectos por mes."""
    elapsed = index.asi8 - origin
    if months is None:
        return elapsed.reshape(-1, 1)
    month_effects = index.month.to_numpy()[:, None] == months[1:]
    return np.column_stack((elapsed, month_effects))


def historical_trend(series: pd.Series) -> tuple[np.ndarray, dict]:
    index = series.index
    frequency = index.freqstr
    months = np.unique(index.month) if frequency == "M" else None
    x = features(index, index[0].ordinal, months)
    y = series.to_numpy()
    model = LinearRegression().fit(x, y)
    span = index[-1].ordinal - index[0].ordinal + 1
    scale = 10 * PER_YEAR[frequency] if frequency in PER_YEAR else 1
    slope = float(model.coef_[0] * scale)
    coverage = len(series) / span
    summary = {
        "pendiente": slope,
        "escala": {"h": "hora", "D": "día"}.get(frequency, "década"),
        "cobertura": coverage,
        "diagnostico": "exploratoria",
        "p_hac": None,
        "ic95_hac": None,
        "rezagos_hac": None,
    }
    if frequency == "Y-DEC":
        tau = kendalltau(index.asi8, y).statistic
        summary["tau_kendall"] = float(tau) if np.isfinite(tau) else None
        summary["pendiente_sen_por_decada"] = float(theilslopes(y, index.asi8).slope * 10)

    # La línea de tendencia representa el nivel ajustado al promediar los
    # efectos de los meses observados. La pendiente excluye el ciclo anual.
    fitted = model.intercept_ + model.coef_[0] * np.arange(span)
    if months is not None:
        fitted += model.coef_[1:].sum() / months.size
    if frequency not in PER_YEAR:
        summary["motivo"] = "Serie horaria o diaria analizada de forma exploratoria."
        return fitted, summary
    if span < 30 * PER_YEAR[frequency] or coverage < 0.8:
        summary["motivo"] = "La prueba requiere 30 años calendario con al menos 80 % de cobertura."
        return fitted, summary

    design = np.column_stack((np.ones(len(y)), x))
    parameters = design.shape[1]
    residuals = y - model.predict(x)
    if np.linalg.matrix_rank(design) < parameters or np.allclose(residuals, 0, atol=1e-12):
        summary["motivo"] = "La serie no permite estimar la incertidumbre de la pendiente."
        return fitted, summary

    # Las filas ausentes aportan cero al producto por rezago. Así un hueco
    # de calendario conserva su duración en la estimación Newey–West.
    lag = max(12 if frequency == "M" else 1, int(4 * (len(y) / 100) ** (2 / 9)))
    scores = np.zeros((span, parameters))
    scores[index.asi8 - index[0].ordinal] = design * residuals[:, None]
    covariance = scores.T @ scores
    for offset in range(1, lag + 1):
        cross = scores[offset:].T @ scores[:-offset]
        covariance += (1 - offset / (lag + 1)) * (cross + cross.T)
    inverse_design = np.linalg.pinv(design)
    influence = inverse_design[1] @ inverse_design.T
    variance = float(influence @ covariance @ influence) * len(y) / (len(y) - parameters)
    if variance <= 0 or not np.isfinite(variance):
        summary["motivo"] = "No se pudo estimar una varianza positiva para la pendiente."
        return fitted, summary

    standard_error = np.sqrt(variance) * scale
    degrees = len(y) - parameters
    p_value = float(2 * t.sf(abs(slope / standard_error), degrees))
    margin = float(t.ppf(0.975, degrees) * standard_error)
    direction = "ascendente" if slope > 0 else "descendente"
    summary.update(
        diagnostico=direction if p_value < 0.05 else "sin evidencia suficiente",
        p_hac=p_value,
        ic95_hac=[slope - margin, slope + margin],
        rezagos_hac=lag,
    )
    return fitted, summary


def predict_candidates(train: pd.Series, future: pd.PeriodIndex) -> dict[str, np.ndarray]:
    frequency = train.index.freqstr
    last = train.index[-1]
    recent = train.loc[last - (WINDOW[frequency] - 1) :]
    origin = recent.index[0].ordinal
    months = np.unique(recent.index.month) if frequency == "M" else None
    x = features(recent.index, origin, months)
    design = np.column_stack((np.ones(len(x)), x))
    regression = np.full(len(future), np.nan)
    if len(x) > design.shape[1] and np.linalg.matrix_rank(design) == design.shape[1]:
        fitted = LinearRegression().fit(x, recent.to_numpy())
        available = np.isin(future.month, months) if months is not None else np.ones(len(future), dtype=bool)
        if available.any():
            regression[available] = fitted.predict(features(future[available], origin, months))

    if frequency == "M":
        latest_by_month = train.groupby(train.index.month).last()
        reference = latest_by_month.reindex(future.month).to_numpy()
    else:
        reference = np.full(len(future), train.iloc[-1])
    return {"regresion": regression, "referencia": reference}


def knn_column(config: tuple[int, str]) -> str:
    neighbors, weights = config
    return f"knn_{neighbors}_{weights}"


def backtest(
    series: pd.Series,
    start: int,
    stop: int,
    horizon: int,
    knn: KnnForecast,
    configs: tuple[tuple[int, str], ...],
) -> pd.DataFrame:
    rows = []
    index = series.index
    for origin in range(start - 1, stop - 1):
        deadline = index[origin].ordinal + horizon
        end = min(stop, int(np.searchsorted(index.asi8, deadline, side="right")))
        targets = series.iloc[origin + 1 : end]
        if targets.empty:
            continue
        candidates = predict_candidates(series.iloc[: origin + 1], targets.index)
        nearest = knn.predict(index[origin], targets.index, configs)
        rows.append(pd.DataFrame({
            "origen": index[origin],
            "periodo": targets.index,
            "horizonte": targets.index.asi8 - index[origin].ordinal,
            "observado": targets.to_numpy(),
            "valor_base_cambio": candidates["referencia"],
            **candidates,
            **{knn_column(config): values for config, values in nearest.items()},
        }))
    columns = ["origen", "periodo", "horizonte", "observado", "valor_base_cambio",
               "regresion", "referencia", *(knn_column(config) for config in configs)]
    return pd.concat(rows, ignore_index=True) if rows else pd.DataFrame(columns=columns)


def choose_knn(calibration: pd.DataFrame) -> tuple[tuple[int, str], float | None]:
    first = KNN_CONFIGS[0]
    comparable = calibration.dropna(subset=[knn_column(first)])
    if comparable.empty:
        return first, None

    # Solo compiten configuraciones evaluables en todas las mismas fechas.
    # Así un k grande no gana por omitir los orígenes con menos ejemplos.
    scores = {}
    for config in KNN_CONFIGS:
        column = knn_column(config)
        if comparable[column].notna().all():
            squared_errors = (comparable["observado"] - comparable[column]) ** 2
            scores[config] = float(squared_errors.groupby(comparable["horizonte"]).mean().mean())
    best = min(scores, key=scores.__getitem__)
    return best, scores[best]


def direction(values: np.ndarray, base: np.ndarray) -> np.ndarray:
    change = values - base
    return np.sign(np.where(np.abs(change) < 1e-9, 0.0, change))


def score_predictions(rows: pd.DataFrame) -> dict:
    scores = {}
    for name in MODELS:
        comparable = rows.dropna(subset=[name])
        by_horizon = {}
        for lead, group in comparable.groupby("horizonte"):
            directional = group.dropna(subset=["valor_base_cambio"])
            base = directional["valor_base_cambio"].to_numpy()
            correct = direction(directional[name].to_numpy(), base) == direction(
                directional["observado"].to_numpy(), base
            )
            by_horizon[int(lead)] = {
                "n": len(group),
                "mae": float(mean_absolute_error(group["observado"], group[name])),
                "mse": float(mean_squared_error(group["observado"], group[name])),
                "rmse": float(root_mean_squared_error(group["observado"], group[name])),
                "n_direccion": len(correct),
                "acierto_direccion": float(correct.mean()) if len(correct) else None,
            }
        averages = {}
        for metric in ("mae", "mse", "acierto_direccion"):
            values = [score[metric] for score in by_horizon.values() if score[metric] is not None]
            averages[f"{metric}_medio"] = float(np.mean(values)) if values else None
        scores[name] = {**averages, "por_horizonte": by_horizon}
    return scores


def future_predictions(
    series: pd.Series,
    horizon: int,
    selected: str,
    calibration: pd.DataFrame,
    knn: KnnForecast,
    config: tuple[int, str],
) -> pd.DataFrame:
    index = pd.period_range(series.index[-1] + 1, periods=horizon, freq=series.index.freq)
    candidates = predict_candidates(series, index)
    base = candidates["referencia"]
    predictions = (knn.predict(series.index[-1], index, (config,))[config]
                   if selected == "knn" else candidates[selected])
    if not np.isfinite(predictions).any():
        raise ValueError("El modelo elegido carece de observaciones para los periodos futuros solicitados.")
    signs = pd.Series(direction(predictions, base), index=index)
    future = pd.DataFrame({
        "horizonte": np.arange(1, horizon + 1),
        "pronostico": predictions,
        "limite_inferior": np.nan,
        "limite_superior": np.nan,
        "valor_base_cambio": base,
        "cambio_pronosticado": predictions - base,
        "direccion_pronosticada": signs.map(DIRECTIONS),
    }, index=index)
    for lead, group in calibration.groupby("horizonte"):
        residuals = (group["observado"] - group[selected]).dropna()
        if len(residuals) >= 10:
            offsets = np.quantile(residuals, [0.05, 0.95])
            row = index[lead - 1]
            future.loc[row, ["limite_inferior", "limite_superior"]] = predictions[lead - 1] + offsets
    return future


def analyze(
    series: pd.Series, *, horizon: int, output: Path, label: str, unit: str, selected: str = "knn"
) -> dict:
    minimum = 36 if series.index.freqstr == "M" else 15
    if len(series) < minimum:
        raise ValueError(f"Se requieren al menos {minimum} periodos válidos para evaluar el pronóstico.")

    validation_start = int(len(series) * 0.6)
    holdout_start = int(len(series) * 0.8)
    knn = KnnForecast(series)
    calibration = backtest(series, validation_start, holdout_start, horizon, knn, KNN_CONFIGS)
    config, tuning_mse = choose_knn(calibration)
    holdout = backtest(series, holdout_start, len(series), horizon, knn, (config,))
    variants = [knn_column(candidate) for candidate in KNN_CONFIGS]
    calibration["knn"] = calibration[knn_column(config)]
    calibration = calibration.drop(columns=variants)
    holdout = holdout.rename(columns={knn_column(config): "knn"})
    validation_scores = score_predictions(calibration)
    holdout_scores = score_predictions(holdout)
    if holdout_scores[selected]["mse_medio"] is None:
        raise ValueError("La serie no tiene suficientes periodos para evaluar el modelo elegido.")

    trend, trend_stats = historical_trend(series)
    forecast = future_predictions(series, horizon, selected, calibration, knn, config)
    coverage_by_horizon = {}
    for lead, group in holdout.groupby("horizonte"):
        residuals = calibration.loc[calibration["horizonte"].eq(lead)]
        errors = (residuals["observado"] - residuals[selected]).dropna()
        test_errors = (group["observado"] - group[selected]).dropna()
        if len(errors) >= 10 and not test_errors.empty:
            low, high = np.quantile(errors, [0.05, 0.95])
            coverage_by_horizon[int(lead)] = float(test_errors.between(low, high).mean())

    knn_mse = holdout_scores["knn"]["mse_medio"]
    summary = {
        "serie": label,
        "unidad": unit,
        "frecuencia": series.index.freqstr,
        "inicio": str(series.index[0]),
        "fin": str(series.index[-1]),
        "observaciones": len(series),
        "tendencia": trend_stats,
        "modelo_elegido": selected,
        "configuracion_knn": {"vecinos": config[0], "pesos": config[1], "mse_validacion": tuning_mse},
        "objetivo_mse_knn": MSE_TARGET,
        "cumple_objetivo_mse_knn": knn_mse <= MSE_TARGET if knn_mse is not None else None,
        "horizonte_solicitado": horizon,
        "horizontes_evaluados_knn": list(holdout_scores["knn"]["por_horizonte"]),
        "base_direccion": "último valor del mismo mes" if series.index.freqstr == "M" else "valor en el origen",
        "inicio_validacion": str(series.index[validation_start]),
        "inicio_evaluacion": str(series.index[holdout_start]),
        "periodos_sin_pronostico": forecast.index[forecast["pronostico"].isna()].astype(str).tolist(),
        "seleccion": validation_scores,
        "evaluacion": holdout_scores,
        "cobertura_banda_90_en_evaluacion": coverage_by_horizon,
    }
    trend_label = f"{trend_stats['pendiente']:+.3f} {unit}/{trend_stats['escala']}"
    if trend_stats["diagnostico"] == "exploratoria":
        trend_label += " · estimación exploratoria"

    output.mkdir(parents=True, exist_ok=True)
    forecast.to_csv(output / "pronostico.csv", index_label="periodo", float_format="%.6f")
    evaluation = pd.concat([
        calibration.assign(conjunto="seleccion"),
        holdout.assign(conjunto="evaluacion"),
    ], ignore_index=True)
    base = evaluation["valor_base_cambio"].to_numpy()
    for source, target in (("observado", "direccion_observada"), ("knn", "direccion_knn")):
        evaluation[target] = pd.Series(direction(evaluation[source].to_numpy(), base)).map(DIRECTIONS)
    evaluation.to_csv(output / "validacion.csv", index=False, float_format="%.6f")
    (output / "resumen.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    full_index = pd.period_range(series.index[0], series.index[-1], freq=series.index.freq)
    plot_results(output / "tendencia.png", series.reindex(full_index), trend, forecast, holdout,
                 label=label, unit=unit, selected=selected, trend_label=trend_label)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, help="CSV de entrada. Por defecto usa NASA GISTEMP.")
    parser.add_argument("--frecuencia", choices=FREQUENCIES, help="Resolución de la serie.")
    parser.add_argument("--fecha", default="date", help="Columna de fechas del CSV.")
    parser.add_argument("--valor", default="value", help="Columna de observaciones numéricas.")
    parser.add_argument("--unidad", help="Unidad de las observaciones para el informe.")
    parser.add_argument("--etiqueta", help="Nombre de la variable, estación o región.")
    parser.add_argument("--station", help="Identificador exacto de la estación NOAA.")
    parser.add_argument("--lcd", action="store_true", help="Lee temperatura NOAA LCD por hora o por día.")
    parser.add_argument("--modelo", choices=MODELS, default="knn", help="Modelo de pronóstico. Predeterminado: KNN.")
    parser.add_argument("--desde", help="Primer periodo a considerar, por ejemplo 1996 o 1996-01.")
    parser.add_argument("--horizonte", type=int, help="Número de periodos futuros.")
    parser.add_argument("--salida", type=Path, default=Path("resultados"), help="Carpeta de resultados.")
    args = parser.parse_args()

    if args.csv is None and (args.lcd or args.frecuencia not in (None, "annual")):
        parser.error("Indica --csv para usar LCD o una frecuencia distinta de annual.")
    frequency = args.frecuencia or ("daily" if args.lcd else "annual")
    horizon = DEFAULT_HORIZON[frequency] if args.horizonte is None else args.horizonte
    if horizon < 1:
        parser.error("--horizonte debe ser un entero positivo.")
    try:
        series, label = load_series(args.csv or NASA_SERIES, frequency=frequency,
                                    date_column=args.fecha, value_column=args.valor,
                                    station=args.station, lcd=args.lcd)
        if args.desde:
            series = series.loc[pd.Period(args.desde, freq=series.index.freq) :]
        if args.csv is None:
            label = "Anomalía de temperatura global · NASA GISTEMP v4"
        unit = args.unidad or ("°C" if args.csv is None or args.lcd else "unidades")
        summary = analyze(series, horizon=horizon, output=args.salida, label=args.etiqueta or label,
                          unit=unit, selected=args.modelo)
    except (ValueError, OSError) as error:
        parser.error(str(error))

    trend = summary["tendencia"]
    print(f"{summary['serie']} | {summary['inicio']}–{summary['fin']} | {summary['observaciones']} periodos")
    print(f"Pendiente {trend['pendiente']:+.3f} {unit}/{trend['escala']} ({trend['diagnostico']})")
    if trend["p_hac"] is not None:
        low, high = trend["ic95_hac"]
        p_text = f"= {trend['p_hac']:.3g}" if trend["p_hac"] else "< 1e-300"
        print(f"IC 95 % [{low:+.3f}, {high:+.3f}] {unit}/{trend['escala']} | p {p_text}")
    print(f"Modelo elegido: {MODEL_LABELS[summary['modelo_elegido']]}")
    for model, scores in summary["evaluacion"].items():
        if scores["mse_medio"] is not None:
            print(f"MSE medio en evaluación · {MODEL_LABELS[model]} {scores['mse_medio']:.4f} {unit}²")
    knn_accuracy = summary["evaluacion"]["knn"]["acierto_direccion_medio"]
    if knn_accuracy is not None:
        print(f"Acierto de dirección · KNN {knn_accuracy:.1%}")
    if summary["cumple_objetivo_mse_knn"] is not None:
        outcome = "cumplido" if summary["cumple_objetivo_mse_knn"] else "error por encima del umbral"
        print(f"Umbral de MSE para KNN ({MSE_TARGET:g} {unit}²): {outcome}")
    if summary["periodos_sin_pronostico"]:
        print("Periodos sin pronóstico: " + ", ".join(summary["periodos_sin_pronostico"]))
    print(f"Resultados en {args.salida.resolve()}")


if __name__ == "__main__":
    main()
