"""Grafica el error de calibración de KNN frente al número de vecinos."""

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


HERE = Path(__file__).resolve().parent

from ..mexico_2032 import EVALUATION_YEARS, SHARED, SOURCE, SmoothedKnn, calibration_origins, load_annual


NEIGHBORS = (1, 3, 5, 9, 15, 25, 35, 45, 55, 65, 75, 85, 95)
WEIGHTS = {"uniform": "Pesos uniformes", "distance": "Pesos por distancia"}


def generate(source: Path, output: Path, target_year: int) -> None:
    panel, _ = load_annual(source)
    lead = target_year - panel.index[-1].year
    if not 1 <= lead < len(panel) - EVALUATION_YEARS:
        raise ValueError("El año objetivo debe ser futuro y contar con historial para calibración.")
    origins = calibration_origins(panel.index, lead, panel.index[-EVALUATION_YEARS] - lead)
    model = SmoothedKnn(panel)
    configs = tuple((k, weight) for k in NEIGHBORS for weight in WEIGHTS)
    errors = {config: [] for config in configs}
    for origin in origins:
        observed = panel.loc[origin + lead].to_numpy()
        for config, prediction in model.predict(origin, lead, configs).items():
            errors[config].append(float(np.mean((observed - prediction) ** 2)))
    scores = {config: float(np.mean(values)) for config, values in errors.items() if len(values) == len(origins)}
    original = min((config for config in SHARED if config in scores), key=scores.__getitem__)
    best = min(scores, key=scores.__getitem__)
    results = pd.DataFrame([
        {"k": k, "pesos": weight, "mse_calibracion_c2": mse, "n_origenes": len(origins),
         "n_entidades": len(panel.columns), "seleccion_iteracion_2": (k, weight) == original}
        for (k, weight), mse in scores.items()
    ])

    paper, ink, muted = "#f4f7f8", "#182c3d", "#526575"
    figure, axis = plt.subplots(figsize=(9.2, 5.5), facecolor=paper)
    figure.subplots_adjust(left=0.115, right=0.955, top=0.73, bottom=0.21)
    figure.text(0.105, 0.94, "Curva de codo del KNN de México", fontsize=22, weight="bold", color=ink, va="top")
    figure.text(0.105, 0.855,
                f"Iteración 2 · pronósticos a {lead} años · {len(panel.columns)} entidades",
                fontsize=11, color=muted, va="top")
    for (weight, label), color, marker in zip(WEIGHTS.items(), ("#007769", "#785698"), ("o", "s"), strict=True):
        values = results.loc[results["pesos"].eq(weight)]
        axis.plot(values["k"], values["mse_calibracion_c2"], label=label, color=color,
                  marker=marker, linewidth=1.85, markersize=4)
    k, _ = original
    axis.axvline(k, color="#71828e", linestyle=":", linewidth=1.1)
    axis.scatter(k, scores[original], s=85, facecolor="white", edgecolor="#007769", zorder=5, linewidth=1.8)
    axis.annotate(f"k = {k} · modelo usado\nMSE {scores[original]:.4f}", xy=(k, scores[original]),
                  xytext=(11, 32), textcoords="offset points", color=ink, fontsize=9,
                  arrowprops={"arrowstyle": "-", "color": "#71828e"})
    axis.axhline(0.9, color="#ab542d", linestyle="--", linewidth=1, label="Objetivo 0.9 °C²")
    axis.set_xticks([1, 9, 15, 25, 35, 45, 55, 65, 75, 85, 95])
    axis.set_xlabel("Número de vecinos (k)", color=muted)
    axis.set_ylabel("MSE de calibración (°C²)", color=muted)
    axis.tick_params(length=0, colors=muted, labelsize=9)
    axis.spines[:].set_visible(False)
    axis.set_axisbelow(True)
    axis.grid(axis="y", color="#dce4e9", linewidth=0.8)
    axis.legend(loc="lower left", bbox_to_anchor=(0, 1.01), frameon=False, ncol=3, fontsize=9)
    figure.text(0.105, 0.068, f"Destinos de calibración {origins[0] + lead}–{origins[-1] + lead} · datos SMN/CONAGUA vía DataMX",
                color=muted, fontsize=9)

    output.parent.mkdir(parents=True, exist_ok=True)
    figure.savefig(output, dpi=160, facecolor=paper)
    plt.close(figure)
    results.to_csv(output.with_suffix(".csv"), index=False, float_format="%.6f")
    print(f"Modelo usado k={k}, MSE={scores[original]:.4f} | mínimo explorado k={best[0]}, MSE={scores[best]:.4f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=SOURCE)
    parser.add_argument("--anio", type=int, default=2032)
    parser.add_argument("--salida", type=Path, default=HERE / "mexico_iteracion_2" / "curva_codo_knn.png")
    args = parser.parse_args()
    generate(args.csv, args.salida, args.anio)
