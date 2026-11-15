import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.firehazr import load_artifacts
from firehazr import SOURCE_DIR


EXAMPLE = {
    "fuel": "Methanol", "pressure_mmhg": 765,
    "o2_fraction": 0.21, "n2_fraction": 0.79,
    "co2_fraction": 0, "he_fraction": 0, "diameter_mm": 1.8,
}


class FireHazRTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_documented_prediction_and_neighbors(self):
        response = self.client.post("/api/analytics/firehazr/predict", json=EXAMPLE)
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()["result"]
        self.assertTrue(result["aceptado"])
        self.assertAlmostEqual(result["duracion_estimada_s"], 5.1283, places=4)
        self.assertEqual([r["prueba"] for r in result["vecinos"]], [2, 1, 5, 3, 4])
        self.assertAlmostEqual(sum(r["peso"] for r in result["vecinos"]), 1)

    def test_api_matches_original_cli_without_retraining(self):
        command = [sys.executable, str(SOURCE_DIR / "knn_cobertura.py"), "predecir", "--fuel", "Methanol"]
        for key, value in {
            "presion-mmhg": 765, "o2-fraccion": 0.21, "n2-fraccion": 0.79,
            "co2-fraccion": 0, "he-fraccion": 0, "diametro-mm": 1.8,
        }.items():
            command.extend([f"--{key}", str(value)])
        cli = json.loads(subprocess.check_output(command, text=True))
        api = self.client.post("/api/analytics/firehazr/predict", json=EXAMPLE).json()
        self.assertEqual(api["result"], cli)

    def test_unsupported_query_abstains_instead_of_inventing_a_result(self):
        response = self.client.post("/api/analytics/firehazr/predict", json={**EXAMPLE, "pressure_mmhg": 100000})
        self.assertEqual(response.status_code, 200)
        result = response.json()["result"]
        self.assertFalse(result["aceptado"])
        self.assertIsNone(result["duracion_estimada_s"])
        self.assertEqual(result["motivo"], "fuera_de_rango_o_mezcla_sin_datos")
        self.assertNotIn("vecinos", result)

    def test_invalid_conditions_are_rejected(self):
        for changes in [
            {"fuel": "PMMA"}, {"pressure_mmhg": 0}, {"diameter_mm": -1},
            {"o2_fraction": -0.1}, {"n2_fraction": 0.5}, {"xe_fraction": 0.1},
            {"gravity": 1}, {"pressure_mmhg": True}, {"pressure_mmhg": "NaN"},
        ]:
            with self.subTest(changes=changes):
                response = self.client.post("/api/analytics/firehazr/predict", json={**EXAMPLE, **changes})
                self.assertEqual(response.status_code, 422, response.text)

    def test_changed_json_artifact_is_rejected_without_fallback(self):
        load_artifacts.cache_clear()
        try:
            with patch.object(Path, "read_text", return_value='{"changed": true}'):
                response = self.client.get("/api/analytics/firehazr")
                self.assertEqual(response.status_code, 503)
                self.assertNotIn("result", response.json())
        finally:
            load_artifacts.cache_clear()

    def test_inference_does_not_read_source_csv(self):
        load_artifacts.cache_clear()
        try:
            with patch.object(Path, "read_bytes", side_effect=AssertionError("Inference must not read CSV data")):
                response = self.client.post("/api/analytics/firehazr/predict", json=EXAMPLE)
                self.assertEqual(response.status_code, 200, response.text)
                self.assertAlmostEqual(response.json()["result"]["duracion_estimada_s"], 5.1283, places=4)
        finally:
            load_artifacts.cache_clear()

    def test_metadata_reports_real_validation_and_scope(self):
        response = self.client.get("/api/analytics/firehazr")
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual(data["version"], 3)
        self.assertEqual(data["training_trials"], 258)
        self.assertEqual(data["validation"]["grouped"]["supported"], 162)
        self.assertEqual(data["validation"]["chronological"]["supported"], 3)
        self.assertEqual(data["supported_gases"], ["O2", "N2", "CO2", "He"])
        self.assertEqual(len(data["training_sha256"]), 64)
        self.assertFalse(data["source_data_available"])
        self.assertEqual(set(data["artifact_sha256"]), {"modelo.json", "resumen.json"})
        self.assertIn("not a fire-risk", data["limitation"])


if __name__ == "__main__":
    unittest.main()
