import unittest

from app.schemas.flammability import FlammabilityPoint, GridSpec
from app.services.flammability_map import build_map


class FlammabilityMapTests(unittest.TestCase):
    def test_interpolates_inside_hull_and_leaves_outside_none(self):
        points = [
            FlammabilityPoint(oxygen_pct=20.0, flow_velocity=0.1, flammable=False),
            FlammabilityPoint(oxygen_pct=30.0, flow_velocity=0.1, flammable=True),
            FlammabilityPoint(oxygen_pct=20.0, flow_velocity=0.4, flammable=False),
            FlammabilityPoint(oxygen_pct=30.0, flow_velocity=0.4, flammable=True),
        ]
        grid = GridSpec(o2_min=15.0, o2_max=35.0, vel_min=0.0, vel_max=0.5, resolution=10)
        res = build_map(points, grid)

        self.assertEqual(len(res.cells), 100)

        inside_cells = [
            c
            for c in res.cells
            if 20.0 <= c.oxygen_pct <= 30.0 and 0.1 <= c.flow_velocity <= 0.4
        ]
        outside_cells = [
            c
            for c in res.cells
            if c.oxygen_pct < 20.0
            or c.oxygen_pct > 30.0
            or c.flow_velocity < 0.1
            or c.flow_velocity > 0.4
        ]

        self.assertGreater(len(inside_cells), 0)
        self.assertGreater(len(outside_cells), 0)

        for cell in inside_cells:
            self.assertIsNotNone(cell.probability)
            self.assertIsNotNone(cell.lower)
            self.assertIsNotNone(cell.upper)
            self.assertGreaterEqual(cell.probability, 0.0)
            self.assertLessEqual(cell.probability, 1.0)
            self.assertLessEqual(cell.lower, cell.probability)
            self.assertGreaterEqual(cell.upper, cell.probability)

        for cell in outside_cells:
            self.assertIsNone(cell.probability)
            self.assertIsNone(cell.lower)
            self.assertIsNone(cell.upper)

    def test_empty_or_collinear_points_return_all_none(self):
        grid = GridSpec(o2_min=15.0, o2_max=35.0, vel_min=0.0, vel_max=0.5, resolution=5)
        empty_res = build_map([], grid)
        self.assertTrue(all(c.probability is None for c in empty_res.cells))

        collinear = [
            FlammabilityPoint(oxygen_pct=20.0, flow_velocity=0.1, flammable=False),
            FlammabilityPoint(oxygen_pct=25.0, flow_velocity=0.2, flammable=True),
            FlammabilityPoint(oxygen_pct=30.0, flow_velocity=0.3, flammable=True),
        ]
        collinear_res = build_map(collinear, grid)
        self.assertTrue(all(c.probability is None for c in collinear_res.cells))


if __name__ == "__main__":
    unittest.main()
