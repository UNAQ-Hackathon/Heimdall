"""Pronóstico de cambios con regresión por vecinos y rezagos de calendario."""

import numpy as np
import pandas as pd
from sklearn.neighbors import KNeighborsRegressor
from sklearn.preprocessing import StandardScaler


KNN_CONFIGS: tuple[tuple[int, str], ...] = (
    (3, "uniform"),
    (3, "distance"),
    (5, "uniform"),
    (5, "distance"),
    (9, "uniform"),
    (9, "distance"),
    (15, "uniform"),
    (15, "distance"),
)


class KnnForecast:
    """Entrena un KNN por horizonte con cambios observados hasta cada origen."""

    def __init__(self, series: pd.Series, *, relative_level: bool = False) -> None:
        first = series.index[0]
        calendar = pd.period_range(first, series.index[-1], freq=series.index.freq)
        complete = series.reindex(calendar)
        self.first_ordinal = first.ordinal
        self.values = complete.to_numpy(dtype=float)

        # Para un rezago faltante se usa el valor más reciente conocido en
        # esa fecha. Los orígenes y objetivos del ajuste sí deben ser reales.
        previous = complete.ffill()
        level = self.values
        if relative_level:
            recent_mean = complete.rolling(10, min_periods=5).mean().to_numpy()
            level = self.values - recent_mean
        inputs = [level]
        for lag in (1, 2, 3):
            inputs.append(self.values - previous.shift(lag).to_numpy(dtype=float))

        if calendar.freqstr == "h":
            angle = 2 * np.pi * calendar.hour.to_numpy() / 24
            inputs.extend((np.sin(angle), np.cos(angle)))
        if calendar.freqstr == "M":
            angle = 2 * np.pi * (calendar.month.to_numpy() - 1) / 12
            inputs.extend((np.sin(angle), np.cos(angle)))

        self.inputs = np.column_stack(inputs)
        self.valid_inputs = np.isfinite(self.inputs).all(axis=1)

    def training_examples(self, origin: pd.Period, lead: int) -> tuple[np.ndarray, np.ndarray]:
        """Devuelve entradas y cambios cuyos destinos ya se observaron en el origen."""
        position = min(origin.ordinal - self.first_ordinal, len(self.values) - 1)
        if lead < 1 or lead > position:
            return self.inputs[:0], self.values[:0]
        last_start = position - lead + 1
        target_values = self.values[lead : position + 1]
        observed = self.valid_inputs[:last_start] & np.isfinite(target_values)
        changes = target_values[observed] - self.values[:last_start][observed]
        return self.inputs[:last_start][observed], changes

    def origin_inputs(self, origin: pd.Period) -> np.ndarray:
        position = origin.ordinal - self.first_ordinal
        return self.inputs[position] if 0 <= position < len(self.inputs) else np.full(self.inputs.shape[1], np.nan)

    def predict(
        self,
        origin: pd.Period,
        targets: pd.PeriodIndex,
        configs: tuple[tuple[int, str], ...],
    ) -> dict[tuple[int, str], np.ndarray]:
        predictions = {config: np.full(len(targets), np.nan) for config in configs}
        position = origin.ordinal - self.first_ordinal
        if not 0 <= position < len(self.values) or not self.valid_inputs[position]:
            return predictions

        origin_row = self.inputs[position : position + 1]
        leads = targets.asi8 - origin.ordinal
        for lead in np.unique(leads):
            if lead < 1 or lead > position:
                continue

            train_inputs, changes = self.training_examples(origin, lead)
            estimates = predict_changes(train_inputs, changes, origin_row, configs)
            for config, estimate in estimates.items():
                predictions[config][leads == lead] = self.values[position] + estimate[0]

        return predictions


def predict_changes(
    inputs: np.ndarray,
    changes: np.ndarray,
    query: np.ndarray,
    configs: tuple[tuple[int, str], ...],
) -> dict[tuple[int, str], np.ndarray]:
    eligible = [config for config in configs if config[0] <= len(changes)]
    if not eligible:
        return {}
    scaler = StandardScaler()
    train = scaler.fit_transform(inputs)
    query = scaler.transform(query)
    predictions = {}
    for neighbors, weights in eligible:
        model = KNeighborsRegressor(n_neighbors=neighbors, weights=weights, algorithm="kd_tree")
        predictions[neighbors, weights] = model.fit(train, changes).predict(query)
    return predictions
