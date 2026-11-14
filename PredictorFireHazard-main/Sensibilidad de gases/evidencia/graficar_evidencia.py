"""Grafica valores tabulados de dos publicaciones sin combinarlos en un modelo."""
import csv
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

ROOT = Path(__file__).resolve().parent
COLOR = {"He": "#137783", "Xe": "#9b4b08", "CO₂": "#335a9c"}


def datos(nombre):
    with (ROOT / nombre).open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def estilo(ax, axis="x"):
    ax.set_axisbelow(True)
    ax.grid(axis=axis, color="#e2e8ef")
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.spines["bottom"].set_color("#74869b")
    ax.tick_params(axis="y", length=0)


def loi():
    filas = datos("loi_experimental.csv")
    fig, axs = plt.subplots(1, 2, figsize=(12, 5.6), sharex=True)
    for ax, plataforma in zip(axs, ("ISS", "Torre de caída")):
        for r in (r for r in filas if r["plataforma"] == plataforma):
            gas, combustible = r["gas"], r["combustible"]
            y = (0 if combustible == "Metanol" else 1) + (-.15 if gas == "He" else .15)
            v = float(r["loi_o2_pct"])
            if r["tipo"] == "cota_superior_estricta":
                ax.scatter(v, y, marker="o", s=84, facecolors="white", edgecolors=COLOR[gas], lw=2, zorder=4)
                ax.annotate("", (v-2.4, y), (v-.32, y),
                            arrowprops={"arrowstyle": "-|>", "lw": 2, "color": COLOR[gas]})
                etiqueta = f"<{v:g} %"
            elif r["tipo"] == "intervalo_publicado":
                e = float(r["variacion_publicada_pp"])
                ax.errorbar(v, y, xerr=e, fmt="o", markersize=8, lw=2, capsize=4, color=COLOR[gas])
                etiqueta = f"{v:g} ± {e:g} %"
            else:
                ax.scatter(v, y, s=68, color=COLOR[gas], zorder=4)
                etiqueta = f"{v:g} %"
            ax.annotate(etiqueta, (v,y), xytext=(0,-19 if gas=="Xe" or plataforma=="Torre de caída" else 12),
                        textcoords="offset points", ha="center", color=COLOR[gas], fontsize=10, fontweight="bold")
        ax.set_title(plataforma, loc="left", fontsize=15, fontweight="bold")
        ax.set(yticks=[0, 1], yticklabels=["Metanol", "n-Heptano"], ylim=(1.48,-.45), xlim=(0,21.5),
               xlabel="Índice límite de oxígeno (O₂ molar, %)")
        ax.set_xticks(range(0,21,5))
        estilo(ax)
    fig.suptitle("Con xenón, las gotas sostuvieron llama a menor O₂ que con helio", x=.09,y=.96,
                 ha="left",fontsize=17,fontweight="bold")
    fig.text(.09,.895,"Datos experimentales a 1 atm · El índice mide la posibilidad de sostener llama cuasiestacionaria.",fontsize=10,color="#375066")
    fig.legend(handles=[Line2D([],[],marker="o",color=COLOR[g],linestyle="none",label=l)
                        for g,l in (("He", "Helio"),("Xe", "Xenón"))],
               loc="lower center",bbox_to_anchor=(.5,.135),ncol=2,frameon=False)
    fig.text(.09,.077,"En ISS, las flechas marcan cotas superiores con Xe; no se midió su valor exacto. En torre, las barras reproducen el ± publicado.",fontsize=9,color="#375066")
    fig.text(.09,.037,"Fuente: Vang (2023), tabla 2.2. No es una concentración segura para naves ni una predicción del KNN.",fontsize=9,color="#375066")
    fig.subplots_adjust(left=.13,right=.97,bottom=.27,top=.79,wspace=.29)
    fig.savefig(ROOT/"loi_helio_xenon.png",dpi=165,facecolor="white")


def persistencia():
    filas = datos("persistencia_torre_caida.csv")
    fig, ax = plt.subplots(figsize=(11,5.5))
    estilo(ax)
    y = {"Xe": 0, "He": 1, "CO₂": 2}
    simbolo = {"combustion_sostenida": ("D","#a44916","Llama sostenida tras retirar el ignitor"),
               "solo_con_ignitor": ("s","#436392","Solo con el ignitor"),
               "calor_despreciable": ("o","#2d7474","Calor despreciable")}
    ax.axvline(50, color="#7895af", lw=1.5, linestyle="--")
    for r in filas:
        c, gas = int(r["concentracion_diluyente_pct"]),r["gas"]
        marker, color, _ = simbolo[r["observacion"]]
        ax.scatter(c,y[gas],marker=marker,s=110,c=color,zorder=4,edgecolors="white",linewidths=.7)
        ax.annotate(f"{c} %",(c,y[gas]),xytext=(0,12),textcoords="offset points",ha="center",fontsize=10,fontweight="bold",color=color)
    ax.set(yticks=[0,1,2],yticklabels=["Xenón (Xe)","Helio (He)","CO₂"],ylim=(2.4,-.46),xlim=(0,95),
           xlabel="Fracción molar del diluyente añadido al aire (%)")
    ax.set_xticks([0,10,20,30,40,50,60,70,80,90])
    fig.suptitle("Con 50 % de diluyente, el desenlace dependió del gas",x=.11,y=.96,ha="left",fontsize=17,fontweight="bold")
    fig.text(.11,.895,"Metanol sobre fibra · Torre de caída NASA Glenn · 0.101 MPa, 298 K.",fontsize=10,color="#375066")
    fig.legend(handles=[Line2D([],[],marker=m,color=c,linestyle="none",label=l)
                        for m,c,l in simbolo.values()],loc="lower center",bbox_to_anchor=(.5,.122),ncol=3,frameon=False)
    fig.text(.11,.077,"Se muestran los niveles discretos tabulados, no límites exactos ni una curva de respuesta.",fontsize=9,color="#375066")
    fig.text(.11,.037,"Fuente: Shaw y Wei (2012), tabla 1. Estos resultados no se usan para entrenar duración FLEX.",fontsize=9,color="#375066")
    fig.subplots_adjust(left=.14,right=.95,bottom=.255,top=.8)
    fig.savefig(ROOT/"persistencia_por_diluyente.png",dpi=165,facecolor="white")


if __name__ == "__main__":
    loi()
    persistencia()
