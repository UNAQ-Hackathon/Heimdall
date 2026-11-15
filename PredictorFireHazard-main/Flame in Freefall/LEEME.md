# Flame in Freefall

Abre **Flame in Freefall.html** directamente en tu navegador. Funciona sin servidor ni conexión. Puedes filtrar los ensayos FLEX por combustible, comparar observados con estimaciones fuera de muestra, ordenar ensayos similares y probar otras condiciones iniciales. Los vínculos a las fuentes de NASA requieren Internet.

**Train - Flame in Freefall.xlsx** reúne las 18 tablas CSV en hojas separadas, con un índice. La copia idéntica de PSI-159 se conserva y se marca. No había archivos Excel en `train`; las imágenes TIFF y el ZIP de imágenes no son tablas.

**predictor\README.md** explica el entrenamiento reproducible con Python y NumPy. **predictor\resultados** contiene el modelo final, las predicciones fuera de muestra, métricas y exclusiones. **predictor\data** incluye la copia exacta del CSV FLEX utilizado para entrenar.

El predictor estima la duración registrada en el experimento FLEX. No predice toda clase de incendio en microgravedad, no mide riesgo y no establece límites operativos. Una prueba que termina por disrupción o finalización también tiene duración registrada. Los demás experimentos se ofrecen como evidencia para explorar; sus variables no se mezclan con FLEX.

Fuentes: [reto oficial Flame in Freefall](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/), [datos NASA FLEX](https://doi.org/10.60555/mbq8-0451) e [informe técnico FLEX](https://ntrs.nasa.gov/citations/20150023456).

Para regenerar el panel después de entrenar: `py .\build_panel.py --train 'D:\NASA\Codes\train'`. El HTML abre directamente y no requiere instalar Python para usarlo.
