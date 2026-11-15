# Comparación de gases y extremos de combustión

Se usaron dos mediciones separadas. **La concentración de extinción** dice cuánto agente necesitó una llama en un protocolo concreto. **La duración registrada** dice cuánto duró un ensayo FLEX hasta su fin registrado. Una duración menor no prueba que el gas sea mejor supresor: cambian la presión, la fracción de O₂, el diámetro, el combustible y la forma de terminar el ensayo.

## Extinción en un protocolo comparable

En la misma serie experimental de **quemador de copa con n-heptano**, reproducida en la tabla 1, columna *Cup Burner [1]* del [informe alojado por NIST](https://www.nist.gov/system/files/documents/el/fire_research/R9902715.pdf), las concentraciones molares de agente fueron:

| Gas | Concentración de extinción | Qué se puede concluir |
|---|---:|---|
| CO₂ | 21 % | Menor concentración de los cuatro agentes medidos en esta serie. |
| N₂ | 30 % | Requirió menos agente que He y Ar en esta serie. En FLEX, O₂/N₂ es la mezcla de referencia sin CO₂ ni He medidos. |
| He | 32 % | Requirió menos agente que Ar en esta serie. La cercanía con N₂ no establece una diferencia universal. |
| Ar | 41 % | Mayor concentración de la serie. El CSV FLEX usado por el predictor no identifica ensayos con Ar. |
| Xe | Sin valor comparable | NASA observó que Xe reduce la tasa de combustión de llamas frías de gotas, pero que estas pueden persistir a menor O₂ con Xe que con He. Quemar más despacio no equivale a extinguirse. |

El resultado sobre Xe corresponde a otra respuesta y protocolo: [NASA, *Effects of Ambient Inert Gas Properties on Cool-Flame Combustion*](https://ntrs.nasa.gov/citations/20205008449). No se le asigna un porcentaje ni se le inserta en el orden de la prueba NIST. O₂ es el oxidante en estas pruebas. En otro estudio de NASA con cilindros de PMMA en gravedad reducida, CO₂, N₂ y He se evaluaron mediante condiciones de flujo límite; esas mediciones tampoco son intercambiables con el quemador de copa o las gotas FLEX. [NASA, comparación en PMMA](https://ntrs.nasa.gov/citations/20040161262).

## Picos y bajas de FLEX

En los 258 ensayos válidos, las mezclas con He tuvieron la mediana más baja para los dos combustibles al contar todos los motivos de fin. Al considerar solo los ensayos marcados como extinción, en heptano la mediana fue **4.20 s con CO₂**, **4.40 s con He** y **4.65 s con O₂/N₂**. Este es un subconjunto descriptivo: excluir las disrupciones y finalizaciones no convierte las medianas en estimaciones causales.

El mínimo general fue **0.30 s** (metanol con He, ensayo #248) y el máximo **39.20 s** (metanol con CO₂, ensayo #146). Ambos figuran como extinción. Los máximos de heptano en O₂/N₂ y CO₂, **24.00 s** y **21.70 s**, terminaron por disrupción. El CSV adjunto identifica los ensayos y agrega mínimo, mediana y máximo para el subconjunto de extinciones.

El predictor KNN sigue usando solo las columnas y mezclas identificadas de [FLEX PSI-69](https://doi.org/10.60555/mbq8-0451). No estima Ar ni Xe: un modelo de eficacia necesitaría ensayos con concentraciones, criterios de extinción y condiciones comparables, incluyendo pruebas que no se extinguieron.

Para reproducir (Python con Matplotlib, desde esta carpeta):

```powershell
py .\graficar_gases.py --input '..\Iteracion KNN\knn\resultados\validacion.csv'
```
