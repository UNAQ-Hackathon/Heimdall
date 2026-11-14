# Predictor FLEX de microgravedad

Estima la **duración de combustión registrada** en segundos para gotas de metanol o heptano del experimento [FLEX / PSI-69 de NASA](https://psi.nasa.gov/physci/repo/data/investigations/PSI-69). Se conserva el enfoque del predictor general de tendencias: compara un modelo de vecinos cercanos (KNN), una regresión y una referencia simple, y decide con datos reservados. Aquí el objetivo es una respuesta experimental de un ensayo nuevo; la fecha se usa para agrupar ensayos en la evaluación, nunca como predictor.

Desde la carpeta que contiene este README:

```powershell
py -m pip install -r .\requirements.txt
py .\predictor_microgravedad.py entrenar
py .\predictor_microgravedad.py predecir --fuel Methanol --presion-mmhg 765 --o2-fraccion 0.21 --n2-fraccion 0.79 --co2-fraccion 0 --he-fraccion 0 --diametro-mm 1.8
```

El comando de entrenamiento admite `--input` para otro CSV PSI-69 del mismo formato y `--output` para una carpeta distinta. Por defecto usa la copia del archivo local `train/nasa/nasa/PSI-69_Experimental table_FLEX.csv` que viene en `data`. El SHA-256 en los resultados verifica la revisión que realmente se entrenó. El [informe técnico de NASA](https://ntrs.nasa.gov/citations/20150023456) identifica el gas como CO₂ (el CSV lo abrevia «CO») y confirma las unidades.

- **Mediciones:** 274 ensayos; 258 aptos en 79 grupos. Se excluyen 16: entradas/duración sin valor exacto o presión 0. `exclusiones.csv` registra las filas omitidas.
- **Entradas:** combustible, presión (mmHg), diámetro inicial (mm) y fracciones molares iniciales de O₂, N₂, CO₂ y He. Se excluyen tasa de combustión, diámetro de extinción, duración y motivo del fin de ensayo de las variables predictoras porque se miden después del inicio.
- **Validación:** 5 particiones por fecha. Cuando se repite un identificador de experimento o una combinación exacta de entradas, se mantienen juntos. En el entrenamiento de cada partición, otros 4 cortes seleccionan el modelo; no se usa la partición reservada para elegir el ganador. La referencia es la mediana de los ensayos de entrenamiento de cada corte.
- **Resultado:** error absoluto medio de **3.26 s** frente a **6.10 s** de la mediana; raíz del error cuadrático medio de **4.49 s** frente a **7.92 s**. Modelo final: KNN de 3 vecinos ponderados por distancia. Es rendimiento dentro de FLEX con días reservados, no validación entre campañas, combustibles o aparatos.
- **Prueba temporal adicional:** los 48 ensayos de los últimos 16 grupos (desde el 21 de septiembre de 2011) se reservan por completo. Se selecciona el modelo y ajusta en los 210 ensayos anteriores. En ese corte, KNN tiene un error medio de **6.08 s** frente a **4.41 s** de la mediana. No mostró una mejora para el tramo más tardío de FLEX.
- **Archivos:** `modelo.json` almacena el ajuste final reutilizable y los identificadores de los vecinos. El comando `predecir` entrega las corridas empleadas y el peso asignado a cada una. `validacion.csv` contiene un estimado fuera de muestra por fila, junto con observado, referencia y condiciones iniciales. `resumen.json` da métricas, límites, conteos y procedencia.

**Interpretación:** el cierre registrado incluye extinción, disrupción y finalización, así que el valor estimado no equivale necesariamente al tiempo hasta autoextinción. El predictor bloquea valores fuera de los rangos individuales ensayados para el combustible y el diluyente; dentro de esos rangos pueden existir combinaciones nunca ensayadas. No estima intervalos predictivos ni establece umbrales de seguridad.
