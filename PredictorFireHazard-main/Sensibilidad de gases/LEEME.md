# Sensibilidad a gases y ensayos para revisión

## Qué muestran las gráficas

- [Puntos FLEX por gas y combustible](01_puntos_FLEX_por_gas.png): un punto por ensayo; eje X = oxígeno inicial (% molar), eje Y = duración registrada (s). La forma del punto indica extinción, disrupción o finalización. Se identifican mínimos y máximos. El sombreado y los círculos naranja señalan una combinación de **duración ≥ Q75 y O₂ ≤ Q25** dentro del mismo combustible y mezcla, con cuartiles inclusivos. Son observaciones para revisar, no puntos de ignición, probabilidad de incendio, límites de seguridad ni evidencia de que una llama fría continuara.
- [Extinción en quemador de copa](02_puntos_extincion_por_gas.png): cada punto es una cifra publicada, diferenciada por estudio. CO₂: 20.4–23 %, N₂: 29–33.6 %, He: 31–32 %, Ar: 38–43.3 %. Los rangos son mínimos/máximos entre series, no intervalos estadísticos. El Xe no tiene una medición comparable en esas tablas. En la serie común de Sheinson, los cuatro valores son 21 %, 30 %, 32 % y 41 %, respectivamente. Menor concentración significa que se necesitó menos del gas en ese quemador con n-heptano, no una clasificación universal.
- [Argón y xenón en simulaciones](03_puntos_argon_xenon_simulacion.png): índice de oxígeno límite modelado para una gota de metanol, diámetro inicial 1.5 mm y 1 atm. Xe ≈5 %, Ar ≈8 %, He y CO₂ ≈21 %; N₂ ≈11 % proviene de una simulación anterior citada por los autores. El umbral es el de combustión cuasiestacionaria según el criterio del modelo, no el de ignición. Un límite menor indica mayor persistencia de la llama **en el modelo**.
- [Pares de ensayos FLEX con condiciones parecidas](04_comparacion_por_pares_FLEX.png): cada punto es la duración con CO₂ o He menos la duración en un ensayo O₂/N₂ del mismo combustible. Las tolerancias son ±1 punto porcentual de O₂, ±25 mmHg y ±0.20 mm. Se empareja primero la menor distancia cuadrática normalizada, sin reutilizar ensayos dentro de cada combinación combustible/gas. Un control puede aparecer en la comparación del otro gas. El método es descriptivo: no iguala todos los factores, no corrige por fecha, no aleatoriza ni iguala el motivo de fin.
- [Evidencia experimental externa de He y Xe](evidencia/): datos del límite de oxígeno en gotas ISS y en torre de caída, y resultados categóricos de combustión en metanol. Las cotas de Xe en ISS no se conocen como valores exactos. Los estudios externos se mantuvieron fuera del entrenamiento.
- [Puntos medidos con xenón en la ISS](evidencia/xenon_iss_por_concentracion.png): diez gotas de metanol a 0.7 atm, agrupadas por fracción de Xe. El tiempo de extinción normalizado por diámetro inicial al cuadrado pasó de **2.03–2.21 s/mm² al 30 % Xe** a **3.41–3.73 s/mm² al 60 % Xe**. No es un barrido puro de Xe: al modificar la proporción de Xe en aire también cambia la fracción de O₂.

## Cuáles fueron y qué gas se comportó mejor

| Ensayo FLEX | Combustible | Mezcla | O₂ | Duración | Fin registrado |
|---|---|---|---:|---:|---|
| #215 | Metanol | O₂/N₂ | 14 % | 26.0 s | Extinción |
| #192 | Metanol | Con CO₂ | 17 % | 21.8 s | Extinción |
| #240 | Metanol | Con He | 17 % | 13.1 s | Extinción |

Los tres superaron o igualaron el cuartil superior de duración con O₂ en el cuartil inferior de su grupo. Que ningún punto del heptano cumpla esta regla no implica que el heptano sea más seguro. El MAX/MIN de toda la muestra sigue siendo #146 (39.20 s, metanol/CO₂) y #248 (0.30 s, metanol/He).

En el subconjunto **emparejado de FLEX**, el descenso de duración fue mayor con **He para metanol** (mediana −9.05 s, 8 pares; CO₂: −0.65 s, 12 pares) y con **CO₂ para heptano** (−4.0 s, 10 pares; He: −0.90 s, 8 pares), cada uno respecto a O₂/N₂. La muestra pequeña y la variación en los desenlaces impiden tomarlo como efecto aislado de supresión. La literatura de quemador de copa sí compara concentración de extinción y favorece a CO₂ frente a los demás gases que midió. La evidencia experimental en gotas muestra que Xe sostuvo combustión a menos O₂ que He en los protocolos estudiados; no se deduce una posición cuantitativa para Xe dentro del protocolo NIST.

## Entrenamiento KNN

El nuevo KNN se reentrenó con 258 ensayos de FLEX y 324 configuraciones; no se duplicaron casos ni se añadieron filas sintéticas. La predicción publicada exige datos del mismo combustible y mezcla en rangos compatibles, al menos cinco ensayos en tres grupos y suficiente proximidad a un vecino de la misma mezcla y combustible. El umbral de distancia se estima en los datos de entrenamiento. El modelo final de cinco vecinos ponderados puede aprovechar otros gases del mismo combustible una vez que existe ese respaldo.

| Evaluación | Predicciones respaldadas | MAE v3 | MAE v2 | Mediana global |
|---|---:|---:|---:|---:|
| Grupos reservados | 162 de 258 | 2.92 s | 2.96 s | 6.11 s |
| Último tramo cronológico | 3 de 48 | 3.37 s | 3.68 s | 2.70 s |

Las comparaciones son **sobre las mismas filas respaldadas**. En los 258 casos, si se obliga a predecir incluso sin respaldo, v3 empeora (3.57 vs 3.42 s). Esta iteración mejora la utilidad de saber cuándo abstenerse, no demuestra una mejora general de precisión ni capacidad para una campaña nueva. En el corte cronológico no hubo respaldo para los 45 ensayos con He.

**Ar y Xe no se incorporaron al KNN FLEX:** el CSV PSI-69 no identifica estos gases y sus fuentes externas no miden la misma respuesta. Sí se ejecutó un **KNN exploratorio separado para Xe** con diez mediciones de la [tabla 2.1 de Vang](https://escholarship.org/content/qt58p1p8rw/qt58p1p8rw.pdf#page=42). Se fijó k=2, distancia euclidiana ponderada por la inversa, y se estandarizó dentro de cada partición. Se retuvieron fracciones enteras de Xe (4 niveles). MAE: **0.42 vs 1.00 s/mm²** de la mediana. Cinco casos quedan fuera del intervalo de concentraciones de su partición al retirar los niveles extremos. No hay IDs de sesión; tampoco una evaluación independiente ni respaldo para uso predictivo operativo. El CSV incluye la marca de extrapolación. Ar sigue como referencia experimental y simulada, sin modelo entrenado.

## Archivos y fuentes

`puntos_FLEX.csv` contiene los 258 valores con umbrales de revisión; `puntos_para_revision.csv` contiene las tres observaciones marcadas. `pares_exploratorios.csv` documenta los 38 pares y sus condiciones. El código y la validación del KNN se encuentran en `knn`. Para recrear las gráficas (con Matplotlib):

```powershell
py .\analizar_gases.py --input .\knn\resultados\validacion.csv
```

- [NASA, resultados FLEX / PSI-69](https://ntrs.nasa.gov/citations/20150023456).
- [Senecal, tabla 2 de quemador de copa](https://www.nist.gov/system/files/documents/el/fire_research/R0301576.pdf) y [Pitts–Blevins, tabla 1](https://www.nist.gov/system/files/documents/el/fire_research/R9902715.pdf). Se conservaron series distintas y se omitieron duplicados entre tablas.
- [Alam, Dryer y Farouk, resultados computacionales](https://doi.org/10.1080/00102202.2015.1085033), [figura y texto del autor](https://www.researchgate.net/figure/Computational-comparison-of-diluent-e-ff-ect-on-methanol-droplet-combustion-a-droplet_fig4_283179331) y [tesis de Alam](https://scholarcommons.sc.edu/etd/4737/), capítulo 3, figura 3.4. N₂: [Farouk y Dryer](https://doi.org/10.1016/j.combustflame.2012.04.005), referido por Alam.
- [Vang, tabla 2.2](https://escholarship.org/content/qt58p1p8rw/qt58p1p8rw.pdf#page=48); [Shaw y Wei, tabla 1](https://doi.org/10.1155/2012/587987).
- [NASA, llamas frías de alcanos](https://ntrs.nasa.gov/citations/20205008449): el Xe puede reducir la tasa y prolongar la combustión de llamas frías respecto a otros diluyentes, incluida la persistencia a menor O₂ frente a He.
