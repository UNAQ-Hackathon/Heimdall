import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from predictor.climate_data import load_series
from predictor.climate_knn import KnnForecast
from predictor.mexico_2032 import SOURCE, load_annual
from predictor.predictor import NASA_SERIES, analyze


class PredictorTests(unittest.TestCase):
    def test_bundled_datasets_resolve(self):
        series, _ = load_series(
            NASA_SERIES, frequency="annual", date_column="date",
            value_column="value", station=None, lcd=False,
        )
        self.assertGreater(len(series), 30)
        panel, _ = load_annual(SOURCE)
        self.assertEqual(panel.shape[1], 32)

    def test_training_examples_exclude_future_observations(self):
        index = pd.period_range("1980", periods=45, freq="Y")
        series = pd.Series(np.arange(45, dtype=float), index=index)
        changed = series.copy()
        changed.iloc[26:] = 10000
        original = KnnForecast(series).training_examples(index[25], 3)
        modified = KnnForecast(changed).training_examples(index[25], 3)
        np.testing.assert_array_equal(original[0], modified[0])
        np.testing.assert_array_equal(original[1], modified[1])
        self.assertGreater(len(original[1]), 0)

    def test_forecast_writes_reports(self):
        series, _ = load_series(
            NASA_SERIES, frequency="annual", date_column="date",
            value_column="value", station=None, lcd=False,
        )
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            summary = analyze(series, horizon=1, output=output, label="GISTEMP", unit="°C")
            self.assertIsNotNone(summary["evaluacion"]["knn"]["mse_medio"])
            for name in ("pronostico.csv", "validacion.csv", "resumen.json", "tendencia.png"):
                self.assertTrue((output / name).is_file())


if __name__ == "__main__":
    unittest.main()
