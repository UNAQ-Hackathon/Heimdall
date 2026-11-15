"""Trend, peak, and drop detection over numeric telemetry series.

Uses ``scipy.signal.find_peaks`` together with rolling-window statistics.
Every detected event records the exact detection rule and threshold used so
every output remains explainable and verifiable.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd
from scipy.signal import find_peaks

from app.schemas.series import Series, SeriesTrends, TrendEvent, TrendsResponse

SIGMA_THRESHOLD = 2.0


def _leave_one_out_rolling_stats(
    values: np.ndarray, half_window: int
) -> tuple[np.ndarray, np.ndarray]:
    """Return local baseline mean and std around each index excluding the point itself."""
    n = len(values)
    means = np.empty(n, dtype=float)
    stds = np.empty(n, dtype=float)
    global_std = float(np.std(values))
    median_val = float(np.median(values))
    robust_std = float(1.4826 * np.median(np.abs(values - median_val)))

    for i in range(n):
        lo = max(0, i - half_window)
        hi = min(n, i + half_window + 1)
        neighbors = np.concatenate((values[lo:i], values[i + 1 : hi]))
        if len(neighbors) == 0:
            means[i] = float(values[i])
            stds[i] = max(robust_std, global_std)
        else:
            means[i] = float(np.mean(neighbors))
            local_std = float(np.std(neighbors))
            stds[i] = max(local_std, robust_std, global_std * 0.25)

    return means, stds


def _analyze_single_series(item: Series) -> SeriesTrends:
    finite_pairs = [
        (float(pair[0]), float(pair[1]))
        for pair in item.samples
        if isinstance(pair, (list, tuple))
        and len(pair) >= 2
        and math.isfinite(float(pair[0]))
        and math.isfinite(float(pair[1]))
    ]

    if len(finite_pairs) < 3:
        return SeriesTrends(name=item.name, events=[])

    finite_pairs.sort(key=lambda pair: pair[0])
    times = np.array([pair[0] for pair in finite_pairs], dtype=float)
    values = np.array([pair[1] for pair in finite_pairs], dtype=float)

    global_std = float(np.std(values))
    if global_std <= 1e-12 or np.allclose(values, values[0], rtol=1e-9, atol=1e-12):
        return SeriesTrends(name=item.name, events=[])

    n = len(values)
    half_window = max(2, min(6, n // 4))
    min_distance = max(1, half_window)

    base_means, base_stds = _leave_one_out_rolling_stats(values, half_window)
    events: list[TrendEvent] = []

    peak_indices, peak_props = find_peaks(
        values,
        prominence=max(global_std * 0.75, 1e-9),
        distance=min_distance,
    )
    for pos, idx in enumerate(peak_indices):
        sigma = max(float(base_stds[idx]), 1e-9)
        z_score = float((values[idx] - base_means[idx]) / sigma)
        prominence = float(peak_props["prominences"][pos])
        if z_score > SIGMA_THRESHOLD and prominence >= SIGMA_THRESHOLD * sigma * 0.75:
            events.append(
                TrendEvent(
                    kind="peak",
                    t=float(times[idx]),
                    value=float(values[idx]),
                    detail=(
                        f"local maximum > {SIGMA_THRESHOLD:.1f}σ above rolling baseline mean "
                        f"(scipy.signal.find_peaks, mean={base_means[idx]:.4g}, "
                        f"σ={sigma:.4g}, z={z_score:.2f}, prominence={prominence:.4g})"
                    ),
                )
            )

    drop_indices, drop_props = find_peaks(
        -values,
        prominence=max(global_std * 0.75, 1e-9),
        distance=min_distance,
    )
    for pos, idx in enumerate(drop_indices):
        sigma = max(float(base_stds[idx]), 1e-9)
        z_score = float((base_means[idx] - values[idx]) / sigma)
        prominence = float(drop_props["prominences"][pos])
        if z_score > SIGMA_THRESHOLD and prominence >= SIGMA_THRESHOLD * sigma * 0.75:
            events.append(
                TrendEvent(
                    kind="drop",
                    t=float(times[idx]),
                    value=float(values[idx]),
                    detail=(
                        f"local minimum > {SIGMA_THRESHOLD:.1f}σ below rolling baseline mean "
                        f"(scipy.signal.find_peaks, mean={base_means[idx]:.4g}, "
                        f"σ={sigma:.4g}, z={z_score:.2f}, prominence={prominence:.4g})"
                    ),
                )
            )

    # Sustained regime shifts between adjacent rolling windows
    shift_win = max(3, min(6, n // 4))
    if n >= shift_win * 2 + 1:
        s_val = pd.Series(values)
        left_mean = s_val.rolling(shift_win, min_periods=shift_win).mean().to_numpy()
        left_med = s_val.rolling(shift_win, min_periods=shift_win).median().to_numpy()
        left_std = s_val.rolling(shift_win, min_periods=shift_win).std(ddof=0).to_numpy()

        step_scores = np.zeros(n, dtype=float)
        pooled_stds = np.full(n, global_std, dtype=float)
        for i in range(shift_win, n - shift_win + 1):
            before_m = left_mean[i - 1]
            before_med = left_med[i - 1]
            after_m = left_mean[i + shift_win - 1]
            after_med = left_med[i + shift_win - 1]
            pooled = max(
                float(np.nanmean([left_std[i - 1], left_std[i + shift_win - 1]])),
                global_std * 0.25,
                1e-9,
            )
            pooled_stds[i] = pooled
            mean_shift = abs(float(after_m - before_m))
            med_shift = abs(float(after_med - before_med))
            if med_shift > SIGMA_THRESHOLD * pooled:
                step_scores[i] = mean_shift / pooled

        change_indices, _ = find_peaks(step_scores, height=SIGMA_THRESHOLD, distance=shift_win)
        for idx in change_indices:
            events.append(
                TrendEvent(
                    kind="trend_change",
                    t=float(times[idx]),
                    value=float(values[idx]),
                    detail=(
                        f"rolling-window regime shift > {SIGMA_THRESHOLD:.1f}σ "
                        f"(scipy.signal.find_peaks on adjacent {shift_win}-point rolling windows, "
                        f"shift={step_scores[idx]:.2f}σ, σ={pooled_stds[idx]:.4g})"
                    ),
                )
            )

    events.sort(key=lambda ev: ev.t)
    return SeriesTrends(name=item.name, events=events)


def analyze_series(series: list[Series]) -> TrendsResponse:
    """Analyze each numeric series and return explainable peak, drop, and shift events."""
    results = [_analyze_single_series(item) for item in series]
    return TrendsResponse(results=results)
