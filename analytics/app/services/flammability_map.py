"""Flammability map: probability grid over (O2 %, flow velocity).

Interpolates strictly inside the convex hull (envelope) of measured experimental
points and leaves all cells outside data coverage as None — honest bounds,
never invented numbers.
"""

from __future__ import annotations

import numpy as np
from scipy.spatial import Delaunay, QhullError

from app.schemas.flammability import (
    Cell,
    FlammabilityPoint,
    FlammabilityResponse,
    GridSpec,
)


def _aggregate_duplicate_points(
    points: list[FlammabilityPoint],
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Merge duplicate (oxygen_pct, flow_velocity) coordinates via weighted average."""
    buckets: dict[tuple[float, float], list[tuple[float, float]]] = {}
    for pt in points:
        key = (round(float(pt.oxygen_pct), 6), round(float(pt.flow_velocity), 6))
        w = max(float(pt.weight), 1e-6)
        val = 1.0 if pt.flammable else 0.0
        buckets.setdefault(key, []).append((val, w))

    coords = []
    values = []
    weights = []
    for (o2, vel), items in buckets.items():
        total_w = sum(w for _, w in items)
        avg_val = sum(v * w for v, w in items) / total_w
        coords.append([o2, vel])
        values.append(avg_val)
        weights.append(total_w)

    return (
        np.asarray(coords, dtype=float),
        np.asarray(values, dtype=float),
        np.asarray(weights, dtype=float),
    )


def build_map(points: list[FlammabilityPoint], grid: GridSpec) -> FlammabilityResponse:
    o2_step = (grid.o2_max - grid.o2_min) / grid.resolution
    v_step = (grid.vel_max - grid.vel_min) / grid.resolution

    grid_coords = [
        (grid.o2_min + i * o2_step, grid.vel_min + j * v_step)
        for i in range(grid.resolution)
        for j in range(grid.resolution)
    ]

    if not points:
        return FlammabilityResponse(
            cells=[
                Cell(oxygen_pct=o2, flow_velocity=vel)
                for o2, vel in grid_coords
            ]
        )

    coords, values, weights = _aggregate_duplicate_points(points)
    o2_span = max(grid.o2_max - grid.o2_min, 1e-6)
    vel_span = max(grid.vel_max - grid.vel_min, 1e-6)

    def normalize(arr: np.ndarray) -> np.ndarray:
        out = np.empty_like(arr, dtype=float)
        out[..., 0] = (arr[..., 0] - grid.o2_min) / o2_span
        out[..., 1] = (arr[..., 1] - grid.vel_min) / vel_span
        return out

    norm_pts = normalize(coords)
    tri: Delaunay | None = None
    if len(norm_pts) >= 3:
        centered = norm_pts - norm_pts.mean(axis=0)
        if np.linalg.matrix_rank(centered, tol=1e-8) >= 2:
            try:
                tri = Delaunay(norm_pts)
            except QhullError:
                tri = None

    cells: list[Cell] = []
    for o2, vel in grid_coords:
        if tri is None:
            # Fewer than 3 non-collinear points: no 2D envelope coverage
            cells.append(Cell(oxygen_pct=o2, flow_velocity=vel))
            continue

        q = np.array([(o2 - grid.o2_min) / o2_span, (vel - grid.vel_min) / vel_span])
        simplex_idx = int(tri.find_simplex(q, tol=1e-9))
        if simplex_idx < 0:
            # Outside convex hull of measured points -> None
            cells.append(Cell(oxygen_pct=o2, flow_velocity=vel))
            continue

        # Barycentric coordinates inside simplex
        transform = tri.transform[simplex_idx]
        b_first = transform[:2].dot(q - transform[2])
        bary = np.array([b_first[0], b_first[1], 1.0 - b_first.sum()], dtype=float)
        bary = np.clip(bary, 0.0, 1.0)
        bary_sum = bary.sum()
        if bary_sum > 0:
            bary /= bary_sum

        verts = tri.simplices[simplex_idx]
        vert_vals = values[verts]
        vert_weights = weights[verts]

        eff_w = bary * vert_weights
        eff_w_sum = eff_w.sum()
        if eff_w_sum > 0:
            eff_w /= eff_w_sum
        else:
            eff_w = bary

        prob = float(np.clip(np.dot(eff_w, vert_vals), 0.0, 1.0))

        # Uncertainty interval from local vertex spread + distance from vertices
        local_std = float(np.sqrt(np.dot(eff_w, (vert_vals - prob) ** 2)))
        interior_factor = 1.0 - float(np.max(bary))
        half_width = min(0.5, 0.5 * local_std + 0.15 * interior_factor)

        lower = round(max(0.0, prob - half_width), 4)
        upper = round(min(1.0, prob + half_width), 4)
        prob_rounded = round(prob, 4)

        cells.append(
            Cell(
                oxygen_pct=o2,
                flow_velocity=vel,
                probability=prob_rounded,
                lower=min(lower, prob_rounded),
                upper=max(upper, prob_rounded),
            )
        )

    return FlammabilityResponse(cells=cells)
