# Flame in Freefall: iteración del predictor KNN

Abre **Explorar KNN.html** en tu navegador. Puedes estimar la duración de combustión de una gota FLEX, ver qué ensayos sustentan el valor, explorar las gráficas o comparar las atmósferas de los ocho planetas y la Luna. No hace falta un servidor. Los enlaces a las fuentes NASA sí requieren Internet.

El entrenamiento parte de los **258 ensayos válidos de 274** en [FLEX / PSI-69](https://psi.nasa.gov/physci/repo/data/investigations/PSI-69) y agrupa por fecha, identificadores repetidos o condiciones iniciales idénticas. El objetivo es la duración registrada, que puede acabar por extinción, disrupción o finalización. Usa solo combustible, diámetro inicial, presión y fracciones iniciales de O₂, N₂, CO₂ y He. Se excluyeron 16 registros sin valores válidos; están en `knn/resultados/exclusiones.csv`.

KNN aprende conservando los ejemplos del conjunto de entrenamiento. Al iterarlo se compararon **324 configuraciones** combinando número de vecinos, ponderación, distancia, fracciones o presiones parciales y reglas para elegir vecinos. El modelo final usa **5 vecinos del mismo combustible**, distancia euclidiana y pesos inversos al cuadrado de la distancia. Las mezclas se analizaron separadas y se ensayó restringir los vecinos a la misma mezcla; esa política no obtuvo el menor error en la selección. Los gases siguen siendo entradas y el filtro de rango distingue cada combinación combustible/mezcla.

| Datos retenidos | KNN iterado | KNN fijo de 3 vecinos | Mediana global |
|---|---:|---:|---:|
| 5 particiones por grupo (258 predicciones) | 3.42 s | **3.17 s** | 6.10 s |
| Tramo cronológico final (48 ensayos) | 5.63 s | 6.08 s | **4.41 s** |

La tabla muestra error absoluto medio; los modelos se comparan en las mismas particiones. El resultado agrupado evalúa la selección anidada (5 cortes externos, 4 internos), no una configuración elegida tras consultar los valores retenidos. El corte cronológico selecciona usando solo la parte anterior y después mide el tramo final. En ese tramo, **45 de 48 ensayos usaron He**, frente a **1 de 210** antes del corte; solo **3 de 48** quedaron en los rangos individuales de su combustible y mezcla vistos antes de ese tramo. El error en los 48 es diagnóstico; el estimador no entrega cifras para entradas fuera de los rangos de su propio entrenamiento. En conjunto, la nueva configuración no mejora todos los escenarios. El tramo final no apoya usar el modelo como predictor de campañas nuevas.

Las gráficas separan O₂/N₂ sin CO₂ ni He, mezclas con CO₂ y mezclas con He. Por ejemplo, en metanol con O₂/N₂, diámetro inicial y duración se asociaron positivamente (Spearman ρ ≈ 0.82; 53 ensayos); en heptano con CO₂, la asociación del diámetro fue aproximadamente nula (ρ ≈ −0.02; 45 ensayos). Los extremos registrados son **0.30 s** (#248, metanol/He) y **39.20 s** (#146, metanol/CO₂). Son valores entre corridas con condiciones distintas. El archivo [Hallazgos FLEX](graficas/Hallazgos%20FLEX.md) explica unidades, estratos y límites de interpretación.

La guía de combustión, Apollo 1, Apollo 13 y NASA Spinoff están documentados en [Fuentes NASA y decisiones](Fuentes%20NASA%20y%20decisiones.md). Sirven para separar la física de gotas de la detección de partículas, los accidentes en cabina o tanque y las atmósferas exteriores. El [catálogo de atmósferas](contexto/atmosferas_y_combustion.md) es una capa de consulta; sus registros no se incorporan al KNN.

## Reproducir

Ejecuta estos comandos en PowerShell desde esta carpeta:

```powershell
py -m pip install -r .\knn\requirements.txt
py -m pip install matplotlib
py .\knn\knn_iterativo.py entrenar
py .\graficas\graficar_flex.py --resultados .\knn\resultados
py .\generar_panel.py
```

El CSV fuente va incluido en `knn/data`. El hash SHA-256 en `knn/resultados/resumen.json` identifica la versión entrenada. Consulta `configuraciones.csv` para la búsqueda interna; `asignaciones.csv` para roles por ensayo y corte; `particiones.csv`/ `validacion.csv`/ `validacion_temporal.csv` para los cortes y sus predicciones; y `metricas_mezclas.csv` para el error por estrato.

```powershell
py .\knn\knn_iterativo.py predecir --fuel Methanol --presion-mmhg 765 --o2-fraccion 0.21 --n2-fraccion 0.79 --co2-fraccion 0 --he-fraccion 0 --diametro-mm 1.8
```
