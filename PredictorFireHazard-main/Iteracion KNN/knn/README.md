# KNN iterativo para FLEX

Estima **la duración de combustión registrada (s)** de gotas de metanol o heptano en el experimento FLEX de microgravedad. La duración no equivale automáticamente a tiempo de autoextinción: el final del ensayo puede ser extinción, disrupción o finalización. La base incluida es el CSV de [NASA PSI-69](https://doi.org/10.60555/mbq8-0451); la [publicación de NASA](https://ntrs.nasa.gov/citations/20150023456) documenta el método y las unidades. El SHA-256 en el resumen identifica la copia de entrada.

## Entrenar y estimar

En PowerShell, desde esta carpeta:

```powershell
py -m pip install -r .\requirements.txt
py .\knn_iterativo.py entrenar
py .\knn_iterativo.py predecir --fuel Methanol --presion-mmhg 765 --o2-fraccion 0.21 --n2-fraccion 0.79 --co2-fraccion 0 --he-fraccion 0 --diametro-mm 1.8
```

La consulta de ejemplo devuelve aproximadamente **5.05 s** y los ensayos #2, #1, #5, #3 y #4, con distancias y pesos. El filtro de dominio rechaza valores fuera de los rangos individuales observados por combustible y mezcla. Una combinación nueva que cae dentro de todos los rangos no se convierte automáticamente en una combinación probada. `entrenar` permite `--input` y `--output`; las salidas predeterminadas están en `resultados`.

## Método y resultados

- **Entradas:** diámetro inicial, combustible, presión y fracciones molares de O₂, N₂, CO₂ y He. Las presiones parciales se prueban como representación alternativa (presión total × fracción molar). El motivo de fin, tasa de combustión y diámetro de extinción no se usan como entradas.
- **Iteración:** búsqueda de 324 configuraciones, combinando nueve valores de k, tres esquemas de pesos, dos distancias, dos representaciones de gas y tres políticas de vecindario. KNN guarda los ensayos en vez de ajustar pesos con épocas; la iteración evalúa qué parámetros funcionan mejor sin usar los ensayos reservados.
- **Gases:** 94 ensayos O₂/N₂, 118 con CO₂ y 46 con He. La política por mezcla busca vecinos con mismo diluyente y combustible cuando hay al menos 3 observaciones en 2 grupos; de otro modo, recurre al mismo combustible y finalmente al conjunto global. En la búsqueda final ganó **mismo combustible**, k=5, distancia euclidiana, fracciones molares y peso inverso al cuadrado de la distancia. El mejor candidato que exige misma mezcla cuando hay cobertura obtuvo 3.35 s de MAE interno, frente a 3.24 s del campeón; comparar estos números es parte de la búsqueda, no una estimación independiente de exactitud.
- **Evaluación:** incluye 258 ensayos válidos, 79 grupos formados por fecha, ID y condiciones iniciales idénticas. Cada uno de los 5 cortes externos usa 4 cortes internos para elegir configuración. Se mantienen como referencias la mediana global, la mediana por mezcla/combustible con reglas de cobertura y la configuración fija KNN previa (k=3 global, peso inverso).

| Prueba independiente | KNN reajustado | KNN previo fijo | Mediana global |
| --- | ---: | ---: | ---: |
| 5 cortes agrupados, 258 ensayos | 3.42 s | **3.17 s** | 6.10 s |
| Último 20 % de fechas, 48 ensayos | 5.63 s | 6.08 s | **4.41 s** |

Los valores son errores absolutos medios (MAE). El KNN reajustado no mejora en todos los protocolos; no desplaza al modelo fijo como referencia agrupada ni a la mediana como referencia cronológica. En el corte cronológico desde el **21 de septiembre de 2011**, el entrenamiento solo contenía un ensayo con helio y la evaluación contenía 45 de 48. Solo 3 de 48 casos quedarían dentro del rango individual que la aplicación exige usando los datos disponibles antes del corte. La evaluación forzada incluye los 48 para diagnosticar qué pasa al extrapolar; el resumen separa la evaluación del subconjunto dentro de rango (muestra muy pequeña en cronológico). Esto indica un cambio de cobertura; no aísla el efecto causal del helio.

## Archivos

- `configuraciones.csv`: clasificación de parámetros de la búsqueda final interna.
- `particiones.csv` y `asignaciones.csv`: configuración seleccionada, tamaños, fechas, métricas y papel de cada ensayo en cada división.
- `validacion.csv` y `validacion_temporal.csv`: observado, estimado, referencia, KNN anterior, residuo, condiciones y cobertura del rango de entrenamiento.
- `metricas_mezclas.csv`: errores por combustible, por mezcla y por ambos.
- `vecinos_validacion.csv`: consultas, vecinos, pesos, distancias y evidencia por división.
- `modelo.json` y `resumen.json`: ajuste reutilizable y resultados. `exclusiones.csv` explica 16 ensayos omitidos.

El KNN cubre dos combustibles y condiciones FLEX. Las fuentes sobre cabinas, incidentes históricos y atmósferas planetarias sirven para encuadrar la interpretación; no son filas de entrenamiento ni umbrales de seguridad.
