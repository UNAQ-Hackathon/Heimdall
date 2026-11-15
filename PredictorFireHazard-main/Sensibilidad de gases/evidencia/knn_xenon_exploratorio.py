"""Reproduce un contraste KNN exploratorio, separado de FLEX PSI-69.

Vang (2023), tabla 2.1: gotas libres de metanol, 0.7 atm, ISS. Cada
partición reserva una fracción de Xe completa. No hay IDs de sesión.
"""
import csv
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

SOURCE = "https://escholarship.org/content/qt58p1p8rw/qt58p1p8rw.pdf#page=42"
DATA = np.array([
    (.30, 3.92, 2.21), (.30, 3.06, 2.03), (.45, 3.19, 2.53),
    (.45, 3.65, 2.63), (.45, 2.27, 2.36), (.53, 4.22, 3.31),
    (.53, 4.95, 3.43), (.60, 3.95, 3.73), (.60, 3.08, 3.68),
    (.60, 2.21, 3.41)])


def evaluate():
    result = []
    for fraction in sorted(set(DATA[:, 0])):
        train = DATA[DATA[:, 0] != fraction]
        test = DATA[DATA[:, 0] == fraction]
        scale = train[:, :2].std(axis=0)
        for f, d, y in test:
            distance = np.linalg.norm((train[:, :2] - np.array([f, d])) / scale, axis=1)
            neighbors = np.argsort(distance, kind="stable")[:2]
            pred = np.average(train[neighbors, 2], weights=1 / distance[neighbors])
            result.append(dict(xe_fraccion=f, diametro_mm=d, presion_atm=.7, observado_s_mm2=y,
                               tiempo_derivado_s=y*d*d, knn_s_mm2=pred, mediana_s_mm2=np.median(train[:, 2]),
                               fraccion_fuera_rango=not min(train[:,0])<=f<=max(train[:,0]), fuente=SOURCE))
    return result


def main():
    out = Path(__file__).resolve().parent
    rows = evaluate()
    with (out/"xenon_iss_ensayos_y_validacion.csv").open("w",encoding="utf-8-sig",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    fig, ax=plt.subplots(figsize=(9,5.2))
    x=100*DATA[:,0]
    dots=ax.scatter(x,DATA[:,2],c=DATA[:,1],cmap="viridis",s=90,edgecolor="#172937",linewidth=.5)
    for i in (np.argmin(DATA[:,2]),np.argmax(DATA[:,2])):
        ax.annotate(f"{DATA[i,2]:.2f}",(x[i],DATA[i,2]),xytext=(9,4),textcoords="offset points",fontweight="bold")
    ax.set_xticks([30,45,53,60])
    ax.set_xlim(26,65);ax.set_ylim(1.85,3.95)
    ax.set_xlabel("Fracción molar de xenón (%)")
    ax.set_ylabel("Tiempo de extinción normalizado (s/mm²)")
    ax.spines[["top","right"]].set_visible(False);ax.grid(alpha=.18)
    fig.colorbar(dots,ax=ax,label="Diámetro inicial (mm)",pad=.045)
    fig.suptitle("Xenón · Extinción de gotas de metanol en la ISS",x=.12,y=.964,ha="left",fontsize=16,fontweight="bold")
    fig.text(.12,.89,"Diez mediciones a 0.7 atm, agrupadas por fracción de Xe",fontsize=10,color="#34495c")
    fig.text(.12,.037,"Fuente: Vang (2023), tabla 2.1. Eje vertical: segundos divididos por el diámetro inicial al cuadrado.",fontsize=8.5,color="#34495c")
    fig.subplots_adjust(left=.12,right=.88,top=.82,bottom=.18)
    fig.savefig(out/"xenon_iss_por_concentracion.png",dpi=175)
    plt.close(fig)
    for k in ("knn_s_mm2","mediana_s_mm2"):
        print(k,round(np.mean([abs(r[k]-r["observado_s_mm2"]) for r in rows]),5))


if __name__=="__main__":
    main()
