# KNN FLEX v3: predicción con respaldo experimental

Usa 258 ensayos válidos de 274 registros del [experimento FLEX de NASA](https://doi.org/10.60555/mbq8-0451). Predice la duración de combustión registrada, que puede terminar por extinción, disrupción o finalización. No estima la probabilidad de incendio, el riesgo operacional ni la eficacia de un agente extintor. No hay series etiquetadas de argón o xenón en este CSV.

## Entrenar y estimar

Desde esta carpeta:

```powershell
py -m pip install -r .\requirements.txt
py .\knn_cobertura.py entrenar
py .\knn_cobertura.py predecir --fuel Methanol --presion-mmhg 765 --o2-fraccion 0.21 --n2-fraccion 0.79 --co2-fraccion 0 --he-fraccion 0 --diametro-mm 1.8
```

El ejemplo devuelve **5.1283 s**, con los ensayos 2, 1, 5, 3 y 4 y sus pesos. Para una consulta sin respaldo, devuelve `duracion_estimada_s: null`, con motivo. `entrenar` admite `--input` y `--output`; `predecir` permite `--modelo`. El archivo de origen preserva la copia del CSV de NASA con SHA-256 en el resumen.

## Qué cambió

- Se entrenó de nuevo sobre los mismos registros, comparando 324 configuraciones de distancia, ponderación, representación de gases, k y política de vecinos. KNN conserva ejemplos y aprende qué configuración aplicar por validación, sin entrenar por épocas.
- La selección se hizo en los ensayos respaldados de los cuatro cortes internos; los cinco cortes externos se reservan por grupo. Un día, identificador de ensayo o combinación inicial idéntica no se comparte entre prueba y entrenamiento. El corte cronológico reservado se usa de forma separada y se purgan del entrenamiento los grupos que lo cruzan.
- Para publicar una estimación exige los rangos de entrada del mismo combustible y mezcla, con al menos 5 ensayos en 3 grupos. La distancia euclidiana estandarizada de la consulta al vecino más cercano del mismo combustible y mezcla debe quedar dentro del percentil 90 de las distancias al vecino más cercano de otro grupo, calculado exclusivamente en los datos de entrenamiento de cada corte. Los umbrales se fijaron como reglas de cobertura; estar dentro no implica confianza estadística ni seguridad.
- El modelo final usa cinco vecinos del mismo combustible, distancia euclidiana y pesos por inversa de la distancia. La regla que autoriza estimar siempre comprueba la cercanía **en la misma mezcla**; la política del modelo, elegida por validación, puede incluir ensayos del mismo combustible con otra mezcla. El resultado lista ambas cosas.

## Desempeño fuera de muestra

MAE en segundos, comparado con la iteración v2 reentrenada en los **mismos** cortes y mediana del conjunto de entrenamiento.

| Evaluación | Cobertura | KNN v3 | KNN v2 | Mediana global | Mediana por mezcla |
|---|---:|---:|---:|---:|---:|
| Retención agrupada, estimaciones publicables | 162/258 (63 %) | 2.92 | 2.96 | 6.11 | 4.98 |
| Retención agrupada, todos, solo diagnóstico | 258/258 | 3.57 | 3.42 | 6.10 | 5.79 |
| Corte cronológico, estimaciones publicables | 3/48 (6 %) | 3.37 | 3.68 | 2.70 | 4.07 |
| Corte cronológico, todos, solo diagnóstico | 48/48 | 5.64 | 5.63 | 4.41 | 5.16 |

En las mismas filas publicables hubo una diferencia agrupada pequeña (~0.05 s), y el resultado empeoró al forzar estimaciones para todos. No hay una mejora general demostrada. En el tramo cronológico, 45/48 ensayos contenían He, frente a solo 1/210 antes del corte, por lo que las 45 consultas con He quedan sin respaldo. Tres ensayos de dos grupos son demasiado pocos para evaluar pronóstico. Los errores comparativos se calculan siempre contando el mismo subconjunto para cada modelo.

## Archivos

- `validacion.csv` y `validacion_temporal.csv`: observación, salida cuando está respaldada, predicción diagnóstica forzada, referencias, vecinos, rango y motivo de abstención. `estimado_s` guarda el valor forzado para todos; la columna a usar como predicción del producto es `estimado_publicable_s`, vacía cuando no hay respaldo.
- `metricas_mezclas.csv`: cobertura y error por combustible, mezcla y subconjunto.
- `configuraciones.csv`: resultados de selección interna. No sustituyen el error externo.
- `resumen.json`, `particiones.csv`, `vecinos_validacion.csv`, `exclusiones.csv`: métricas, cortes, evidencia y registros omitidos.
- `modelo.json`: parámetros, ensayos y filtro aprendido, para inferencia sin los CSV de validación.
