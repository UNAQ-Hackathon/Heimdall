"""Pronóstico de temperatura media anual para las 32 entidades de México."""

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

from .climate_knn import KnnForecast, predict_changes
from .predictor import DIRECTIONS, direction, historical_trend, predict_candidates


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "data" / "mexico_smn_mensual.csv"
OUTPUT = ROOT / "resultados" / "mexico"
OUTPUT_V2 = OUTPUT.with_name("mexico_iteracion_2")
LOCAL = tuple((k, weight) for k in (3, 5, 9, 15) for weight in ("uniform", "distance"))
SHARED = tuple((k, weight) for k in (5, 9, 15, 25, 45) for weight in ("uniform", "distance"))
MODEL_NAMES = ("knn_compartido", "knn_local", "lineal", "persistencia")
REFERENCE = (1991, 2020)
EVALUATION_YEARS = 9
TREND_YEARS = 5


class SmoothedKnn:
    """Aprende la temperatura futura relativa al promedio de los últimos cinco años."""

    def __init__(self, panel: pd.DataFrame) -> None:
        short = panel.rolling(TREND_YEARS).mean()
        long = panel.rolling(10, min_periods=TREND_YEARS)
        level = long.mean()
        slope = long.apply(lambda values: np.polyfit(np.arange(len(values)), values, 1)[0], raw=True)
        self.inputs = np.stack((short - level, slope, level), axis=-1)
        self.anchor = short.to_numpy()
        self.values = panel.to_numpy()
        self.years = panel.index

    def predict(self, origin: pd.Period, lead: int, configs: tuple) -> dict:
        position = self.years.get_loc(origin)
        last_start = position - lead + 1
        inputs = self.inputs[:last_start].reshape(-1, self.inputs.shape[-1])
        targets = (self.values[lead : position + 1] - self.anchor[:last_start]).ravel()
        observed = np.isfinite(inputs).all(axis=1) & np.isfinite(targets)
        changes = predict_changes(inputs[observed], targets[observed], self.inputs[position], configs)
        return {config: self.anchor[position] + estimate for config, estimate in changes.items()}


def tune_smoothed(
    panel: pd.DataFrame, model: SmoothedKnn, lead: int, last_calibration: pd.Period
) -> tuple:
    origins = calibration_origins(panel.index, lead, last_calibration)
    squared_errors = {config: [] for config in SHARED}
    for origin in origins:
        observed = panel.loc[origin + lead].to_numpy()
        for config, forecast in model.predict(origin, lead, SHARED).items():
            squared_errors[config].append(float(np.mean((observed - forecast) ** 2)))
    return best_calibration(squared_errors, len(origins))


def load_annual(path: Path) -> tuple[pd.DataFrame, pd.Series]:
    monthly = pd.read_csv(path, usecols=["CVE_ENT", "ENTIDAD", "PERIODO", "MEDIA"])
    monthly = monthly.loc[monthly["CVE_ENT"].ne(0)].copy()
    monthly["mes"] = pd.to_datetime(monthly["PERIODO"], format="%Y-%m-%d").dt.to_period("M")
    monthly["MEDIA"] = pd.to_numeric(monthly["MEDIA"], errors="raise")
    if not np.isfinite(monthly["MEDIA"]).all():
        raise ValueError("El CSV contiene temperaturas mensuales ausentes o no finitas.")
    names = monthly.groupby("CVE_ENT")["ENTIDAD"].first().sort_index()
    if list(names.index) != list(range(1, 33)) or names.nunique() != 32:
        raise ValueError("El CSV debe contener las 32 entidades federativas.")
    if monthly.duplicated(["CVE_ENT", "mes"]).any():
        raise ValueError("El CSV contiene más de una temperatura para la misma entidad y mes.")

    monthly["anio"] = monthly["mes"].dt.year
    monthly["dias"] = monthly["mes"].dt.days_in_month
    monthly["temperatura_dias"] = monthly["MEDIA"] * monthly["dias"]
    groups = monthly.groupby(["anio", "CVE_ENT"])
    annual = (groups["temperatura_dias"].sum() / groups["dias"].sum()).where(groups.size().eq(12))
    panel = annual.unstack("CVE_ENT").dropna(how="all").sort_index()
    if panel.isna().any().any() or not np.all(np.diff(panel.index) == 1):
        raise ValueError("Se requieren años completos y consecutivos para las 32 entidades.")
    if not set(range(REFERENCE[0], REFERENCE[1] + 1)).issubset(panel.index):
        raise ValueError("Faltan años del periodo de referencia 1991–2020.")
    panel.index = pd.PeriodIndex(panel.index.astype(str), freq="Y", name="periodo")
    return panel, names


def estimate_knn(
    predictors: list[KnnForecast], origin: pd.Period, lead: int,
    local_configs: tuple, shared_configs: tuple,
) -> tuple[dict, dict, int]:
    examples = [model.training_examples(origin, lead) for model in predictors]
    queries = np.stack([model.origin_inputs(origin) for model in predictors])
    shared_inputs = np.concatenate([x for x, _ in examples])
    shared_changes = np.concatenate([y for _, y in examples])
    shared = predict_changes(shared_inputs, shared_changes, queries, shared_configs)

    local = {config: np.full(len(predictors), np.nan) for config in local_configs}
    for state, (inputs, changes) in enumerate(examples):
        for config, prediction in predict_changes(inputs, changes, queries[state : state + 1], local_configs).items():
            local[config][state] = prediction[0]
    return local, shared, len(shared_changes)


def calibration_origins(years: pd.PeriodIndex, lead: int, last_calibration: pd.Period) -> pd.PeriodIndex:
    first_origin = years[lead + 6]  # La media móvil exige cinco años y el menor k exige tres ejemplos.
    origins = years[(years >= first_origin) & (years + lead <= last_calibration)]
    if len(origins) < 3:
        raise ValueError(f"El historial no permite calibrar el horizonte de {lead} años sin usar datos futuros.")
    return origins


def best_calibration(errors: dict, origins: int) -> tuple:
    comparable = {config: np.mean(values) for config, values in errors.items()
                  if len(values) == origins and np.isfinite(values).all()}
    return min(comparable, key=comparable.__getitem__)


def tune(
    panel: pd.DataFrame, predictors: list[KnnForecast], lead: int, last_calibration: pd.Period
) -> tuple[tuple, tuple]:
    scores = ({config: [] for config in LOCAL}, {config: [] for config in SHARED})
    origins = calibration_origins(panel.index, lead, last_calibration)
    for origin in origins:
        observed_change = (panel.loc[origin + lead] - panel.loc[origin]).to_numpy()
        local, shared, _ = estimate_knn(predictors, origin, lead, LOCAL, SHARED)
        for predictions, errors in zip((local, shared), scores):
            for config, prediction in predictions.items():
                errors[config].append(float(np.mean((prediction - observed_change) ** 2)))

    return best_calibration(scores[0], len(origins)), best_calibration(scores[1], len(origins))


def predict_states(
    panel: pd.DataFrame, predictors: list[KnnForecast], origin: pd.Period, lead: int,
    local_config: tuple, shared_config: tuple,
) -> pd.DataFrame:
    local, shared, examples = estimate_knn(predictors, origin, lead, (local_config,), (shared_config,))
    last = panel.loc[origin].to_numpy()
    future = pd.PeriodIndex([origin + lead], freq=origin.freq)
    linear = [predict_candidates(panel[code].loc[:origin], future)["regresion"][0] for code in panel]
    return pd.DataFrame({
        "CVE_ENT": panel.columns,
        "origen": origin.year,
        "anio": (origin + lead).year,
        "horizonte": lead,
        "knn_compartido": last + shared[shared_config],
        "knn_local": last + local[local_config],
        "lineal": linear,
        "persistencia": last,
        "ejemplos_compartidos": examples,
    })


def compare_trends(
    panel: pd.DataFrame, validation: pd.DataFrame, forecast: pd.DataFrame, horizon: int, v1: str
) -> pd.DataFrame:
    """Compara el promedio de los últimos cinco destinos con el de cinco años al origen."""
    columns = ["observado", "knn_compartido", v1]
    climatology = panel.rolling(TREND_YEARS).mean()
    records = []
    # Los cinco pronósticos de cada ventana tienen el mismo año de origen.
    final_leads = range(horizon - TREND_YEARS + 1, horizon + 1)
    selected = validation.loc[validation["horizonte"].isin(final_leads)]
    means = selected.groupby(["CVE_ENT", "origen"])[columns].mean()
    counts = selected.groupby(["CVE_ENT", "origen"]).size()
    means = means.loc[counts.eq(TREND_YEARS)]
    future_means = forecast.loc[forecast["horizonte"].isin(final_leads)].groupby("CVE_ENT")[columns[1:]].mean()
    for code, future in future_means.iterrows():
        historical = means.xs(code)
        base = climatology[code].reindex(pd.PeriodIndex(historical.index.astype(str), freq="Y")).to_numpy()
        observed = historical["observado"].to_numpy()
        record = {"CVE_ENT": code, "n_tendencia_5_anios": len(historical)}
        for model, suffix in (("knn_compartido", "v2"), (v1, "v1")):
            values = historical[model].to_numpy()
            future_change = future[model] - climatology[code].iloc[-1]
            record[f"cambio_5_anios_c_{suffix}"] = future_change
            record[f"mse_tendencia_5_anios_{suffix}"] = float(np.mean((values - observed) ** 2))
            record[f"acierto_tendencia_5_anios_{suffix}"] = float(np.mean(direction(values, base) == direction(observed, base)))
        records.append(record)
    return pd.DataFrame(records)


def run(source: Path, output: Path, target_year: int, iteration: int = 1) -> None:
    panel, names = load_annual(source)
    predictors = [KnnForecast(panel[code], relative_level=True) for code in panel]
    last_year = panel.index[-1]
    horizon = target_year - last_year.year
    if horizon < 1 or len(panel) <= EVALUATION_YEARS + 2 * horizon + 8:
        raise ValueError("El año objetivo debe ser futuro y dejar suficiente historial para calibrar y evaluar.")
    test_years = panel.index[-EVALUATION_YEARS:]
    # La configuración ya está fijada cuando empieza el primer pronóstico evaluado.
    last_calibration = test_years[0] - horizon
    smoothed = SmoothedKnn(panel) if iteration == 2 else None
    evaluations = []
    forecasts = []
    settings = []
    for lead in range(1, horizon + 1):
        local, shared = tune(panel, predictors, lead, last_calibration)
        setting = {"horizonte": lead, "k_local": local[0], "peso_local": local[1],
                   "k_compartido": shared[0], "peso_compartido": shared[1],
                   "ultimo_destino_calibracion": last_calibration.year}
        destinations = test_years
        if smoothed is not None and horizon >= TREND_YEARS and lead > horizon - TREND_YEARS:
            destinations = destinations.union(test_years - (horizon - lead))
        origins = [last_year, *(target - lead for target in destinations)]
        predictions = [predict_states(panel, predictors, origin, lead, local, shared) for origin in origins]
        if smoothed is not None:
            config = tune_smoothed(panel, smoothed, lead, last_calibration)
            setting.update(k_v2=config[0], peso_v2=config[1])
            for origin, frame in zip(origins, predictions):
                frame["knn_compartido_v1"] = frame["knn_compartido"]
                frame["knn_compartido"] = smoothed.predict(origin, lead, (config,))[config]
        settings.append(setting)
        forecasts.append(predictions[0])
        for target, frame in zip(destinations, predictions[1:]):
            frame["observado"] = panel.loc[target].to_numpy()
            evaluations.append(frame)

    validation = pd.concat(evaluations, ignore_index=True)
    forecast = pd.concat(forecasts, ignore_index=True)
    reference = panel.loc[str(REFERENCE[0]) : str(REFERENCE[1])].mean()
    forecast["referencia_c"] = forecast["CVE_ENT"].map(reference)
    forecast["anomalia_compartida_c"] = forecast["knn_compartido"] - forecast["referencia_c"]
    result = forecast.loc[forecast["anio"].eq(target_year)].set_index("CVE_ENT")
    at_target = validation.loc[validation["horizonte"].eq(horizon)].copy()
    models = MODEL_NAMES if smoothed is None else (*MODEL_NAMES, "knn_compartido_v1")
    stats = []
    history = []
    for code, name in names.items():
        observations = panel[code]
        fitted, trend = historical_trend(observations)
        history.append(pd.DataFrame({"CVE_ENT": code, "anio": observations.index.year,
                                     "temperatura_c": observations.to_numpy(), "ajuste_historico_c": fitted}))
        row = at_target.loc[at_target["CVE_ENT"].eq(code)]
        absolute = result.loc[code, "knn_compartido"]
        change = absolute - observations.iloc[-1]
        base = row["persistencia"].to_numpy()
        observed_direction = direction(row["observado"].to_numpy(), base)
        accuracy = {model: float(np.mean(direction(row[model].to_numpy(), base) == observed_direction))
                    for model in models}
        trend_low, trend_high = trend["ic95_hac"] or (None, None)
        stats.append({
            "CVE_ENT": code, "ENTIDAD": name, "anio_objetivo": target_year,
            "ultimo_anio_observado": last_year.year, "ultima_temperatura_c": observations.iloc[-1],
            "media_1991_2020_c": reference[code], "pronostico_c": absolute,
            "anomalia_c": result.loc[code, "anomalia_compartida_c"], "cambio_desde_ultimo_c": change,
            "direccion_desde_ultimo": DIRECTIONS[int(direction(absolute, observations.iloc[-1]))],
            "pendiente_historica_c_decada": trend["pendiente"], "p_hac": trend["p_hac"],
            "pendiente_ic95_inferior": trend_low, "pendiente_ic95_superior": trend_high,
            "diagnostico_historico": trend["diagnostico"], "n_evaluacion": len(row),
            "acierto_direccion": accuracy["knn_compartido"],
            **{f"mse_{model}": float(((row["observado"] - row[model]) ** 2).mean()) for model in models},
        })
        if smoothed is not None:
            stats[-1]["acierto_direccion_v1"] = accuracy["knn_compartido_v1"]
            stats[-1]["pronostico_v1_c"] = result.loc[code, "knn_compartido_v1"]

    summary = pd.DataFrame(stats)
    if smoothed is not None:
        summary["mejora_mse_anual"] = summary["mse_knn_compartido_v1"] - summary["mse_knn_compartido"]
        if horizon >= TREND_YEARS:
            summary = summary.merge(compare_trends(panel, validation, forecast, horizon, "knn_compartido_v1"), on="CVE_ENT")
    output.mkdir(parents=True, exist_ok=True)
    tables = {"resumen": summary, "historial": pd.concat(history, ignore_index=True),
              "pronosticos": forecast, "validacion": validation, "configuraciones": pd.DataFrame(settings)}
    for name, table in tables.items():
        table.to_csv(output / f"{name}.csv", index=False, encoding="utf-8-sig", float_format="%.9g")
    print(f"{len(summary)} entidades | {panel.index[0]}–{last_year} | pronóstico hasta {target_year}")
    for model in models:
        mse = summary[f"mse_{model}"]
        print(f"{model}: MSE {mse.mean():.4f} °C² a {horizon} años | {(mse <= 0.9).sum()}/32 entidades ≤ 0.9")
    print(f"Resultados: {output.resolve()}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=SOURCE)
    parser.add_argument("--salida", type=Path)
    parser.add_argument("--anio", type=int, default=2032)
    parser.add_argument("--iteracion", type=int, choices=(1, 2), default=1)
    args = parser.parse_args()
    try:
        output = args.salida or (OUTPUT_V2 if args.iteracion == 2 else OUTPUT)
        run(args.csv, output, args.anio, args.iteracion)
    except (ValueError, OSError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
