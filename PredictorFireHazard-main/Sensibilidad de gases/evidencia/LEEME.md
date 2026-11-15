# Evidencia experimental de sensibilidad al diluyente

Estas gráficas quedan separadas del KNN de duración FLEX. Sus resultados corresponden a dos criterios y protocolos distintos. No sirven para definir un umbral seguro de navegación, una concentración de descarga o una probabilidad de incendio.

- **Índice límite de oxígeno (LOI).** [Vang, tesis de UC Davis, tabla 2.2 y sección 2.4.3](https://escholarship.org/content/qt58p1p8rw/qt58p1p8rw.pdf#page=48), experimentos de gota a 1 atm. En la ISS, el LOI publicado con He fue 14 % de O₂ para metanol y 15 % para n-heptano; con Xe fue inferior a 6.5 % y a 11 %, respectivamente. Los valores de Xe en la ISS son cotas superiores estrictas, no valores exactos ni umbrales para otras geometrías. La gráfica muestra por separado la torre de caída. Las barras reproducen la amplitud publicada sin atribuirle un nivel de confianza.
- **Llama después de retirar el ignitor.** [Shaw y Wei, 2012, tabla 1](https://doi.org/10.1155/2012/587987), metanol sobre fibra, torre de caída de NASA Glenn (~0.101 MPa y 298 K). Al añadir 50 % molar de Xe al aire se observó combustión sostenida; a 50 % de He o CO₂ el calor liberado fue despreciable. Son composiciones discretas ensayadas, no límites exactos. Argón y nitrógeno puro no fueron evaluados como agentes añadidos en este conjunto.

Ambas fuentes muestran por qué el Xe merece revisión en experimentos de gotas: permite persistencia de la llama con menos O₂ que He en estas condiciones. No existe evidencia en estas dos tablas para ordenar Ar, Xe, He, CO₂ y N₂ en una misma escala. El índice y las categorías de combustión sostenida no son tiempos en segundos, por eso no se agregaron como filas al modelo FLEX.

Las transcripciones tabuladas y sus localizadores están en los CSV adjuntos. Para reproducir las dos gráficas con Matplotlib instalado, abre PowerShell en esta carpeta y ejecuta `py .\graficar_evidencia.py`.
