# Hallazgos de FLEX

Fuente: [NASA FLEX, PSI-69](https://doi.org/10.60555/mbq8-0451). Este análisis describe 258 ensayos válidos de 274 registros, sin imputar los excluidos. La duración registrada puede corresponder a extinción, disrupción o finalización. No representa tiempo hasta autoextinción para toda la muestra.

## Mezclas y relaciones

| Combustible | Mezcla | n | Mediana (s) | Mediana diámetro (mm) | Mediana presión (mmHg) |
|---|---|---:|---:|---:|---:|
| Metanol | O₂/N₂ | 53 | 12.80 | 2.84 | 764.2 |
| Metanol | CO₂ | 73 | 14.80 | 3.33 | 539.2 |
| Metanol | He | 26 | 8.00 | 2.80 | 534.5 |
| Heptano | O₂/N₂ | 41 | 8.90 | 3.07 | 762.4 |
| Heptano | CO₂ | 45 | 6.50 | 2.91 | 759.0 |
| Heptano | He | 20 | 4.95 | 2.69 | 646.0 |

Las mezclas con CO₂ o He no son atmósferas de un solo gas: también contienen O₂. En FLEX las distribuciones de diámetro, presión y composición cambian entre subgrupos; sus medianas no son efectos aislados. Una asociación con presión parcial de O₂ no aporta evidencia separada de presión y fracción de O₂.

Asociaciones monotónicas de mayor magnitud por estrato (descriptivas, sin inferencia causal):

- Metanol, O₂/N₂: Diámetro inicial (mm), ρ = +0.82 (n = 53).
- Metanol, CO₂: O₂ (fracción molar), ρ = +0.56 (n = 73).
- Metanol, He: He (fracción molar), ρ = -0.68 (n = 26).
- Heptano, O₂/N₂: O₂ (fracción molar), ρ = +0.75 (n = 41).
- Heptano, CO₂: O₂ (fracción molar), ρ = +0.80 (n = 45).
- Heptano, He: O₂ (fracción molar), ρ = +0.81 (n = 20).

## Picos y bajas

Son máximos y mínimos observados por combustible, no puntos de inflexión ni tendencias cronológicas. Las fechas ordenan corridas independientes con condiciones cambiantes.

| Combustible | Extremo | Ensayo | Fecha | Duración (s) | Mezcla | Fin registrado |
|---|---|---|---|---:|---|---|
| Metanol | Máximo | #146 (C01M301) | 2010-11-16 | 39.20 | CO₂ | Extinción |
| Metanol | Mínimo | #248 (H08M101) | 2011-10-11 | 0.30 | He | Extinción |
| Heptano | Máximo | #205 (N01H102) | 2011-08-29 | 24.00 | O₂/N₂ | Disrupción |
| Heptano | Mínimo | #129 (C13H102) | 2010-09-17 | 0.55 | CO₂ | Extinción |

Extremos separados por mezcla y combustible:

| Combustible | Mezcla | Mínimo (s) / ensayo | Máximo (s) / ensayo |
|---|---|---|---|
| Metanol | O₂/N₂ | 3.20 / #3 | 29.10 / #58 |
| Metanol | CO₂ | 1.30 / #140 | 39.20 / #146 |
| Metanol | He | 0.30 / #248 | 17.40 / #262 |
| Heptano | O₂/N₂ | 1.30 / #69 | 24.00 / #205 |
| Heptano | CO₂ | 0.55 / #129 | 21.70 / #92 |
| Heptano | He | 1.40 / #270 | 12.20 / #249 |

## Gráficas y lectura del KNN

La curva de k resume una búsqueda de configuraciones, no aprendizaje por épocas. La validación da a cada grupo un único papel dentro de cada partición. La proyección de vecinos utiliza dos variables solo para ilustrar el caso; el cálculo considera el espacio completo. Consulte el resumen del entrenamiento para el método de selección y la comparación cronológica.

Reproducir: `py graficar_flex.py --resultados ..\knn\resultados` (NumPy y Matplotlib).

## Error por mezcla y cobertura

El corte cronológico contiene 45 ensayos con He; 0 entran en los rangos individuales del mismo combustible y mezcla del entrenamiento. Ese cambio de condiciones limita la evaluación prospectiva.

| Validación | Combustible | Mezcla | n | En rango | MAE KNN (s) | MAE mediana (s) |
|---|---|---|---:|---:|---:|---:|
| Por fecha | Heptano | CO₂ | 45 | 37 | 1.65 | 5.00 |
| Por fecha | Metanol | CO₂ | 73 | 53 | 4.31 | 8.24 |
| Por fecha | Heptano | He | 20 | 11 | 3.04 | 4.90 |
| Por fecha | Metanol | He | 26 | 12 | 2.39 | 4.29 |
| Por fecha | Heptano | O₂/N₂ | 41 | 32 | 4.75 | 5.52 |
| Por fecha | Metanol | O₂/N₂ | 53 | 44 | 3.32 | 5.87 |
| Cronológica | Heptano | He | 20 | 0 | 2.98 | 4.81 |
| Cronológica | Metanol | He | 25 | 0 | 7.99 | 4.31 |
| Cronológica | Heptano | O₂/N₂ | 3 | 3 | 3.68 | 2.70 |