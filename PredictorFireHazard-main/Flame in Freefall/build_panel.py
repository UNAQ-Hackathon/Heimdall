"""Genera un panel HTML autónomo a partir de la validación real del predictor."""
import argparse
import csv
import json
import math
import re
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CHALLENGE = "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/"
PSI = "https://psi.nasa.gov/physci/repo/data/investigations/"
NUMERIC = ("observado_s", "estimado_s", "baseline_s", "presion_mmhg", "o2_fraccion",
           "n2_fraccion", "co2_fraccion", "he_fraccion", "diametro_mm")


def csv_rows(path):
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return list(csv.reader(path.read_text(encoding=encoding).splitlines(keepends=True)))
        except UnicodeDecodeError:
            pass
    raise ValueError(f"No se pudo leer {path}")


def catalog(train):
    sources, unique = [], set()
    for source in sorted(train.rglob("*.csv")):
        match = re.match(r"PSI-(\d+)_Experimental table_(.+)", source.stem)
        if not match:
            continue
        key, name = match.groups()
        raw = source.read_bytes()
        duplicate = raw in unique
        unique.add(raw)
        rows = csv_rows(source)
        sources.append(dict(
            id=f"PSI-{key}", name=name, rows=sum(any(c.strip() for c in row) for row in rows[1:]),
            url=PSI + f"PSI-{key}", duplicate=duplicate,
            use=("Modelo de duración" if key == "69" else "Consulta"),
        ))
    if not sources:
        raise ValueError(f"No hay tablas experimentales reconocidas en {train}")
    return sources


def panel_data(train, results):
    summary = json.loads((results / "resumen.json").read_text(encoding="utf-8-sig"))
    with (results / "validacion.csv").open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise ValueError("No hay predicciones fuera de muestra.")
    for row in rows:
        for key in NUMERIC:
            raw = row.get(key)
            if raw in (None, "") and key not in NUMERIC[:3]:
                row[key] = None
                continue
            row[key] = float(raw)
            if not math.isfinite(row[key]):
                raise ValueError(f"Campo no finito: {key}")
        row["error_s"] = row["estimado_s"] - row["observado_s"]
    for key, observed in {
        "mae_s": statistics.mean(abs(r["error_s"]) for r in rows),
        "mae_baseline_s": statistics.mean(abs(r["baseline_s"] - r["observado_s"]) for r in rows),
        "rmse_s": math.sqrt(statistics.mean(r["error_s"] ** 2 for r in rows)),
    }.items():
        if key in summary and not math.isclose(observed, summary[key], abs_tol=1e-5):
            raise ValueError(f"La métrica {key} no coincide con las filas de validación.")
        summary[key] = observed
    model = json.loads((results / "modelo.json").read_text(encoding="utf-8-sig"))
    if model["tipo"] != summary["modelo_final"] or model["sha256_entrada"] != summary["sha256_entrada"]:
        raise ValueError("El modelo y el resumen proceden de entrenamientos distintos.")
    return {"rows": rows, "summary": summary, "catalog": catalog(train), "model": model}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train", type=Path, required=True)
    parser.add_argument("--resultados", type=Path, default=ROOT / "predictor" / "resultados")
    parser.add_argument("--output", type=Path, default=ROOT / "Flame in Freefall.html")
    args = parser.parse_args()
    payload = json.dumps(panel_data(args.train, args.resultados), ensure_ascii=False,
                         allow_nan=False, separators=(",", ":")).replace("<", "\\u003c")
    template = (ROOT / "panel.html").read_text(encoding="utf-8")
    args.output.write_text(template.replace("__PANEL_DATA__", payload, 1), encoding="utf-8")
    print(args.output)


if __name__ == "__main__":
    main()
