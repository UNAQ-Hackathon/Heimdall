import hashlib
import json
from functools import lru_cache

from firehazr import SOURCE_DIR
from firehazr.knn_cobertura import forecast

LIMITATION = (
    "Experimental microgravity droplet burn duration only; not a fire-risk probability, "
    "ignition threshold, suppression ranking, or safety assessment. No planetary extrapolation. "
    "Argon and xenon are outside this FLEX model."
)


ARTIFACT_SHA256 = {
    "modelo.json": "6e87ef04d476a36e32969f6de0770f67d89695919510b4c2bb6bec71a570869d",
    "resumen.json": "bc1745f7d9a62198aa5b8f10dbfcb3400c269986b0cfeab68ddc06501add0a35",
}


def read_artifact(name):
    text = (SOURCE_DIR / "resultados" / name).read_text(encoding="utf-8")
    if hashlib.sha256(text.encode("utf-8")).hexdigest() != ARTIFACT_SHA256[name]:
        raise ValueError("FireHazR JSON artifact fingerprint mismatch")
    return json.loads(text)


@lru_cache(maxsize=1)
def load_artifacts():
    model = read_artifact("modelo.json")
    summary = read_artifact("resumen.json")
    if model.get("version") != 3 or summary.get("sha256_entrada") != model.get("sha256_entrada"):
        raise ValueError("FireHazR model version or training provenance mismatch")
    if summary["n_filas"] != len(model["ensayos"]) or summary["modelo_final"] != model["config"]:
        raise ValueError("FireHazR model and validation summary do not match")
    return model, summary


def metadata():
    model, summary = load_artifacts()
    validation = {}
    for name, key in (("grouped", "agrupado"), ("chronological", "cronologico")):
        stats = summary["cobertura"][key]["respaldados"]
        validation[name] = {
            "evaluated": stats["n_total"], "supported": stats["n"],
            "coverage": stats["cobertura"], "mae_s": stats["mae_nuevo_s"],
        }
    return {
        "name": "FireHazR / KNN FLEX v3", "version": model["version"],
        "target": "Recorded droplet burn duration", "unit": "s",
        "fuels": ["Methanol", "Heptane"], "supported_gases": ["O2", "N2", "CO2", "He"],
        "training_trials": summary["n_filas"], "training_groups": summary["n_grupos"],
        "training_sha256": model["sha256_entrada"], "source_url": model["fuente"],
        "source_data_available": False, "artifact_sha256": ARTIFACT_SHA256,
        "configuration": model["config"], "validation": validation, "limitation": LIMITATION,
    }


def predict(body):
    model, _ = load_artifacts()
    return {
        "model": "FireHazR / KNN FLEX v3", "version": 3,
        "source_url": model["fuente"], "training_sha256": model["sha256_entrada"],
        "limitation": LIMITATION,
        "result": forecast(model, body.fuel, body.conditions()),
    }
