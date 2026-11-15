import unittest

import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.series import Series
from app.services.trend_detection import analyze_series


class TrendDetectionTests(unittest.TestCase):
    def test_detects_clean_peaks_and_drops_with_explainable_rules(self):
        samples = [
            [0.0, 21.0],
            [1.0, 21.1],
            [2.0, 20.9],
            [3.0, 21.0],
            [4.0, 34.5],  # clean peak
            [5.0, 21.2],
            [6.0, 20.8],
            [7.0, 21.0],
            [8.0, 12.0],  # clean drop
            [9.0, 21.0],
            [10.0, 21.1],
            [11.0, 20.9],
        ]
        res = analyze_series([Series(name="o2_concentration", unit="%", samples=samples)])
        self.assertEqual(len(res.results), 1)
        events = res.results[0].events

        peaks = [e for e in events if e.kind == "peak"]
        drops = [e for e in events if e.kind == "drop"]
        self.assertEqual(len(peaks), 1)
        self.assertEqual(peaks[0].t, 4.0)
        self.assertEqual(peaks[0].value, 34.5)
        self.assertIn("2.0σ", peaks[0].detail)
        self.assertIn("find_peaks", peaks[0].detail)

        self.assertEqual(len(drops), 1)
        self.assertEqual(drops[0].t, 8.0)
        self.assertEqual(drops[0].value, 12.0)
        self.assertIn("2.0σ", drops[0].detail)

    def test_flat_series_emits_no_events(self):
        samples = [[float(t), 14.7] for t in range(25)]
        res = analyze_series([Series(name="pressure_psi", unit="psi", samples=samples)])
        self.assertEqual(res.results[0].events, [])

    def test_noisy_series_extracts_true_spike_without_noise_flood(self):
        rng = np.random.default_rng(42)
        baseline = 21.0 + rng.normal(0.0, 0.25, size=60)
        baseline[28] = 28.5
        samples = [[float(i), float(val)] for i, val in enumerate(baseline)]

        res = analyze_series([Series(name="noisy_o2", unit="%", samples=samples)])
        events = res.results[0].events
        peaks = [e for e in events if e.kind == "peak"]
        self.assertEqual(len(peaks), 1)
        self.assertEqual(peaks[0].t, 28.0)
        self.assertIn("rolling baseline mean", peaks[0].detail)

        # Pure stationary bounded ripple without outliers stays quiet
        ripple = [[float(i), float(21.0 + 0.2 * np.sin(i * 0.9))] for i in range(40)]
        ripple_res = analyze_series([Series(name="ripple", unit="%", samples=ripple)])
        self.assertEqual(ripple_res.results[0].events, [])

    def test_degenerate_inputs_are_safe(self):
        self.assertEqual(analyze_series([]).results, [])

        empty_samples = analyze_series([Series(name="empty", unit="s", samples=[])])
        self.assertEqual(empty_samples.results[0].events, [])

        single_point = analyze_series([Series(name="one", unit="s", samples=[[1.0, 5.2]])])
        self.assertEqual(single_point.results[0].events, [])

        two_points = analyze_series([Series(name="two", unit="s", samples=[[1.0, 5.2], [2.0, 9.4]])])
        self.assertEqual(two_points.results[0].events, [])

    def test_trends_endpoint_returns_explainable_events(self):
        client = TestClient(app)
        resp = client.post(
            "/api/analytics/trends",
            json={
                "series": [
                    {
                        "name": "burn_duration",
                        "unit": "s",
                        "samples": [
                            [1.5, 4.1],
                            [1.8, 4.3],
                            [2.0, 4.2],
                            [2.2, 14.8],
                            [2.4, 4.4],
                            [2.6, 4.3],
                            [2.8, 4.1],
                        ],
                    }
                ]
            },
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(len(body["results"]), 1)
        self.assertGreaterEqual(len(body["results"][0]["events"]), 1)
        self.assertEqual(body["results"][0]["events"][0]["kind"], "peak")


if __name__ == "__main__":
    unittest.main()
