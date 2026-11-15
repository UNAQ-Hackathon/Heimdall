"""Incrusta un modelo KNN v2 entrenado en una interfaz local sin servidor."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def serializar(obj):
    return json.dumps(obj, ensure_ascii=False, allow_nan=False, separators=(",", ":")).replace("<", "\\u003c")


def main():
    results = HERE / "knn" / "resultados"
    model = json.loads((results / "modelo.json").read_text(encoding="utf-8"))
    summary = json.loads((results / "resumen.json").read_text(encoding="utf-8"))
    context = json.loads((HERE / "contexto" / "atmosferas_planetarias.json").read_text(encoding="utf-8"))
    if model.get("version") != 2 or len(model["x"]) != len(model["ensayos"]) or len(model["y"]) != len(model["x"]):
        raise ValueError("El archivo no es un modelo KNN v2 completo.")
    template = (HERE / "panel_base.html").read_text(encoding="utf-8")
    figures = sorted(p for p in (HERE / "graficas").glob("[0-9][0-9]_*.png"))
    figures = [{"path": f.relative_to(HERE).as_posix(), "title": f.stem.replace("_", " ")} for f in figures]
    payload = {"modelo": model, "graficas": figures, "contexto": context, "resumen": summary}
    (HERE / "Explorar KNN.html").write_text(template.replace("__DATOS_KNN__", serializar(payload), 1), encoding="utf-8")


if __name__ == "__main__":
    main()
