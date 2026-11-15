"""Regresión experimental FLEX: candidatos KNN, regresión y referencia mediana."""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import numpy as np


HERE = Path(__file__).resolve().parent
DEFAULT_INPUT = HERE / "data" / "PSI-69_Experimental table_FLEX.csv"
DEFAULT_OUTPUT = HERE / "resultados"
SOURCE = "https://psi.nasa.gov/physci/repo/data/investigations/PSI-69"
REPORT = "https://ntrs.nasa.gov/citations/20150023456"
FEATURES = ("presion_mmhg", "o2_fraccion", "n2_fraccion", "co2_fraccion", "he_fraccion", "diametro_mm")
CSV_FEATURES = (
    "Ambient pressure; mmHg", "O initial ambient composition; mole fraction",
    "N initial ambient composition; mole fraction", "CO initial ambient composition; mole fraction",
    "He initial ambient composition; mole fraction", "Droplet initial diameter; mm",
)
TARGET = "Burn time; s"
FUELS = ("Methanol", "Heptane")
BASELINE = "mediana"
CANDIDATES = (BASELINE, "regresion_1", "regresion_10", "knn_3", "knn_5", "knn_9", "knn_15")
SEED = 1069


@dataclass(frozen=True)
class Ensayo:
    prueba: int
    identificador: str
    grupo: str
    fuel: str
    x: tuple[float, ...]
    duracion: float
    fin_ensayo: str


def number(value: str) -> float:
    clean = value.strip()
    if not clean or clean in ("-", "–", "—") or clean.startswith(("~", "≈", "<", ">")):
        raise ValueError("no hay un número exacto")
    num = float(clean)
    if not np.isfinite(num):
        raise ValueError("número no finito")
    return num


def mixture(xs):
    return ("CO₂ + He" if xs[3] and xs[4] else "CO₂" if xs[3] else "He" if xs[4] else "O₂/N₂")


def validate_conditions(fuel, x):
    if fuel not in FUELS:
        raise ValueError("FLEX solo cubre Methanol y Heptane.")
    if len(x) != len(FEATURES) or not np.all(np.isfinite(x)):
        raise ValueError("Ingresa las seis condiciones iniciales con valores finitos.")
    if x[0] <= 0 or x[5] <= 0:
        raise ValueError("Presión y diámetro deben ser positivos.")
    if any(not 0 <= v <= 1 for v in x[1:5]) or abs(sum(x[1:5])-1) > 0.025:
        raise ValueError("Las fracciones de gases deben sumar 1 (tolerancia de redondeo 0.025).")


def load_experiments(path):
    binary = Path(path).read_bytes()
    try:
        decoded = binary.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = binary.decode("cp1252")
    reader = csv.DictReader(io.StringIO(decoded, newline=""))
    required = {"FLEX Test #", "FLEX Identifier", "Test Date", "Fuel", "Test end", *CSV_FEATURES, TARGET}
    if not reader.fieldnames or not required.issubset(reader.fieldnames):
        raise ValueError("El archivo no tiene el esquema FLEX PSI-69.")
    rows, discarded = [], []
    for row in reader:
        try:
            x = tuple(number(row[name]) for name in CSV_FEATURES)
            y = number(row[TARGET])
            validate_conditions(row["Fuel"], x)
            if y <= 0:
                raise ValueError("duración no positiva")
            fecha = row["Test Date"].strip()
            formato = "%m/%d/%Y" if len(fecha.rsplit("/", 1)[-1]) == 4 else "%m/%d/%y"
            grupo = datetime.strptime(fecha, formato).date().isoformat()
            rows.append(Ensayo(int(row["FLEX Test #"]), row["FLEX Identifier"].strip(), grupo,
                               row["Fuel"], x, y, row["Test end"].strip()))
        except (AttributeError, TypeError, ValueError) as error:
            discarded.append({"prueba": row["FLEX Test #"], "identificador": row["FLEX Identifier"],
                              "motivo": str(error)})
    # Nunca reparte entre folds identificadores repetidos ni condiciones idénticas.
    sessions = {row.grupo: row.grupo for row in rows}
    def root(group):
        while sessions[group] != group:
            group = sessions[group]
        return group
    identifiers, conditions = {}, {}
    for row in rows:
        key = row.identificador or f"FLEX-{row.prueba}"
        if key in identifiers:
            sessions[root(row.grupo)] = root(identifiers[key])
        identifiers[key] = row.grupo
        combination = (row.fuel, row.x)
        if combination in conditions:
            sessions[root(row.grupo)] = root(conditions[combination])
        conditions[combination] = row.grupo
    rows = [Ensayo(r.prueba, r.identificador or f"FLEX-{r.prueba}", root(r.grupo),
                   r.fuel, r.x, r.duracion, r.fin_ensayo) for r in rows]
    if len({r.prueba for r in rows}) != len(rows):
        raise ValueError("Hay números FLEX de prueba repetidos; revisa el origen y la deduplicación.")
    return rows, discarded, hashlib.sha256(binary).hexdigest()


def arrays(rows):
    X = np.array([[*r.x, float(r.fuel == "Heptane")] for r in rows])
    y = np.array([r.duracion for r in rows])
    return X, y


def grouped_folds(rows, n_splits, seed):
    groups = sorted({r.grupo for r in rows})
    if len(groups) < n_splits:
        raise ValueError(f"Se necesitan {n_splits} sesiones de ensayo como mínimo.")
    rng = np.random.default_rng(seed)
    for test_dates in np.array_split(rng.permutation(groups), n_splits):
        dates = set(test_dates)
        train = [r for r in rows if r.grupo not in dates]
        test = [r for r in rows if r.grupo in dates]
        assert not {r.identificador for r in train} & {r.identificador for r in test}
        assert not {r.prueba for r in train} & {r.prueba for r in test}
        assert not {(r.fuel, r.x) for r in train} & {(r.fuel, r.x) for r in test}
        yield train, test


def fit(rows, name):
    X, y = arrays(rows)
    if name == BASELINE:
        return {"tipo": BASELINE, "valor": float(np.median(y))}
    mean = X.mean(0)
    scale = X.std(0)
    scale[scale < 1e-12] = 1
    scale[-1] = 1  # Une categorías por distancia unitaria, no por su frecuencia en el fold.
    Z = (X-mean)/scale
    data = {"tipo": name, "centro": mean.tolist(), "escala": scale.tolist()}
    if name.startswith("knn"):
        data.update(x=Z.tolist(), y=y.tolist(), k=int(name.split("_")[1]))
    else:
        alpha = int(name.split("_")[1])
        coefficients = np.linalg.solve(Z.T @ Z + alpha*np.eye(Z.shape[1]), Z.T@(y-y.mean()))
        data.update(coef=coefficients.tolist(), intercepto=float(y.mean()))
    return data


def knn_neighbors(model, Z):
    dist = np.linalg.norm(Z[:, None, :] - np.array(model["x"])[None, :, :], axis=2)
    idx = np.argsort(dist, axis=1, kind="stable")[:, :model["k"]]
    near = np.take_along_axis(dist, idx, axis=1)
    with_exact = np.any(near < 1e-12, axis=1, keepdims=True)
    weights = np.where(with_exact, near < 1e-12, 1/np.maximum(near, 1e-12))
    return idx, near, weights/weights.sum(axis=1, keepdims=True)


def evaluate_fit(model, X):
    if model["tipo"] == BASELINE:
        return np.full(len(X), model["valor"])
    Z = (X-model["centro"])/model["escala"]
    if model["tipo"].startswith("regresion"):
        return np.maximum(0, model["intercepto"] + Z@model["coef"])
    idx, _, weights = knn_neighbors(model, Z)
    return (weights*np.array(model["y"])[idx]).sum(axis=1)


def select(rows, seed):
    losses, n = dict.fromkeys(CANDIDATES, 0.0), 0
    for train, test in grouped_folds(rows, 4, seed):
        X, y = arrays(test)
        n += len(y)
        for name in CANDIDATES:
            losses[name] += float(np.sum(np.abs(y-evaluate_fit(fit(train, name), X))))
    mean_losses = {name: value/n for name, value in losses.items()}
    return min(mean_losses, key=mean_losses.get), mean_losses


def validation(rows):
    output = []
    for fold, (train, test) in enumerate(grouped_folds(rows, 5, SEED), start=1):
        name, _ = select(train, SEED+fold)
        X, _ = arrays(test)
        estimate = evaluate_fit(fit(train, name), X)
        base = evaluate_fit(fit(train, BASELINE), X)
        for r, y, b in zip(test, estimate, base):
            output.append(dict(prueba=r.prueba, identificador=r.identificador, grupo=r.grupo,
                               fuel=r.fuel, observado_s=r.duracion, estimado_s=float(y), baseline_s=float(b),
                               **dict(zip(FEATURES, r.x)), modelo=name, fin_ensayo=r.fin_ensayo,
                               mezcla=mixture(r.x), fold=fold))
    assert len(output) == len(rows)
    return sorted(output, key=lambda r: r["prueba"])


def temporal_validation(rows):
    dates = sorted({r.grupo for r in rows})
    cutoff = dates[int(len(dates)*0.8)]
    earlier = [r for r in rows if r.grupo < cutoff]
    later = [r for r in rows if r.grupo >= cutoff]
    name, scores = select(earlier, SEED)
    X, y = arrays(later)
    error = evaluate_fit(fit(earlier, name), X)-y
    baseline_error = evaluate_fit(fit(earlier, BASELINE), X)-y
    return {
        "inicio_prueba": cutoff, "n_entrenamiento": len(earlier), "n_prueba": len(later),
        "n_grupos_prueba": len({r.grupo for r in later}), "modelo": name,
        "mae_s": float(np.abs(error).mean()), "mae_baseline_s": float(np.abs(baseline_error).mean()),
        "seleccion_mae_s": scores,
        "protocolo": "Último 20 % de grupos por fecha; selección interna y ajuste solo en los grupos anteriores."
    }


def dump(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False)+"\n", encoding="utf-8")


def train(source, output):
    rows, discarded, digest = load_experiments(source)
    result = validation(rows)
    model_name, scores = select(rows, SEED+10)
    final = fit(rows, model_name)
    errors = np.array([r["estimado_s"] - r["observado_s"] for r in result])
    errors_baseline = np.array([r["baseline_s"] - r["observado_s"] for r in result])
    by_fuel = {}
    for fuel in FUELS:
        ix = np.array([r["fuel"] == fuel for r in result])
        if ix.any():
            by_fuel[fuel] = {
                "n": int(ix.sum()),
                "mae_s": float(np.abs(errors[ix]).mean()),
                "mae_baseline_s": float(np.abs(errors_baseline[ix]).mean()),
            }
    support = {}
    for row in rows:
        group = f"{row.fuel} | {mixture(row.x)}"
        support.setdefault(group, []).append(list(row.x))
    support = {k: {"n": len(v), "min": np.min(v, 0).tolist(), "max": np.max(v, 0).tolist()}
               for k, v in support.items()}
    final.update(version=1, caracteristicas=list(FEATURES), combustible="Methanol o Heptane",
                 fuente=SOURCE, soporte=support, variable_objetivo=TARGET, sha256_entrada=digest)
    if model_name.startswith("knn"):
        final["ensayos"] = [dict(prueba=r.prueba, identificador=r.identificador, grupo=r.grupo,
                                 fuel=r.fuel, mezcla=mixture(r.x), fin_ensayo=r.fin_ensayo,
                                 **dict(zip(FEATURES, r.x))) for r in rows]
    summary = {
        "n_filas_crudas": len(rows)+len(discarded), "n_filas": len(rows), "n_excluidas": len(discarded),
        "n_grupos": len({r.grupo for r in rows}),
        "mae_s": float(np.abs(errors).mean()), "rmse_s": float(np.sqrt((errors**2).mean())),
        "mae_baseline_s": float(np.abs(errors_baseline).mean()),
        "rmse_baseline_s": float(np.sqrt((errors_baseline**2).mean())),
        "modelo_final": model_name, "seleccion_final_mae_s": scores, "fuente": SOURCE,
        "publicacion_unidades": REPORT, "sha256_entrada": digest,
        "objetivo": "Duración de combustión registrada (s)", "variable_objetivo": TARGET,
        "validacion": "5 cortes agrupados por fecha con selección interna en 4 cortes. No se separan identificadores ni condiciones iniciales idénticas.",
        "referencia": "Mediana de la duración en las corridas de entrenamiento de cada corte.",
        "validacion_temporal": temporal_validation(rows),
        "combustibles": dict(Counter(r.fuel for r in rows)),
        "metricas_por_combustible": by_fuel,
        "fin_ensayo": dict(Counter(r.fin_ensayo for r in rows)),
        "limite": "Solo FLEX, dos combustibles y condiciones ensayadas. Duración hasta el fin registrado, no solo autoextinción.",
    }
    output.mkdir(parents=True, exist_ok=True)
    with (output / "validacion.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(result[0]))
        writer.writeheader()
        writer.writerows(result)
    with (output / "exclusiones.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=("prueba", "identificador", "motivo"))
        writer.writeheader()
        writer.writerows(discarded)
    dump(output / "resumen.json", summary)
    dump(output / "modelo.json", final)
    return summary


def predict(model, fuel, x):
    validate_conditions(fuel, x)
    neighborhood = model["soporte"].get(f"{fuel} | {mixture(x)}")
    if neighborhood is None or any(
        not low-1e-8 <= value <= high+1e-8
        for low, value, high in zip(neighborhood["min"], x, neighborhood["max"])
    ):
        raise ValueError("Condiciones fuera de los rangos ensayados para ese combustible y diluyente.")
    X = np.array([[*x, float(fuel == "Heptane")]])
    respuesta = {"duracion_estimada_s": float(evaluate_fit(model, X)[0]), "modelo": model["tipo"],
                 "rango": "Dentro de rangos individuales observados; la combinación exacta puede no haberse ensayado.",
                 "n_ensayos_combustible_y_mezcla": neighborhood["n"]}
    if model["tipo"].startswith("knn") and "ensayos" in model:
        idx, distances, weights = knn_neighbors(model, (X-model["centro"])/model["escala"])
        respuesta["vecinos"] = [dict(model["ensayos"][i], observado_s=model["y"][i],
                                      distancia_estandarizada=float(d), peso=float(w))
                                for i, d, w in zip(idx[0], distances[0], weights[0])]
    return respuesta


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_subparsers(dest="accion", required=True)
    engine = actions.add_parser("entrenar", help="Valida y entrena el modelo FLEX")
    engine.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="CSV PSI-69 FLEX")
    engine.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    query = actions.add_parser("predecir", help="Estima una duración en segundos dentro del dominio FLEX")
    query.add_argument("--modelo", type=Path, default=DEFAULT_OUTPUT / "modelo.json")
    query.add_argument("--fuel", choices=FUELS, required=True)
    for feature in FEATURES:
        query.add_argument("--"+feature.replace("_", "-"), type=float, required=True)
    args = parser.parse_args(argv)
    try:
        if args.accion == "entrenar":
            payload = train(args.input, args.output)
        else:
            model = json.loads(args.modelo.read_text(encoding="utf-8"))
            payload = predict(model, args.fuel, [getattr(args, feature) for feature in FEATURES])
    except (OSError, ValueError, KeyError) as error:
        parser.error(str(error))
    print(json.dumps(payload, indent=2, ensure_ascii=True, allow_nan=False))


if __name__ == "__main__":
    main()
