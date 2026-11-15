"""Gráficas reproducibles de FLEX. Requiere NumPy y Matplotlib."""
import argparse
import csv
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from statistics import median

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.lines import Line2D
import numpy as np

HERE = Path(__file__).resolve().parent
REGISTRO = "https://doi.org/10.60555/mbq8-0451"
COLOR = dict(Methanol="#196c93", Heptane="#b1542b")
MARCA = dict(Methanol="o", Heptane="s")
FUEL = dict(Methanol="Metanol", Heptane="Heptano")
MIX = ("O₂/N₂", "CO₂", "He")
FACTORES = [
    ("diametro_mm", "Diámetro inicial (mm)"),
    ("presion_mmhg", "Presión ambiente (mmHg)"),
    ("o2_fraccion", "O₂ (fracción molar)"),
    ("n2_fraccion", "N₂ (fracción molar)"),
    ("co2_fraccion", "CO₂ (fracción molar)"),
    ("he_fraccion", "He (fracción molar)"),
    ("p_o2", "Presión parcial O₂ (mmHg)"),
]
TERMINO = dict(Extinction="Extinción", Disruption="Disrupción", Completion="Finalización")
LIGHT = "#f7f9fc"
INK = "#1b2b3d"
SLATE = "#506277"
GRID = "#dce4ed"
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 10, "figure.facecolor": LIGHT,
    "axes.facecolor": "white", "axes.edgecolor": GRID, "axes.labelcolor": INK,
    "axes.titlecolor": INK, "text.color": INK, "xtick.color": SLATE, "ytick.color": SLATE,
    "axes.spines.top": False, "axes.spines.right": False, "grid.color": GRID,
    "figure.dpi": 130, "savefig.dpi": 170,
})


def records(path):
    with path.open(encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def point_data(rows):
    for r in rows:
        for key in ("observado_s", "estimado_s", "baseline_s",
                    *(f[0] for f in FACTORES if f[0] != "p_o2")):
            r[key] = float(r[key])
        r["p_o2"] = r["presion_mmhg"] * r["o2_fraccion"]
        r["date"] = date.fromisoformat(r.get("fecha") or r["grupo"])
    return rows


def fig_base(title, subtitle, width=12.4, height=6.8):
    fig = plt.figure(figsize=(width, height))
    fig.text(.075, .96, title, fontsize=20, fontweight="bold", va="top")
    fig.text(.075, .90, subtitle, color=SLATE, va="top", fontsize=10)
    return fig


def export(fig, out, name, foot):
    fig.text(.075, .027, foot, color=SLATE, fontsize=8, va="bottom")
    fig.savefig(out / name, facecolor=fig.get_facecolor())
    plt.close(fig)


def strata(rows):
    groups = defaultdict(list)
    for r in rows:
        groups[(r["fuel"], r["mezcla"])].append(r)
    return groups


def overview(rows, out):
    groups = strata(rows)
    fig = fig_base("Duración de combustión por mezcla y combustible",
                   "Cada punto es un ensayo FLEX. La línea oscura señala la mediana y la caja el 50 % central.")
    axes = fig.subplots(1, 3, sharey=True)
    fig.subplots_adjust(left=.075, bottom=.16, right=.97, top=.80, wspace=.10)
    rng = np.random.default_rng(69)
    for ax, mix in zip(axes, MIX):
        ax.set_title("O₂/N₂ sin CO₂ ni He" if mix == "O₂/N₂" else f"Mezcla con {mix}", fontweight="bold")
        for j, fuel in enumerate(COLOR, start=1):
            items = groups[(fuel, mix)]
            y = [r["observado_s"] for r in items]
            if not y:
                continue
            ax.boxplot(y, positions=[j], widths=.43, patch_artist=True, showfliers=False,
                       medianprops={"color": INK, "linewidth": 2.4},
                       boxprops={"facecolor": COLOR[fuel]+"23", "edgecolor": COLOR[fuel]},
                       capprops={"color": COLOR[fuel]}, whiskerprops={"color": COLOR[fuel]})
            ax.scatter(j+rng.uniform(-.19, .19, len(y)), y, s=14, alpha=.49, zorder=3,
                       c=COLOR[fuel], marker=MARCA[fuel], linewidths=0)
        ax.set_xticks([1, 2], [f"{FUEL[fuel]}\nn = {len(groups[(fuel, mix)])}" for fuel in COLOR])
        ax.grid(axis="y"); ax.set_xlim(.5, 2.5); ax.set_ylim(0, 42)
    axes[0].set_ylabel("Duración registrada (s)")
    export(fig, out, "01_mezclas.png", "NASA FLEX / PSI-69. Las mezclas con CO₂ o He también contienen O₂. Las condiciones no se asignaron al azar.")


def relationships(rows, out):
    groups = strata(rows)
    fig = fig_base("Diámetro, presión parcial de O₂ y duración",
                   "Seis comparaciones por separado. La línea conecta medianas de tramos del diámetro con al menos 5 ensayos.", height=8.3)
    axes = fig.subplots(2, 3, sharex=True, sharey=True)
    fig.subplots_adjust(left=.075, bottom=.115, right=.88, top=.81, hspace=.41, wspace=.12)
    p = [r["p_o2"] for r in rows]
    norm = matplotlib.colors.Normalize(min(p), max(p))
    for i, fuel in enumerate(COLOR):
        for j, mix in enumerate(MIX):
            ax = axes[i, j]
            items = groups[(fuel, mix)]
            x = np.array([r["diametro_mm"] for r in items])
            y = np.array([r["observado_s"] for r in items])
            ax.set_title(f"{FUEL[fuel]} · {mix} · n = {len(items)}", fontsize=11, fontweight="bold")
            ax.grid(alpha=.75)
            ax.scatter(x, y, c=[r["p_o2"] for r in items], cmap="cividis", norm=norm, s=29,
                       edgecolors="white", linewidths=.35, marker=MARCA[fuel], zorder=3)
            curve = []
            # Bordes comunes; al comparar mezclas, un mismo tramo representa el mismo diámetro.
            edges = np.arange(1.0, 5.01, .5)
            for low, high in zip(edges, edges[1:]):
                sel = (x >= low) & (x < high)
                if sel.sum() >= 5:
                    curve.append((median(x[sel]), median(y[sel])))
                elif curve:
                    # No unir tramos separados por huecos de cobertura.
                    ax.plot(*np.asarray(curve).T, color=INK, linewidth=1.55, marker="D", ms=3.8, zorder=4)
                    curve = []
            if curve:
                ax.plot(*np.asarray(curve).T, color=INK, linewidth=1.55, marker="D", ms=3.8, zorder=4)
            if j == 0:
                ax.set_ylabel("Duración (s)")
            if i == 1:
                ax.set_xlabel("Diámetro inicial (mm)")
    cax = fig.add_axes([.902, .18, .018, .57])
    fig.colorbar(matplotlib.cm.ScalarMappable(norm=norm, cmap="cividis"), cax=cax,
                 label="Presión parcial de O₂ (mmHg)")
    export(fig, out, "02_relaciones.png", "Presión parcial = presión ambiente × fracción molar de O₂. Las relaciones son descriptivas; no aíslan el efecto de un factor.")


def ranks(v):
    order = np.argsort(v, kind="stable")
    sorted_v = np.asarray(v)[order]
    result = np.empty(len(v), dtype=float)
    start = 0
    while start < len(order):
        end = start+1
        while end < len(order) and sorted_v[end] == sorted_v[start]:
            end += 1
        result[order[start:end]] = (start+end+1)/2
        start = end
    return result


def correlations(rows, out):
    groups = strata(rows)
    keys = [(fuel, mix) for fuel in COLOR for mix in MIX]
    result = np.full((len(keys), len(FACTORES)), np.nan)
    for i, key in enumerate(keys):
        items = groups[key]
        y = [r["observado_s"] for r in items]
        for j, (field, _) in enumerate(FACTORES):
            x = [r[field] for r in items]
            if len(x) >= 10 and len(set(x)) > 1 and len(set(y)) > 1:
                result[i, j] = np.corrcoef(ranks(x), ranks(y))[0, 1]
    fig = fig_base("Relación de cada factor con la duración",
                   "Correlación de Spearman dentro de cada combustible y mezcla. ±1 = asociación monotónica más fuerte.", height=6.8)
    ax = fig.add_axes([.20, .29, .70, .51])
    cmap = plt.get_cmap("RdBu_r").copy()
    cmap.set_bad("#edf1f6")
    hm = ax.imshow(result, cmap=cmap, vmin=-1, vmax=1, aspect="auto")
    ax.set_yticks(range(len(keys)), [f"{FUEL[f]} · {m}  (n={len(groups[(f,m)])})" for f, m in keys])
    ax.set_xticks(range(len(FACTORES)), ["Diámetro\ninicial", "Presión\nambiente", "Fracción\nO₂", "Fracción\nN₂", "Fracción\nCO₂", "Fracción\nHe", "Presión\nparcial O₂"])
    for i, vals in enumerate(result):
        for j, v in enumerate(vals):
            ax.text(j, i, "—" if np.isnan(v) else f"{v:+.2f}", ha="center", va="center",
                    color="white" if abs(v) > .67 else INK, fontweight="bold")
    ax.tick_params(length=0)
    cax = fig.add_axes([.31, .14, .40, .025])
    fig.colorbar(hm, cax=cax, orientation="horizontal", ticks=[-1, -.5, 0, .5, 1])
    fig.text(.50, .078, "ρ de Spearman · —: variable constante o muestra insuficiente", ha="center", fontsize=9, color=SLATE)
    export(fig, out, "03_correlaciones.png", "Las fracciones suman aproximadamente 1; sus relaciones no son independientes. No se infiere causalidad ni se reportan p-valores.")
    return keys, result


def extremes(rows, out, actual_dates):
    fig = fig_base("Picos y bajas registrados en los ensayos FLEX",
                   "Se muestran mediciones en sus fechas, sin interpolarlas. Los puntos no son una serie continua de una misma llama.", height=7.4)
    axes = fig.subplots(2, 1, sharex=True, sharey=True)
    fig.subplots_adjust(left=.09, bottom=.13, right=.91, top=.80, hspace=.29)
    extrema = {}
    for ax, fuel in zip(axes, COLOR):
        items = sorted((r for r in rows if r["fuel"] == fuel), key=lambda r: (r["date"], r["prueba"]))
        dates = [r["date"] for r in items]
        x = mdates.date2num(dates)
        y = np.array([r["observado_s"] for r in items])
        ax.scatter(x, y, c=COLOR[fuel], s=21, marker=MARCA[fuel], alpha=.56, linewidths=0)
        extrema[fuel] = []
        for is_max, j in ((True, int(np.argmax(y))), (False, int(np.argmin(y)))):
            obs = items[j]
            extrema[fuel].append(obs)
            align = "right" if x[j] > x.min()+(x.max()-x.min())*.5 else "left"
            ax.scatter([x[j]], [y[j]], c=COLOR[fuel], marker="^" if is_max else "v", s=95,
                       edgecolors=INK, linewidths=1.1, zorder=4)
            dx, dy = (-10 if align == "right" else 10), (-11 if is_max else 11)
            ax.annotate(f"{'Máximo' if is_max else 'Mínimo'} {y[j]:g} s · #{obs['prueba']}",
                        (x[j], y[j]), xytext=(dx, dy), textcoords="offset points",
                        ha=align, va="top" if is_max else "bottom", fontsize=9,
                        bbox={"facecolor": "white", "edgecolor": GRID, "pad": 3})
        ax.set_title(f"{FUEL[fuel]} · n = {len(items)}", loc="left", fontweight="bold")
        ax.set_ylabel("Duración (s)")
        ax.set_ylim(0, 42)
        ax.grid(alpha=.7)
    locate = mdates.AutoDateLocator(minticks=4, maxticks=8)
    axes[-1].xaxis.set_major_locator(locate)
    axes[-1].xaxis.set_major_formatter(mdates.ConciseDateFormatter(locate))
    axes[-1].set_xlabel("Fecha del ensayo" if actual_dates else "Fecha del grupo de validación")
    export(fig, out, "04_picos_bajas.png", "Los extremos son mediciones del ensayo. Extinción, disrupción y finalización pueden producir duraciones diferentes.")
    return extrema


def tuning(config, parts, out):
    fig = fig_base("Cómo se eligió y evaluó el KNN",
                   "Se comparan configuraciones en validación agrupada. Las curvas no son épocas de aprendizaje.", height=7.15)
    left, right = fig.subplots(1, 2)
    fig.subplots_adjust(left=.075, bottom=.15, right=.97, top=.79, wspace=.3)
    by = defaultdict(list)
    for r in config:
        if r.get("k") and r.get("mae_s"):
            by[int(r["k"])].append(float(r["mae_s"]))
    ks = np.array(sorted(by))
    maes = np.array([min(by[k]) for k in ks])
    med = np.array([median(by[k]) for k in ks])
    hi = np.array([max(by[k]) for k in ks])
    left.fill_between(ks, maes, hi, color="#bcd7ea", alpha=.48, label="Rango de configuraciones")
    left.plot(ks, med, color="#62758d", marker="o", ms=4, label="Mediana por k")
    left.plot(ks, maes, color="#196c93", marker="D", ms=4, label="Mejor por k")
    best = int(np.argmin(maes))
    left.annotate(f"k={ks[best]} · {maes[best]:.2f} s", (ks[best], maes[best]),
                  xytext=(10, 10), textcoords="offset points", fontsize=9, fontweight="bold")
    left.set(xlabel="Número de vecinos (k)", ylabel="Error absoluto medio (s)")
    left.set_title(f"A  Selección de k · {sum(len(v) for v in by.values())} configuraciones", loc="left", fontweight="bold")
    left.grid(axis="y"); left.legend(loc="upper left", fontsize=8)
    x = np.arange(len(parts))
    e = np.array([int(r["n_entrenamiento"]) for r in parts])
    t = np.array([int(r["n_prueba"]) for r in parts])
    labs = [f"F{r['fold']}" if r["protocolo"] == "agrupado" else "Temporal" for r in parts]
    right.bar(x, e, color="#315f80", label="Entrenamiento")
    right.bar(x, t, bottom=e, color="#c57441", label="Prueba reservada")
    right.set_xticks(x, labs)
    right.tick_params(axis="x", labelsize=9)
    for j, r in enumerate(parts):
        right.text(j, e[j]/2, str(e[j]), ha="center", va="center", color="white", fontweight="bold")
        right.text(j, e[j]+t[j]/2, str(t[j]), ha="center", va="center", color="white", fontweight="bold")
        right.text(j, e[j]+t[j]+5, f"{r['n_grupos_prueba']} g.", ha="center", va="bottom", color=SLATE, fontsize=8)
    right.set_ylim(0, max(e+t)*1.18)
    right.set_ylabel("Ensayos")
    right.set_title("B  División por grupos experimentales", loc="left", fontweight="bold")
    right.legend(loc="lower left", fontsize=8)
    export(fig, out, "05_division_knn.png", "F1–F5: particiones; g.: grupos de prueba. La prueba temporal se separa por fecha. La selección usa datos de entrenamiento.")


def errors(rows, chronological, out):
    fig = fig_base("Error del KNN frente a referencias",
                   "Error absoluto medio fuera de muestra. Comparar dentro de cada partición; más bajo es mejor.")
    ax = fig.add_axes([.085, .18, .88, .63])
    by_fold = defaultdict(list)
    for r in sorted(rows, key=lambda r: int(r["fold"])):
        by_fold[f"F{r['fold']}"].append(r)
    if chronological:
        by_fold["Temporal"] = chronological
    series = [("estimado_s", "KNN ajustado", "#196c93"), ("anterior_s", "KNN anterior", "#7397b3"),
              ("baseline_s", "Mediana de entrenamiento", "#b1542b")]
    if not all(r.get("anterior_s") for items in by_fold.values() for r in items):
        series.pop(1)
    x = np.arange(len(by_fold))
    count = len(series)
    for i, (key, label, color) in enumerate(series):
        mae = [float(np.mean([abs(float(r[key]) - r["observado_s"]) for r in vv])) for vv in by_fold.values()]
        b = ax.bar(x + (i-(count-1)/2)*.25, mae, width=.23, label=label, color=color)
        ax.bar_label(b, fmt="%.2f", padding=3, fontsize=8)
    ax.set_xticks(x, [f"{key}\nn = {len(vv)}" for key, vv in by_fold.items()])
    ax.set_ylabel("Error absoluto medio (s)")
    ax.legend(ncol=3); ax.grid(axis="y"); ax.set_axisbelow(True)
    ax.set_ylim(0, ax.get_ylim()[1]*1.18)
    export(fig, out, "06_error_knn.png", "La prueba cronológica mide cambio de condiciones a lo largo de la campaña; no demuestra rendimiento en otros experimentos.")


def local_example(neighbors, out):
    grouped = defaultdict(list)
    for r in neighbors:
        if r.get("protocolo", "agrupado") == "agrupado" and float(r["peso"]) > 0:
            grouped[(r["consulta"], r["fold"])].append(r)
    # Usa el caso de error mediano entre las consultas con al menos tres vecinos,
    # en lugar de elegir un ejemplo de acierto excepcional.
    eligible = [v for v in grouped.values() if len(v) >= 3] or list(grouped.values())
    sorted_cases = sorted(eligible, key=lambda v: abs(float(v[0]["consulta_estimado_s"])-float(v[0]["consulta_observado_s"])))
    items = sorted_cases[len(sorted_cases)//2]
    q = items[0]
    fuel = FUEL.get(q["fuel"], q["fuel"])
    label_q = f"Consulta #{q['consulta']} · {fuel} · {q['mezcla']} · F{q['fold']}"
    fig = fig_base("Los vecinos que sustentan una estimación", label_q, height=7)
    ax, bars = fig.subplots(1, 2, gridspec_kw={"width_ratios": [1.10, 1]})
    fig.subplots_adjust(left=.09, bottom=.16, right=.94, top=.80, wspace=.35)
    for r in items:
        xx, yy = float(r["vecino_diametro_mm"]), 100*float(r["vecino_o2_fraccion"])
        ax.scatter(xx, yy, c="#196c93", s=58, marker="o", edgecolors="white", linewidths=.8)
    ax.scatter(float(q["consulta_diametro_mm"]), 100*float(q["consulta_o2_fraccion"]), s=135,
               c="#b1542b", marker="D", linewidths=.9, edgecolors="white", zorder=4)
    ax.set(xlabel="Diámetro inicial (mm)", ylabel="O₂ (fracción molar, %)")
    ax.set_title("A  Proyección de dos variables", loc="left", fontweight="bold"); ax.grid()
    ax.legend(handles=[Line2D([], [], marker="D", color="#b1542b", ls="", label="Consulta reservada"),
                       Line2D([], [], marker="o", color="#196c93", ls="", label="Vecinos de entrenamiento")])
    vals = np.array([float(r["vecino_observado_s"]) for r in items])
    index = range(len(items))
    bars.barh(index, vals, color="#315f80")
    bars.set_yticks(index, [f"#{r['vecino']} · {float(r['peso']):.0%}" for r in items], fontsize=8)
    bars.invert_yaxis()
    obs, pred = float(q["consulta_observado_s"]), float(q["consulta_estimado_s"])
    bars.axvline(pred, color="#b1542b", linewidth=2, label=f"KNN: {pred:.2f} s")
    bars.axvline(obs, color=INK, linewidth=1.5, linestyle="--", label=f"Observado: {obs:.2f} s")
    bars.set_xlabel("Duración (s)")
    bars.set_title("B  Duración y peso de cada ensayo", loc="left", fontweight="bold")
    bars.legend(fontsize=8, loc="lower right")
    export(fig, out, "07_vecinos_knn.png", "Ejemplo de error mediano entre consultas con ≥3 vecinos. La distancia se calcula en el espacio completo, no en la proyección.")


def factor_links(rows, out):
    fig = fig_base("Relaciones entre las condiciones iniciales",
                   "La matriz muestra asociaciones descriptivas de Spearman dentro de cada combustible.", height=7.1)
    axs = fig.subplots(1, 2)
    fig.subplots_adjust(left=.13, bottom=.195, right=.94, top=.81, wspace=.30)
    names = ["Diámetro", "Presión", "O₂", "N₂", "CO₂", "He", "pO₂"]
    for ax, fuel in zip(axs, COLOR):
        items = [r for r in rows if r["fuel"] == fuel]
        values = [ranks([r[key] for r in items]) for key, _ in FACTORES]
        mat = np.corrcoef(values)
        ax.imshow(mat, cmap="RdBu_r", vmin=-1, vmax=1)
        ax.set_title(f"{FUEL[fuel]} · n = {len(items)}", fontweight="bold")
        ax.set_xticks(range(len(names)), names, rotation=40, ha="right")
        ax.set_yticks(range(len(names)), names)
        ax.tick_params(length=0)
        for i, line in enumerate(mat):
            for j, v in enumerate(line):
                ax.text(j, i, f"{v:+.2f}", fontsize=8, ha="center", va="center",
                        color="white" if abs(v)>.70 else INK, fontweight="bold")
    export(fig, out, "08_relacion_entre_factores.png", "pO₂ es presión × fracción de O₂. Las fracciones están ligadas por la suma ≈ 1; correlaciones no implican causalidad.")


def subgroup_errors(metrics, out):
    fig = fig_base("Error y cobertura del modelo por mezcla",
                   "La cobertura cuenta ensayos dentro de los rangos individuales del mismo combustible y mezcla en entrenamiento.", height=8)
    axes = fig.subplots(1, 2, sharex=True)
    fig.subplots_adjust(left=.25, bottom=.13, right=.96, top=.79, wspace=.18)
    relevant = [r for r in metrics if r["agrupacion"] == "mezcla_y_combustible"]
    for ax, protocol, title in zip(axes, ("agrupado", "cronologico"),
                                    ("A  Días de ensayo reservados", "B  Últimos días de la campaña")):
        groups = {(r["fuel"], r["mezcla"]): r for r in relevant if r["protocolo"] == protocol}
        keys = [(f, m) for f in COLOR for m in MIX]
        for i, key in enumerate(keys):
            r = groups.get(key)
            if ax is axes[0]:
                ax.text(-.04, i, f"{FUEL[key[0]]} · {key[1]}", transform=ax.get_yaxis_transform(),
                        va="center", ha="right", fontsize=9)
            if r is None:
                ax.text(.20, i, "Sin ensayos en el corte", va="center", fontsize=8, color=SLATE)
                continue
            mae, base = float(r["mae_s"]), float(r["mae_baseline_s"])
            ax.scatter([mae], [i], s=55, color="#196c93", marker="o", zorder=4)
            ax.scatter([base], [i], s=55, color="#b1542b", marker="s", zorder=4)
            ax.hlines(i, min(mae,base), max(mae,base), color="#a1b1c2", linewidth=1.4, zorder=3)
            ax.text(.19, i+.29, f"n={r['n']} · en rango {r['n_dentro_rango']}/{r['n']}", fontsize=8, color=SLATE)
        ax.set_yticks([])
        ax.set_ylim(len(keys)-.4, -.55)
        ax.set_title(title, fontweight="bold", fontsize=11, loc="left")
        ax.set_xlabel("Error absoluto medio (s)")
        ax.grid(axis="x")
    observed = max(float(r[k]) for r in relevant for k in ("mae_s", "mae_baseline_s"))
    axes[0].set_xlim(0, observed*1.12)
    fig.legend(handles=[Line2D([], [], marker="o", color="#196c93", ls="", label="KNN ajustado"),
                        Line2D([], [], marker="s", color="#b1542b", ls="", label="Mediana global")],
               loc="upper center", bbox_to_anchor=(.58, .867), ncol=2, frameon=False)
    export(fig, out, "09_error_por_mezcla.png", "Se audita el error incluso fuera de rango. Cuando se predice un caso nuevo, la aplicación bloquea entradas fuera de rango.")


def write_report(rows, key_groups, matrix, extrema, path, metrics=None):
    groups = strata(rows)
    lines = ["# Hallazgos de FLEX", "", f"Fuente: [NASA FLEX, PSI-69]({REGISTRO}). "
             f"Este análisis describe {len(rows)} ensayos válidos de 274 registros, sin imputar los excluidos. "
             "La duración registrada puede corresponder a extinción, disrupción o finalización. "
             "No representa tiempo hasta autoextinción para toda la muestra.", "",
             "## Mezclas y relaciones", "",
             "| Combustible | Mezcla | n | Mediana (s) | Mediana diámetro (mm) | Mediana presión (mmHg) |",
             "|---|---|---:|---:|---:|---:|"]
    for fuel, mix in key_groups:
        v = groups[(fuel, mix)]
        q = [median([r[k] for r in v]) for k in ("observado_s", "diametro_mm", "presion_mmhg")]
        lines.append(f"| {FUEL[fuel]} | {mix} | {len(v)} | {q[0]:.2f} | {q[1]:.2f} | {q[2]:.1f} |")
    lines += ["", "Las mezclas con CO₂ o He no son atmósferas de un solo gas: también contienen O₂. "
              "En FLEX las distribuciones de diámetro, presión y composición cambian entre subgrupos; sus medianas no son efectos aislados. "
              "Una asociación con presión parcial de O₂ no aporta evidencia separada de presión y fracción de O₂.", "",
              "Asociaciones monotónicas de mayor magnitud por estrato (descriptivas, sin inferencia causal):", ""]
    for (fuel,mix), aa in zip(key_groups, matrix):
        j = int(np.nanargmax(np.abs(aa)))
        lines.append(f"- {FUEL[fuel]}, {mix}: {FACTORES[j][1]}, ρ = {aa[j]:+.2f} (n = {len(groups[(fuel,mix)])}).")
    lines += ["", "## Picos y bajas", "",
              "Son máximos y mínimos observados por combustible, no puntos de inflexión ni tendencias cronológicas. "
              "Las fechas ordenan corridas independientes con condiciones cambiantes.", "",
              "| Combustible | Extremo | Ensayo | Fecha | Duración (s) | Mezcla | Fin registrado |",
              "|---|---|---|---|---:|---|---|"]
    for fuel, points in extrema.items():
        for tip, r in zip(("Máximo","Mínimo"), points):
            lines.append(f"| {FUEL[fuel]} | {tip} | #{r['prueba']} ({r['identificador']}) | {r['date']} | {r['observado_s']:.2f} | {r['mezcla']} | {TERMINO.get(r['fin_ensayo'],r['fin_ensayo'])} |")
    lines += ["", "Extremos separados por mezcla y combustible:", "",
              "| Combustible | Mezcla | Mínimo (s) / ensayo | Máximo (s) / ensayo |",
              "|---|---|---|---|"]
    for fuel,mix in key_groups:
        items = groups[(fuel,mix)]
        low, high = (fun(items, key=lambda r: r["observado_s"]) for fun in (min,max))
        lines.append(f"| {FUEL[fuel]} | {mix} | {low['observado_s']:.2f} / #{low['prueba']} | {high['observado_s']:.2f} / #{high['prueba']} |")
    lines += ["", "## Gráficas y lectura del KNN", "",
              "La curva de k resume una búsqueda de configuraciones, no aprendizaje por épocas. "
              "La validación da a cada grupo un único papel dentro de cada partición. "
              "La proyección de vecinos utiliza dos variables solo para ilustrar el caso; el cálculo considera el espacio completo. "
              "Consulte el resumen del entrenamiento para el método de selección y la comparación cronológica.", "",
              "Reproducir: `py graficar_flex.py --resultados ..\\knn\\resultados` (NumPy y Matplotlib).", ""]
    if metrics:
        he = next((r for r in metrics if r["protocolo"] == "cronologico"
                   and r["agrupacion"] == "mezcla" and r["mezcla"] == "He"), None)
        he_note = (f"El corte cronológico contiene {he['n']} ensayos con He; {he['n_dentro_rango']} "
                   "entran en los rangos individuales del mismo combustible y mezcla del entrenamiento. "
                   "Ese cambio de condiciones limita la evaluación prospectiva." if he
                   else "El corte cronológico no contiene ensayos con He.")
        lines += ["## Error por mezcla y cobertura", "",
                  he_note, "",
                  "| Validación | Combustible | Mezcla | n | En rango | MAE KNN (s) | MAE mediana (s) |",
                  "|---|---|---|---:|---:|---:|---:|"]
        for r in metrics:
            if r["agrupacion"] == "mezcla_y_combustible":
                proto = "Por fecha" if r["protocolo"]=="agrupado" else "Cronológica"
                lines.append(f"| {proto} | {FUEL[r['fuel']]} | {r['mezcla']} | {r['n']} | {r['n_dentro_rango']} | {float(r['mae_s']):.2f} | {float(r['mae_baseline_s']):.2f} |")
    path.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--resultados", type=Path, default=HERE.parent/"knn"/"resultados")
    parser.add_argument("--salida", type=Path, default=HERE)
    parser.add_argument("--solo-descriptivo", action="store_true")
    args = parser.parse_args()
    args.salida.mkdir(parents=True, exist_ok=True)
    raw = records(args.resultados/"validacion.csv")
    actual_dates = all(r.get("fecha") for r in raw)
    rows = point_data(raw)
    if len(rows) != len(set(r["prueba"] for r in rows)):
        raise ValueError("Hay números de ensayo repetidos en validacion.csv.")
    overview(rows, args.salida)
    relationships(rows, args.salida)
    factor_links(rows, args.salida)
    keys, matrix = correlations(rows, args.salida)
    ext = extremes(rows, args.salida, actual_dates)
    metrics = None
    if not args.solo_descriptivo:
        tuning(records(args.resultados/"configuraciones.csv"), records(args.resultados/"particiones.csv"), args.salida)
        chrono = point_data(records(args.resultados/"validacion_temporal.csv"))
        errors(rows, chrono, args.salida)
        neighbors = records(args.resultados/"vecinos_validacion.csv")
        if neighbors:
            local_example(neighbors, args.salida)
        metrics = records(args.resultados/"metricas_mezclas.csv")
        subgroup_errors(metrics, args.salida)
    write_report(rows, keys, matrix, ext, args.salida/"Hallazgos FLEX.md", metrics)
    print("Gráficas guardadas:", args.salida)


if __name__ == "__main__":
    main()
