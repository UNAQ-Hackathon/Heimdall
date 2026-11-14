"""Ajuste y evaluación del KNN FLEX para duración registrada de combustión."""
from __future__ import annotations

import argparse
import csv
import dataclasses
import io
import itertools
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

import numpy as np

if __package__:
    from .flex_original import (
        DEFAULT_INPUT, FEATURES, FUELS, REPORT, SEED, SOURCE, TARGET, dump,
        grouped_folds, load_experiments, mixture, validate_conditions,
    )
else:
    from flex_original import (
        DEFAULT_INPUT, FEATURES, FUELS, REPORT, SEED, SOURCE, TARGET, dump,
        grouped_folds, load_experiments, mixture, validate_conditions,
    )


OUTPUT = Path(__file__).resolve().parent / "resultados"
KS = (1, 2, 3, 5, 7, 9, 13, 17, 25)
POOLS = ("global", "combustible", "mezcla")
SPACES = ("fracciones", "parciales")
DISTANCES = ("euclidiana", "manhattan")
WEIGHTS = ("uniforme", "inversa", "inversa2")


@dataclasses.dataclass(frozen=True)
class Config:
    k: int
    pesos: str
    distancia: str
    espacio: str
    vecindario: str


GRID = tuple(Config(*args) for args in itertools.product(KS, WEIGHTS, DISTANCES, SPACES, POOLS))
PREVIOUS = Config(3, "inversa", "euclidiana", "fracciones", "global")


def original_dates(source):
    raw = Path(source).read_bytes()
    try:
        decoded = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = raw.decode("cp1252")
    dates = {}
    for row in csv.DictReader(io.StringIO(decoded, newline="")):
        try:
            day = row["Test Date"].strip()
            pattern = "%m/%d/%Y" if len(day.rsplit("/", 1)[-1]) == 4 else "%m/%d/%y"
            dates[int(row["FLEX Test #"])] = datetime.strptime(day, pattern).date().isoformat()
        except (AttributeError, TypeError, ValueError):
            continue
    return dates


def features(row, espacio):
    x, fuel = row.x, row.fuel
    gases = [v * x[0] for v in x[1:5]] if espacio == "parciales" else x[1:5]
    return [x[0], *gases, x[5], float(fuel == "Heptane")]


def scale_features(train, espacio):
    X = np.asarray([features(r, espacio) for r in train])
    center, scale = X.mean(axis=0), X.std(axis=0)
    scale[scale < 1e-12] = 1.
    scale[-1] = 1.  # Mantiene diferencia entre combustibles en una unidad.
    return (X-center) / scale, center, scale


def distancias(A, B, mode):
    delta = A[:, None, :] - B[None, :, :]
    if mode == "manhattan":
        return np.abs(delta).sum(axis=2)
    return np.sqrt(np.square(delta).sum(axis=2))


def neighbors(train, test, policy):
    fuels = np.asarray([r.fuel for r in train])
    gas = np.asarray([mixture(r.x) for r in train])
    members = np.empty((len(test), len(train)), dtype=bool)
    effective = []
    for i, r in enumerate(test):
        fuel = fuels == r.fuel
        subset = fuel & (gas == mixture(r.x))
        enough = lambda ix: np.count_nonzero(ix) >= 3 and len({r.grupo for r, keep in zip(train, ix) if keep}) >= 2
        if policy == "mezcla" and enough(subset):
            members[i], mode = subset, "mezcla"
        elif policy != "global" and enough(fuel):
            members[i], mode = fuel, "combustible"
        else:
            members[i], mode = True, "global"
        effective.append(mode)
    return members, effective


def sorted_pool(all_d, mask, k):
    eligible = np.where(mask, all_d, np.inf)
    idx = np.argsort(eligible, axis=1, kind="stable")[:, :k]
    return idx, np.take_along_axis(eligible, idx, axis=1)


def calculate_weights(near, strategy):
    valid = np.isfinite(near)
    if strategy == "uniforme":
        weights = valid.astype(float)
    else:
        power = 1 if strategy == "inversa" else 2
        exact = near < 1e-12
        weights = np.where(exact.any(axis=1, keepdims=True), exact,
                           1. / np.maximum(near, 1e-12) ** power)
    return weights / weights.sum(axis=1, keepdims=True)


def knn_results(train, test, config):
    rows, center, scale = scale_features(train, config.espacio)
    query = (np.asarray([features(r, config.espacio) for r in test])-center)/scale
    distance = distancias(query, rows, config.distancia)
    mask, effective = neighbors(train, test, config.vecindario)
    idx, near = sorted_pool(distance, mask, config.k)
    weights = calculate_weights(near, config.pesos)
    targets = np.array([r.duracion for r in train])
    return (weights * targets[idx]).sum(axis=1), idx, near, weights, effective


def select(rows, seed):
    """Iteración de la cuadrícula: cada escalado, peso y vecino usa solo train."""
    errors = {c: np.zeros(2) for c in GRID}
    n = 0
    for train, test in grouped_folds(rows, 4, seed):
        ytrain = np.array([r.duracion for r in train])
        ytest = np.array([r.duracion for r in test])
        n += len(test)
        pools = {policy: neighbors(train, test, policy)[0] for policy in POOLS}
        for space in SPACES:
            rows_scaled, center, scale = scale_features(train, space)
            query = (np.asarray([features(r, space) for r in test])-center)/scale
            for distance in DISTANCES:
                distances = distancias(query, rows_scaled, distance)
                for policy, mask in pools.items():
                    indexes, sorted_dist = sorted_pool(distances, mask, max(KS))
                    for k in KS:
                        near, yy = sorted_dist[:, :k], ytrain[indexes[:, :k]]
                        for w in WEIGHTS:
                            delta = (calculate_weights(near, w)*yy).sum(axis=1)-ytest
                            errors[Config(k, w, distance, space, policy)] += [abs(delta).sum(), np.square(delta).sum()]
    scores = [{"config": config, "mae_s": float(a/n), "rmse_s": float(np.sqrt(b/n))}
              for config, (a, b) in errors.items()]
    scores.sort(key=lambda r: (r["mae_s"], r["rmse_s"]))
    return scores[0]["config"], scores


def record(r, date):
    return dict(prueba=r.prueba, identificador=r.identificador,
                grupo=r.grupo, fecha=date,
                fuel=r.fuel, mezcla=mixture(r.x), fin_ensayo=r.fin_ensayo,
                **dict(zip(FEATURES, r.x)))


def evaluate_partition(train, test, dates, config, protocol, fold):
    assert not {r.grupo for r in train} & {r.grupo for r in test}
    assert not {dates[r.prueba] for r in train} & {dates[r.prueba] for r in test}
    assert not {(r.fuel, r.x) for r in train} & {(r.fuel, r.x) for r in test}
    assert not {r.identificador for r in train} & {r.identificador for r in test}
    mediana = float(np.median([r.duracion for r in train]))
    local_mask, _ = neighbors(train, test, "mezcla")
    conditional = [float(np.median([r.duracion for r, keep in zip(train, line) if keep]))
                   for line in local_mask]
    previous, *_ = knn_results(train, test, PREVIOUS)
    estimate, indexes, near, weights, effective = knn_results(train, test, config)
    out, evidence = [], []
    support = gas_support(train)
    for i, query in enumerate(test):
        out.append(dict(**record(query, dates[query.prueba]), fold=fold,
                        observado_s=query.duracion, estimado_s=float(estimate[i]),
                        baseline_s=mediana, baseline_mezcla_s=conditional[i],
                        anterior_s=float(previous[i]), error_s=float(estimate[i]-query.duracion),
                        **dataclasses.asdict(config), vecindario_efectivo=effective[i],
                        dentro_rango=inside_support(support, query.fuel, query.x),
                        distancia_vecino_minima=float(near[i, 0]),
                        n_vecinos=int(np.count_nonzero(weights[i] > 0))))
        for idx, d, w in zip(indexes[i], near[i], weights[i]):
            if not np.isfinite(d):
                continue
            r = train[idx]
            evidence.append(dict(protocolo=protocol, consulta=query.prueba, vecino=r.prueba,
                                 consulta_id=query.identificador, vecino_id=r.identificador,
                                 fold=fold, distancia=float(d), peso=float(w),
                                 consulta_diametro_mm=query.x[5], consulta_o2_fraccion=query.x[1],
                                 consulta_observado_s=query.duracion, consulta_estimado_s=float(estimate[i]),
                                 vecino_diametro_mm=r.x[5], vecino_o2_fraccion=r.x[1],
                                 vecino_observado_s=r.duracion, mezcla=mixture(query.x), fuel=query.fuel,
                                 vecino_mezcla=mixture(r.x), vecino_fuel=r.fuel))
    partition = dict(protocolo=protocol, fold=fold, n_entrenamiento=len(train), n_prueba=len(test),
                     n_grupos_entrenamiento=len({r.grupo for r in train}), n_grupos_prueba=len({r.grupo for r in test}),
                     primer_dia_entrenamiento=min(dates[r.prueba] for r in train),
                     ultimo_dia_entrenamiento=max(dates[r.prueba] for r in train),
                     primer_dia_prueba=min(dates[r.prueba] for r in test),
                     ultimo_dia_prueba=max(dates[r.prueba] for r in test),
                     **dataclasses.asdict(config), **metrics(out))
    return out, partition, evidence


def metrics(rows):
    y = np.array([r["observado_s"] for r in rows])
    output = {"n": len(rows), "n_grupos": len({r["grupo"] for r in rows}),
              "n_dentro_rango": sum(r["dentro_rango"] for r in rows)}
    for k, col in (("", "estimado_s"), ("_baseline", "baseline_s"),
                   ("_baseline_mezcla", "baseline_mezcla_s"), ("_anterior", "anterior_s")):
        err = np.array([r[col] for r in rows])-y
        output["mae"+k+"_s"] = float(np.abs(err).mean())
        output["rmse"+k+"_s"] = float(np.sqrt(np.mean(err**2)))
        if not k:
            output["sesgo_s"] = float(err.mean())
    return output


def by_category(rows, protocol):
    result = []
    for group, wanted in (("combustible", ("fuel",)), ("mezcla", ("mezcla",)),
                          ("mezcla_y_combustible", ("mezcla", "fuel"))):
        keys = sorted({tuple(r[k] for k in wanted) for r in rows})
        for key in keys:
            matching = [r for r in rows if tuple(r[k] for k in wanted) == key]
            names = {"fuel": "Todos", "mezcla": "Todas"}
            names.update(zip(wanted, key))
            result.append(dict(protocolo=protocol, agrupacion=group, **names, **metrics(matching),
                               uso_bolsa_mezcla=sum(r["vecindario_efectivo"] == "mezcla" for r in matching)))
    return result


def temporal_split(rows, dates):
    days = sorted({dates[r.prueba] for r in rows})
    cutoff = days[int(len(days) * 0.8)]
    test = [r for r in rows if dates[r.prueba] >= cutoff]
    test_groups = {r.grupo for r in test}
    earlier = [r for r in rows if dates[r.prueba] < cutoff]
    purged = [r for r in earlier if r.grupo in test_groups]
    train = [r for r in earlier if r.grupo not in test_groups]
    return cutoff, train, test, purged


def write_csv(path, rows, fields=None):
    with path.open("w", newline="", encoding="utf-8") as handle:
        w = csv.DictWriter(handle, fieldnames=fields or list(rows[0]))
        w.writeheader()
        w.writerows(rows)


def gas_support(train):
    support = {}
    for row in train:
        name = row.fuel + " | " + mixture(row.x)
        support.setdefault(name, []).append(row)
    return {key: dict(n=len(group), n_grupos=len({r.grupo for r in group}),
                     min=np.min([r.x for r in group], axis=0).tolist(),
                     max=np.max([r.x for r in group], axis=0).tolist()) for key, group in support.items()}


def inside_support(support, fuel, x):
    ranges = support.get(fuel + " | " + mixture(x))
    return bool(ranges and all(a-1e-8 <= v <= b+1e-8
                               for v, a, b in zip(x, ranges["min"], ranges["max"])))


def fit(train, dates, config, digest):
    x, center, scale = scale_features(train, config.espacio)
    return dict(version=2, tipo="knn", config=dataclasses.asdict(config),
                centro=center.tolist(), escala=scale.tolist(), x=x.tolist(),
                y=[r.duracion for r in train], ensayos=[record(r, dates[r.prueba]) for r in train],
                soporte=gas_support(train), caracteristicas=list(FEATURES), variable_objetivo=TARGET,
                fuente=SOURCE, sha256_entrada=digest)


def forecast(model, fuel, x):
    validate_conditions(fuel, x)
    support = model["soporte"].get(fuel + " | " + mixture(x))
    if not inside_support(model["soporte"], fuel, x):
        raise ValueError("Condiciones fuera de los rangos FLEX para ese combustible y mezcla.")
    from types import SimpleNamespace
    config = Config(**model["config"])
    q = SimpleNamespace(fuel=fuel, x=x)
    trs = [SimpleNamespace(fuel=r["fuel"], grupo=r["grupo"], x=[r[k] for k in FEATURES]) for r in model["ensayos"]]
    query = (np.asarray([features(q, config.espacio)])-model["centro"])/model["escala"]
    distance = distancias(query, np.asarray(model["x"]), config.distancia)
    mask, effective = neighbors(trs, [q], config.vecindario)
    idx, near = sorted_pool(distance, mask, config.k)
    weights = calculate_weights(near, config.pesos)
    estimate = float(np.sum(weights*np.asarray(model["y"])[idx]))
    return dict(duracion_estimada_s=estimate, config=model["config"], vecindario_efectivo=effective[0],
                cobertura_mezcla=support["n"], grupos_mezcla=support["n_grupos"],
                nota="Rangos individuales observados no garantizan cobertura de combinaciones nuevas.",
                vecinos=[dict(model["ensayos"][j], observado_s=model["y"][j], peso=float(w),
                              distancia=float(d)) for j, d, w in zip(idx[0], near[0], weights[0])
                         if np.isfinite(d) and w > 0])


def train(source, output):
    rows, excluded, digest = load_experiments(source)
    dates = original_dates(source)
    oof, partitions, evidence = [], [], []
    for fold, (trainset, test) in enumerate(grouped_folds(rows, 5, SEED), start=1):
        chosen, _ = select(trainset, SEED+fold)
        observed, partition, neighbors_out = evaluate_partition(trainset, test, dates, chosen, "agrupado", fold)
        oof.extend(observed)
        partitions.append(partition)
        evidence.extend(neighbors_out)
    assert {r["prueba"] for r in oof} == {r.prueba for r in rows} and len(oof) == len(rows)
    cutoff, earlier, later, purged = temporal_split(rows, dates)
    temporal_config, _ = select(earlier, SEED)
    future, partition, temporal_neighbors = evaluate_partition(earlier, later, dates, temporal_config, "cronologico", 1)
    partitions.append(partition)
    evidence.extend(temporal_neighbors)
    config, tuning = select(rows, SEED+10)
    final = fit(rows, dates, config, digest)
    divisions = [{"protocolo": mode, "fold": fold, "prueba": r.prueba, "identificador": r.identificador,
                  "grupo": r.grupo, "fecha": dates[r.prueba], "rol": role}
                 for mode, fold, roles in [
                     *(("agrupado", i, (("entrenamiento", a), ("prueba", b)))
                       for i, (a, b) in enumerate(grouped_folds(rows, 5, SEED), 1)),
                     ("cronologico", 1, (("entrenamiento", earlier), ("prueba", later), ("purga", purged))),
                 ] for role, records in roles for r in records]
    dentro_agrupado = [r for r in oof if r["dentro_rango"]]
    dentro_temporal = [r for r in future if r["dentro_rango"]]
    summary = dict(n_filas_crudas=len(rows)+len(excluded), n_filas=len(rows), n_excluidas=len(excluded),
                   n_grupos=len({r.grupo for r in rows}), n_configuraciones=len(GRID),
                   objetivo=TARGET, fuente=SOURCE, publicacion_unidades=REPORT, sha256_entrada=digest,
                   agrupado=metrics(oof),
                   solo_dentro_rango=dict(
                       agrupado=metrics(dentro_agrupado) if dentro_agrupado else None,
                       cronologico=metrics(dentro_temporal) if dentro_temporal else None),
                   validacion_temporal=dict(inicio_prueba=cutoff, n_entrenamiento=len(earlier),
                                            n_prueba=len(later), n_purgadas=len(purged),
                                            mezcla_entrenamiento=dict(Counter(mixture(r.x) for r in earlier)),
                                            mezcla_prueba=dict(Counter(mixture(r.x) for r in later)),
                                            config=dataclasses.asdict(temporal_config), **metrics(future)),
                   modelo_final=dataclasses.asdict(config),
                   mejor_busqueda_por_vecindario={
                       policy: next(dict(config=dataclasses.asdict(a["config"]), mae_s=a["mae_s"], rmse_s=a["rmse_s"])
                                    for a in tuning if a["config"].vecindario == policy) for policy in POOLS},
                   mezcla=dict(Counter(mixture(r.x) for r in rows)),
                   gases=["O₂", "N₂", "CO₂", "He"],
                   notas=[
                       "Validación agrupada anidada 5 × 4. La búsqueda final por cuatro cortes solo elige el artefacto para inferencia.",
                       "Corte temporal usa fechas reales; purga del entrenamiento los grupos compartidos con el periodo final.",
                       "KNN previo = k=3, euclidiana, peso inverso y bolsa global. Reajustado en las mismas particiones.",
                       "Mediana global o mediana por combustible y mezcla, con retroceso a combustible o global.",
                       "La evaluación mide todos los casos retenidos y reporta cuántos pasarían el filtro de rango de la inferencia.",
                       "Duración registrada incluye extinción, disrupción y finalización. No es un criterio de seguridad ni un simulador planetario.",
                   ])
    output.mkdir(parents=True, exist_ok=True)
    write_csv(output / "validacion.csv", sorted(oof, key=lambda r: r["prueba"]))
    write_csv(output / "validacion_temporal.csv", sorted(future, key=lambda r: r["prueba"]))
    write_csv(output / "configuraciones.csv", [dict(rango=i, **dataclasses.asdict(s["config"]),
                                                   mae_s=s["mae_s"], rmse_s=s["rmse_s"])
                                               for i, s in enumerate(tuning, 1)])
    write_csv(output / "particiones.csv", partitions)
    write_csv(output / "asignaciones.csv", divisions)
    write_csv(output / "metricas_mezclas.csv", by_category(oof, "agrupado")+by_category(future, "cronologico"))
    write_csv(output / "vecinos_validacion.csv", evidence)
    write_csv(output / "exclusiones.csv", excluded, ("prueba", "identificador", "motivo"))
    dump(output / "modelo.json", final)
    dump(output / "resumen.json", summary)
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_subparsers(dest="accion", required=True)
    fit_cmd = actions.add_parser("entrenar")
    fit_cmd.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    fit_cmd.add_argument("--output", type=Path, default=OUTPUT)
    query = actions.add_parser("predecir")
    query.add_argument("--modelo", type=Path, default=OUTPUT/"modelo.json")
    query.add_argument("--fuel", choices=FUELS, required=True)
    for k in FEATURES:
        query.add_argument("--"+k.replace("_", "-"), type=float, required=True)
    args = parser.parse_args()
    try:
        if args.accion == "entrenar":
            value = train(args.input, args.output)
        else:
            model = json.loads(args.modelo.read_text(encoding="utf-8"))
            value = forecast(model, args.fuel, tuple(getattr(args, k) for k in FEATURES))
    except (OSError, ValueError, KeyError) as error:
        parser.error(str(error))
    print(json.dumps(value, indent=2, ensure_ascii=True, allow_nan=False))


if __name__ == "__main__":
    main()
