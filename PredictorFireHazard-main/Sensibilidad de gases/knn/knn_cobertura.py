"""Reentrena FLEX en condiciones con respaldo y se abstiene fuera de ellas."""
from __future__ import annotations

import argparse
import dataclasses
import json
import math
from collections import Counter
from pathlib import Path
from types import SimpleNamespace

import numpy as np

if __package__:
    from . import knn_iterativo as prior
    from .flex_original import DEFAULT_INPUT, FEATURES, FUELS, SEED, dump, grouped_folds, load_experiments, mixture, validate_conditions
else:
    import knn_iterativo as prior
    from flex_original import DEFAULT_INPUT, FEATURES, FUELS, SEED, dump, grouped_folds, load_experiments, mixture, validate_conditions

OUTPUT = Path(__file__).resolve().parent / "resultados"
# Fijos antes de evaluar: no se optimiza el umbral con los resultados del test.
CUANTIL = .9
MIN_ENSAYOS = 5
MIN_GRUPOS = 3


def fit_gate(train):
    train_z, center, scale = prior.scale_features(train, "fracciones")
    combinations = [(r.fuel, mixture(r.x)) for r in train]
    groups = np.array([r.grupo for r in train])
    limits = {}
    for fuel, mix in sorted(set(combinations)):
        mask = np.array([v == (fuel, mix) for v in combinations])
        if sum(mask) < MIN_ENSAYOS or len(set(groups[mask])) < MIN_GRUPOS:
            continue
        distances = prior.distancias(train_z[mask], train_z[mask], "euclidiana")
        train_groups = groups[mask]
        distances[train_groups[:, None] == train_groups] = np.inf
        minimal = distances.min(axis=1)
        limits[f"{fuel} | {mix}"] = float(np.quantile(minimal, CUANTIL, method="higher"))
    return dict(centro=center.tolist(), escala=scale.tolist(), umbrales=limits,
                cuantil=CUANTIL, min_ensayos=MIN_ENSAYOS, min_grupos=MIN_GRUPOS)


def gate(g, train, test, ranges=None):
    ranges = prior.gas_support(train) if ranges is None else ranges
    center, scale = np.asarray(g["centro"]), np.asarray(g["escala"])
    train_z = (np.asarray([prior.features(r, "fracciones") for r in train]) - center) / scale
    test_z = (np.asarray([prior.features(r, "fracciones") for r in test]) - center) / scale
    all_d = prior.distancias(test_z, train_z, "euclidiana")
    train_keys = np.asarray([f"{r.fuel} | {mixture(r.x)}" for r in train])
    result = []
    for i, r in enumerate(test):
        key = f"{r.fuel} | {mixture(r.x)}"
        limit = g["umbrales"].get(key)
        pool = all_d[i][train_keys == key]
        d = float(pool.min()) if len(pool) else None
        in_range = prior.inside_support(ranges, r.fuel, r.x)
        if not in_range:
            reason = "fuera_de_rango_o_mezcla_sin_datos"
        elif limit is None:
            reason = "grupos_insuficientes"
        elif d > limit + 1e-12:
            reason = "sin_vecino_cercano_de_la_misma_mezcla"
        else:
            reason = "respaldado"
        result.append(dict(dentro_rango=in_range, aceptado=reason == "respaldado",
                           motivo=reason, distancia_soporte=d, limite_soporte=limit))
    return result


def select(rows, seed):
    errors = {c: np.zeros(4) for c in prior.GRID}
    total = supported = 0
    for train, test in grouped_folds(rows, 4, seed):
        g = gate(fit_gate(train), train, test)
        supported_mask = np.array([r["aceptado"] for r in g])
        total += len(test)
        supported += sum(supported_mask)
        ytrain = np.array([r.duracion for r in train])
        ytest = np.array([r.duracion for r in test])
        pools = {p: prior.neighbors(train, test, p)[0] for p in prior.POOLS}
        for space in prior.SPACES:
            z, center, scale = prior.scale_features(train, space)
            query = (np.asarray([prior.features(r, space) for r in test])-center)/scale
            for dist in prior.DISTANCES:
                distances = prior.distancias(query, z, dist)
                for policy, mask in pools.items():
                    indices, distances_sorted = prior.sorted_pool(distances, mask, max(prior.KS))
                    for k in prior.KS:
                        near, yy = distances_sorted[:, :k], ytrain[indices[:, :k]]
                        for w in prior.WEIGHTS:
                            delta = (prior.calculate_weights(near, w) * yy).sum(axis=1) - ytest
                            valid = delta[supported_mask]
                            cfg = prior.Config(k, w, dist, space, policy)
                            errors[cfg] += (abs(valid).sum(), (valid ** 2).sum(), abs(delta).sum(), (delta ** 2).sum())
    if not supported:
        raise ValueError("Sin ensayos respaldados en la validación interna.")
    scores = [dict(config=c, mae_s=float(a/supported), rmse_s=float(math.sqrt(b/supported)),
                   mae_todos_s=float(aa/total), rmse_todos_s=float(math.sqrt(bb/total)),
                   n_respaldados=int(supported), n_evaluados=total)
              for c, (a,b,aa,bb) in errors.items()]
    scores.sort(key=lambda r: (r["mae_s"], r["rmse_s"]))
    return scores[0]["config"], scores


def compare(rows, subset=None):
    picked = [r for r in rows if subset is None or r[subset]]
    scores = dict(n_total=len(rows), n=len(picked), n_grupos=len({r["grupo"] for r in picked}),
                  cobertura=len(picked)/len(rows) if rows else None)
    for name,key in (("nuevo","estimado_s"), ("previo","estimado_previo_s"), ("mediana","baseline_s"),
                     ("mediana_mezcla","baseline_mezcla_s")):
        errors = [r[key] - r["observado_s"] for r in picked]
        scores[f"mae_{name}_s"] = float(np.mean(np.abs(errors))) if errors else None
        scores[f"sesgo_{name}_s"] = float(np.mean(errors)) if errors else None
    return scores


def test_partition(train, test, dates, seed, protocol, fold):
    config, _ = select(train, seed)
    prev_cfg, _ = prior.select(train, seed)
    rows, partition, evidence = prior.evaluate_partition(train, test, dates, config, protocol, fold)
    previous, *_ = prior.knn_results(train, test, prev_cfg)
    status = gate(fit_gate(train), train, test)
    for row, old, s in zip(rows, previous, status):
        row.update(s, estimado_previo_s=float(old), estimado_publicable_s=row["estimado_s"] if s["aceptado"] else None)
    partition.update(n_aceptados=sum(r["aceptado"] for r in rows))
    accepted = {r["prueba"] for r in rows if r["aceptado"]}
    assert all(e["vecino"] not in {r.prueba for r in test} for e in evidence)
    for e in evidence:
        e["consulta_aceptada"] = e["consulta"] in accepted
    return rows, partition, evidence


def train(source, output):
    rows, excluded, digest = load_experiments(source)
    dates = prior.original_dates(source)
    oof, partitions, evidence = [], [], []
    for fold, (tr, ts) in enumerate(grouped_folds(rows, 5, SEED), 1):
        vv, pp, ee = test_partition(tr, ts, dates, SEED+fold, "agrupado", fold)
        oof.extend(vv)
        partitions.append(pp)
        evidence.extend(ee)
    assert len(oof) == len({r["prueba"] for r in oof}) == len(rows)
    cutoff, earlier, later, purged = prior.temporal_split(rows, dates)
    temporal, pp, ee = test_partition(earlier, later, dates, SEED, "cronologico", 1)
    partitions.append(pp)
    evidence.extend(ee)
    config, scores = select(rows, SEED+10)
    model = prior.fit(rows, dates, config, digest)
    model.update(version=3, filtro_soporte=fit_gate(rows))
    blocks = [("agrupado", oof), ("cronologico", temporal)]
    summary = dict(n_filas=len(rows), n_excluidas=len(excluded), n_grupos=len({r.grupo for r in rows}),
                   n_configuraciones=len(scores), sha256_entrada=digest, fuente=prior.SOURCE,
                   objetivo=prior.TARGET, modelo_final=dataclasses.asdict(config),
                   cobertura={k: dict(todos=compare(rs), rango_individual=compare(rs, "dentro_rango"),
                                      respaldados=compare(rs, "aceptado"), motivos=dict(Counter(r["motivo"] for r in rs)))
                              for k, rs in blocks},
                   corte_cronologico=dict(fecha_inicio=cutoff, n_entrenamiento=len(earlier), n_purgadas=len(purged),
                                         mezclas_entrenamiento=dict(Counter(mixture(r.x) for r in earlier)),
                                         mezclas_prueba=dict(Counter(mixture(r.x) for r in later))),
                   metodo="KNN FLEX de duración registrada. Selección anidada por grupos, sobre los ensayos "
                          "respaldados por un filtro fijo de distancia al mismo combustible y mezcla. "
                          "Sin Ar/Xe; no predice peligro ni límite de inflamabilidad.")
    strata = []
    for label, rs in blocks:
        for fuel,mix in sorted({(r["fuel"], r["mezcla"]) for r in rs}):
            sub = [r for r in rs if (r["fuel"],r["mezcla"]) == (fuel,mix)]
            for subset, flag in (("todos",None), ("rango_individual","dentro_rango"), ("respaldados","aceptado")):
                strata.append(dict(protocolo=label, subconjunto=subset, combustible=fuel, mezcla=mix, **compare(sub,flag)))
    output.mkdir(parents=True, exist_ok=True)
    prior.write_csv(output/"validacion.csv", sorted(oof, key=lambda r:r["prueba"]))
    prior.write_csv(output/"validacion_temporal.csv", sorted(temporal, key=lambda r:r["prueba"]))
    prior.write_csv(output/"particiones.csv", partitions)
    prior.write_csv(output/"vecinos_validacion.csv", evidence)
    prior.write_csv(output/"metricas_mezclas.csv", strata)
    prior.write_csv(output/"configuraciones.csv", [
        dict(rango=i, **dataclasses.asdict(s["config"]), **{k:v for k,v in s.items() if k!="config"})
        for i,s in enumerate(scores,1)
    ])
    prior.write_csv(output/"exclusiones.csv", excluded, ("prueba","identificador","motivo"))
    dump(output/"modelo.json", model)
    dump(output/"resumen.json", summary)
    return summary


def forecast(model, fuel, x):
    if model.get("version") != 3:
        raise ValueError("Use el modelo v3 del nuevo entrenamiento.")
    validate_conditions(fuel,x)
    train = [SimpleNamespace(fuel=r["fuel"], grupo=r["grupo"], x=[r[k] for k in FEATURES]) for r in model["ensayos"]]
    status = gate(model["filtro_soporte"], train, [SimpleNamespace(fuel=fuel,x=x)], model["soporte"])[0]
    if not status["aceptado"]:
        return {"duracion_estimada_s": None, **status}
    return dict(prior.forecast(model, fuel, x), **status)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_subparsers(dest="accion", required=True)
    training = actions.add_parser("entrenar")
    training.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    training.add_argument("--output", type=Path, default=OUTPUT)
    query = actions.add_parser("predecir")
    query.add_argument("--modelo", type=Path, default=OUTPUT/"modelo.json")
    query.add_argument("--fuel", choices=FUELS, required=True)
    for key in FEATURES:
        query.add_argument("--"+key.replace("_","-"),type=float,required=True)
    args = parser.parse_args()
    try:
        if args.accion=="entrenar":
            value=train(args.input,args.output)
        else:
            model=json.loads(args.modelo.read_text(encoding="utf-8"))
            value=forecast(model,args.fuel,tuple(getattr(args,k) for k in FEATURES))
    except (OSError, ValueError, KeyError) as e:
        parser.error(str(e))
    print(json.dumps(value,ensure_ascii=True,indent=2,allow_nan=False))


if __name__=="__main__":
    main()
