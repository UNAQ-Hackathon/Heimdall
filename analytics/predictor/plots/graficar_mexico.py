"""Genera una gráfica por entidad y un panel de México con Matplotlib."""

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.lines import Line2D
from matplotlib.ticker import MaxNLocator


HERE = Path(__file__).resolve().parent
RESULTS = HERE.parent / "resultados" / "mexico"
INK = "#182c3d"
MUTED = "#526575"
GRID = "#dce4e9"
OBSERVED = "#25445d"
TREND = "#ab542d"
FORECAST = "#007769"
PREVIOUS = "#785698"
PAPER = "#f4f7f8"


def draw(axis, state, history, forecast, *, anomaly: bool) -> None:
    baseline = state.media_1991_2020_c if anomaly else 0
    last = history.iloc[-1]
    years = np.r_[last.anio, forecast["anio"].to_numpy()]
    temperatures = np.r_[last.temperatura_c, forecast["knn_compartido"].to_numpy()]
    axis.axvspan(last.anio + 0.5, forecast["anio"].iloc[-1] + 0.6, color="#e4f0ec", zorder=0)
    axis.axhline(state.media_1991_2020_c - baseline, color="#8797a2", linewidth=0.8, linestyle=":")
    axis.plot(history["anio"], history["temperatura_c"] - baseline, color=OBSERVED, linewidth=1.55)
    axis.plot(history["anio"], history["ajuste_historico_c"] - baseline,
              color=TREND, linewidth=1.1, linestyle="--")
    axis.plot(years, temperatures - baseline, color=FORECAST, linewidth=1.65, linestyle="--")
    if "knn_compartido_v1" in forecast:
        previous = np.r_[last.temperatura_c, forecast["knn_compartido_v1"].to_numpy()]
        axis.plot(years, previous - baseline, color=PREVIOUS, linewidth=1.15, linestyle=":")
    axis.scatter(years[-1], temperatures[-1] - baseline, color=FORECAST, s=24, zorder=4)
    axis.set_xlim(history["anio"].iloc[0] - 0.5, years[-1] + 0.6)
    axis.set_axisbelow(True)
    axis.grid(axis="y", color=GRID, linewidth=0.65)
    axis.yaxis.set_major_locator(MaxNLocator(nbins=4))
    axis.tick_params(length=0, colors=MUTED, labelsize=8)
    axis.spines[["top", "right", "left", "bottom"]].set_visible(False)


def legend(figure, y: float, compare: bool) -> None:
    handles = [
        Line2D([], [], color=OBSERVED, linewidth=1.6, label="Temperatura observada"),
        Line2D([], [], color=TREND, linestyle="--", label="Tendencia histórica"),
        Line2D([], [], color=FORECAST, linestyle="--", marker="o", markersize=4, label="KNN compartido"),
        Line2D([], [], color="#8797a2", linestyle=":", label="Promedio 1991–2020"),
    ]
    if compare:
        handles[2].set_label("KNN · iteración 2")
        handles.append(Line2D([], [], color=PREVIOUS, linestyle=":", label="KNN · iteración 1"))
    figure.legend(handles=handles, loc="upper left", bbox_to_anchor=(0.045, y), ncol=len(handles),
                  frameon=False, labelcolor=MUTED, fontsize=9)


def plot_error_comparison(summary: pd.DataFrame, output: Path, horizon: int) -> None:
    ranked = summary.sort_values("mejora_mse_anual", ascending=False)
    changes = ranked["mejora_mse_anual"]
    figure, axis = plt.subplots(figsize=(10, 11), facecolor=PAPER)
    figure.subplots_adjust(left=0.25, right=0.94, top=0.87, bottom=0.09)
    figure.text(0.08, 0.963, "Cambio del error por entidad", fontsize=25, weight="bold", color=INK, va="top")
    figure.text(0.08, 0.925, f"Pronósticos a {horizon} años · MSE de la iteración 1 menos MSE de la iteración 2",
                fontsize=11, color=MUTED, va="top")
    axis.barh(ranked["ENTIDAD"], changes, color=np.where(changes >= 0, FORECAST, TREND), height=0.68)
    axis.invert_yaxis()
    axis.axvline(0, color=INK, linewidth=0.8)
    axis.grid(axis="x", color=GRID)
    axis.set_axisbelow(True)
    axis.set_xlabel("Reducción del MSE (°C²)", color=MUTED)
    axis.tick_params(length=0, colors=MUTED, labelsize=9)
    axis.spines[:].set_visible(False)
    figure.text(0.08, 0.04, "Valores positivos indican menor error en la segunda iteración.", color=MUTED, fontsize=10)
    figure.savefig(output / "comparacion_mse.png", dpi=145, facecolor=PAPER)
    plt.close(figure)


def generate(results: Path, output: Path) -> None:
    summary = pd.read_csv(results / "resumen.csv").sort_values("CVE_ENT")
    history = pd.read_csv(results / "historial.csv").sort_values("anio")
    forecast = pd.read_csv(results / "pronosticos.csv").sort_values("anio")
    target = int(summary["anio_objetivo"].iloc[0])
    first_year = int(history["anio"].min())
    last_year = int(history["anio"].max())
    source = f"SMN/CONAGUA vía DataMX · datos anuales {first_year}–{last_year} · extrapolación estadística"
    target_horizon = target - last_year
    compare = "knn_compartido_v1" in forecast
    output.mkdir(parents=True, exist_ok=True)

    panel, axes = plt.subplots(8, 4, figsize=(16, 18), facecolor=PAPER)
    panel.subplots_adjust(left=0.058, right=0.981, bottom=0.056, top=0.886, wspace=0.28, hspace=0.75)
    panel.text(0.052, 0.970, f"Temperatura media de México hacia {target}", fontsize=30,
               color=INK, weight="bold", va="top")
    panel.text(0.053, 0.933, "32 entidades · anomalía de temperatura media anual frente a 1991–2020 (°C)",
               fontsize=13, color=MUTED, va="top")
    legend(panel, 0.918, compare)
    panel.text(0.053, 0.023, source, fontsize=10, color=MUTED)

    observed_anomalies = history["temperatura_c"] - history["CVE_ENT"].map(summary.set_index("CVE_ENT")["media_1991_2020_c"])
    y_min = min(observed_anomalies.min(), forecast["anomalia_compartida_c"].min()) - 0.15
    y_max = max(observed_anomalies.max(), forecast["anomalia_compartida_c"].max()) + 0.15
    if compare:
        previous_anomalies = forecast["knn_compartido_v1"] - forecast["referencia_c"]
        y_min = min(y_min, previous_anomalies.min() - 0.15)
        y_max = max(y_max, previous_anomalies.max() + 0.15)

    for axis, state in zip(axes.flat, summary.itertuples(index=False), strict=True):
        observed = history.loc[history["CVE_ENT"].eq(state.CVE_ENT)]
        projected = forecast.loc[forecast["CVE_ENT"].eq(state.CVE_ENT)]
        draw(axis, state, observed, projected, anomaly=True)
        axis.set_ylim(y_min, y_max)
        axis.set_xticks([first_year, 2000, last_year, target])
        axis.set_title(state.ENTIDAD, loc="left", fontsize=11, fontweight="bold", color=INK)
        axis.text(1, 1.04, f"{state.anomalia_c:+.2f}°", transform=axis.transAxes,
                  ha="right", color=FORECAST, fontsize=10, weight="bold")

        figure, detail = plt.subplots(figsize=(10, 5.2), facecolor=PAPER)
        figure.subplots_adjust(left=0.085, right=0.96, bottom=0.18, top=0.69)
        figure.text(0.068, 0.92, state.ENTIDAD, fontsize=24, weight="bold", color=INK)
        figure.text(0.070, 0.855,
                    f"{target}: {state.pronostico_c:.2f} °C   ·   {state.anomalia_c:+.2f} °C frente a 1991–2020",
                    color=FORECAST, fontsize=13, weight="bold")
        figure.text(0.070, 0.802,
                    f"Pendiente histórica {state.pendiente_historica_c_decada:+.2f} °C/década   ·   "
                    f"MSE a {target_horizon} años {state.mse_knn_compartido:.3f} °C² (n={state.n_evaluacion})",
                    color=MUTED, fontsize=10)
        legend(figure, 0.775, compare)
        draw(detail, state, observed, projected, anomaly=False)
        detail.set_ylabel("Temperatura media anual (°C)", color=MUTED)
        detail.set_xticks(np.unique([first_year, 1995, 2005, 2015, last_year, target]))
        figure.text(0.070, 0.060, source, fontsize=9, color=MUTED)
        figure.savefig(output / f"entidad_{state.CVE_ENT:02d}.png", dpi=145, facecolor=PAPER)
        plt.close(figure)

    panel.savefig(output / "panel_32_entidades.png", dpi=150, facecolor=PAPER)
    plt.close(panel)
    if compare:
        plot_error_comparison(summary, output, target_horizon)
    print(f"32 gráficas individuales y un panel en {output.resolve()}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--resultados", type=Path, default=RESULTS)
    parser.add_argument("--salida", type=Path, default=HERE / "méxico")
    args = parser.parse_args()
    generate(args.resultados, args.salida)


if __name__ == "__main__":
    main()
