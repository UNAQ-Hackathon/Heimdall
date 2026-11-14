"""Gráfica del historial, el pronóstico y la evaluación temporal."""

from pathlib import Path
from textwrap import wrap

import matplotlib.dates as mdates
import numpy as np
import pandas as pd
from matplotlib.axes import Axes
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.figure import Figure


BACKGROUND = "#F3F6FA"
INK = "#192E43"
MUTED = "#4B6174"
OBSERVED = "#233F59"
TREND = "#AA4E18"
MODEL_STYLES = {
    "knn": ("KNN", "#00766D", "-"),
    "regresion": ("Regresión lineal", "#AA4E18", "--"),
    "referencia": ("Persistencia", "#785698", ":"),
}


def style_axis(axis: Axes, index: pd.PeriodIndex, unit: str, title: str) -> None:
    axis.text(0, 1.17, title, transform=axis.transAxes, ha="left", va="bottom",
              fontsize=14, fontweight="bold", color=INK)
    axis.set_ylabel(unit, color=MUTED, fontsize=10, labelpad=8)
    axis.tick_params(axis="both", colors=MUTED, labelsize=9, length=0, pad=6)
    axis.set_axisbelow(True)
    axis.grid(axis="y", color="#DDE5ED", linewidth=0.8)
    for side in ("top", "right", "left"):
        axis.spines[side].set_visible(False)
    axis.spines["bottom"].set_color("#B9C7D4")

    hourly = index.freqstr.lower() == "h"
    locator = mdates.AutoDateLocator(minticks=4, maxticks=9 if hourly else 7)
    axis.xaxis.set_major_locator(locator)
    if index.freqstr.startswith(("Y", "A")):
        formatter = mdates.DateFormatter("%Y")
    elif index.freqstr.startswith(("M", "Q")):
        formatter = mdates.DateFormatter("%Y-%m")
    elif hourly:
        formatter = mdates.ConciseDateFormatter(
            locator,
            formats=["%Y", "%m", "%d", "%H:%M", "%H:%M", "%S"],
            zero_formats=["", "%Y", "%m-%d", "%m-%d", "%H:%M", "%H:%M"],
            offset_formats=["", "%Y", "%Y-%m", "%Y-%m-%d", "%Y-%m-%d", "%Y-%m-%d %H:%M"],
        )
        axis.xaxis.get_offset_text().set(color=MUTED, fontsize=9)
    else:
        formatter = mdates.DateFormatter("%Y-%m-%d")
    axis.xaxis.set_major_formatter(formatter)
    axis.margins(x=0.02, y=0.13)


def show_legend(axis: Axes, columns: int) -> None:
    legend = axis.legend(
        loc="lower left", bbox_to_anchor=(0, 1.015), borderaxespad=0,
        frameon=False, ncols=columns, fontsize=9, columnspacing=1.5,
    )
    for label in legend.get_texts():
        label.set_color(MUTED)


def plot_results(
    output: Path,
    series: pd.Series,
    trend: np.ndarray,
    forecast: pd.DataFrame,
    holdout: pd.DataFrame,
    *,
    label: str,
    unit: str,
    selected: str,
    trend_label: str,
) -> None:
    """Guarda una figura PNG sin abrir una ventana de Matplotlib."""
    figure = Figure(figsize=(12.6, 8.0), dpi=150, facecolor=BACKGROUND)
    FigureCanvasAgg(figure)
    history_axis, evaluation_axis = figure.subplots(2, 1, height_ratios=(1.2, 1))
    heading = "\n".join(wrap(label, width=70))
    subtitle = "\n".join(wrap(trend_label, width=120))
    subtitle_y = 0.897 - 0.043 * heading.count("\n")
    figure.text(0.075, 0.953, heading, ha="left", va="top", fontsize=23,
                fontweight="bold", color=INK)
    figure.text(0.075, subtitle_y, subtitle, ha="left", va="top", fontsize=10, color=MUTED)
    figure.subplots_adjust(left=0.082, right=0.966, bottom=0.076,
                           top=subtitle_y - 0.125 - 0.021 * subtitle.count("\n"), hspace=0.62)

    history_dates = series.index.to_timestamp()
    forecast_dates = forecast.index.to_timestamp()
    style_axis(history_axis, series.index, unit, "Serie histórica y pronóstico")
    history_axis.plot(history_dates, series, color=OBSERVED, linewidth=1.65, label="Observado")
    if np.isfinite(trend).any():
        history_axis.plot(history_dates, trend, color=TREND, linewidth=1.7,
                          linestyle="--", label="Tendencia histórica")
    forecast_label, forecast_color, _ = MODEL_STYLES[selected]
    history_axis.plot(forecast_dates, forecast["pronostico"], color=forecast_color, linewidth=2.1,
                      marker="o", markersize=4, label=f"Pronóstico · {forecast_label}")

    lower = forecast["limite_inferior"].to_numpy(dtype=float, na_value=np.nan)
    upper = forecast["limite_superior"].to_numpy(dtype=float, na_value=np.nan)
    valid = np.isfinite(lower) & np.isfinite(upper)
    band_label = "Banda empírica · 90 % nominal"
    has_neighbor = np.zeros_like(valid)
    has_neighbor[1:] = valid[:-1]
    has_neighbor[:-1] |= valid[1:]
    has_band = (valid & has_neighbor).any()
    if has_band:
        history_axis.fill_between(forecast_dates, lower, upper, where=valid, color=forecast_color,
                                  alpha=0.19, linewidth=0, label=band_label)
    isolated = valid & ~has_neighbor
    if isolated.any():
        history_axis.vlines(forecast_dates[isolated], lower[isolated], upper[isolated],
                            color=forecast_color, alpha=0.35, linewidth=4,
                            label=None if has_band else band_label)
    if len(forecast_dates):
        last_observed = series.last_valid_index().to_timestamp()
        separator = last_observed + (forecast_dates[0] - last_observed) / 2
        history_axis.axvline(separator, color="#A5B4C2", linewidth=1, linestyle=":", zorder=0)
    show_legend(history_axis, 4)

    first_lead = holdout.loc[holdout["horizonte"].eq(1)].set_index("periodo").sort_index()
    style_axis(evaluation_axis, series.index, unit, "Evaluación cronológica a un período")
    if first_lead.empty:
        evaluation_axis.set_xticks([])
        evaluation_axis.set_yticks([])
        evaluation_axis.text(0.5, 0.5, "Evaluación no disponible", transform=evaluation_axis.transAxes,
                             ha="center", va="center", color=MUTED)
    else:
        test_periods = pd.period_range(first_lead.index[0], first_lead.index[-1],
                                       freq=series.index.freq)
        first_lead = first_lead.reindex(test_periods)
        test_dates = test_periods.to_timestamp()
        mark_every = max(len(first_lead) // 18, 1)
        evaluation_axis.plot(test_dates, first_lead["observado"], color=OBSERVED, linewidth=1.7,
                             marker="o", markersize=3.5, markevery=mark_every, label="Observado")
        model_count = 0
        for model, (model_label, color, line) in MODEL_STYLES.items():
            if model not in first_lead or not first_lead[model].notna().any():
                continue
            model_count += 1
            if model == selected:
                model_label += " (modelo elegido)"
            evaluation_axis.plot(test_dates, first_lead[model], color=color,
                                 linewidth=1.95 if model in ("knn", selected) else 1.3,
                                 linestyle=line, marker="o", markersize=3,
                                 markevery=mark_every, label=model_label,
                                 zorder=2.5 if model == "knn" else 2)
        show_legend(evaluation_axis, 1 + model_count)

    figure.savefig(output, format="png", facecolor=BACKGROUND)
