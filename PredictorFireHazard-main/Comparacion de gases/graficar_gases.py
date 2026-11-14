"""Compara extremos de duración FLEX y concentraciones de extinción publicadas."""
import argparse
import csv
from pathlib import Path
from statistics import median
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

MEZCLAS = {"O₂/N₂": "O₂/N₂ (referencia)", "CO₂": "Con CO₂", "He": "Con He"}
NIST = [("CO₂", 21), ("N₂", 30), ("He", 32), ("Ar", 41), ("Xe", None)]


def flex(filas, salida):
    resumen = []
    fig, axs = plt.subplots(1, 2, figsize=(13, 6.4), sharex=True)
    for ax, (fuel, nombre) in zip(axs, (("Methanol", "Metanol"), ("Heptane", "Heptano"))):
        etiquetas = []
        for i, (mezcla, etiqueta) in enumerate(MEZCLAS.items()):
            datos = sorted((r for r in filas if r["fuel"] == fuel and r["mezcla"] == mezcla),
                           key=lambda r: (float(r["observado_s"]), int(r["prueba"])))
            if not datos:
                raise ValueError(f"No hay datos para {fuel} / {mezcla}")
            valores = [float(r["observado_s"]) for r in datos]
            ext = [float(r["observado_s"]) for r in datos if r["fin_ensayo"] == "Extinction"]
            bajo, alto, centro = datos[0], datos[-1], median(valores)
            etiquetas.append(f"{etiqueta}\nn = {len(datos)}")
            for j, r in enumerate(datos):
                ax.scatter(float(r["observado_s"]), i+((j*7)%13-6)*.015, s=15, alpha=.41,
                           color="#477a92" if r["fin_ensayo"] == "Extinction" else "#a98360",
                           linewidths=0)
            ax.plot([valores[0], valores[-1]], [i,i], color="#375066", alpha=.48)
            ax.scatter([valores[0], valores[-1]], [i,i], marker="D", s=31, color="#173c56", zorder=4)
            ax.scatter(centro, i, marker="|", s=300, linewidths=3, color="#a54416", zorder=5)
            for r, dy in ((bajo, -24), (alto, 17)):
                ax.annotate(f"{float(r['observado_s']):.2f} s · #{r['prueba']}", (float(r["observado_s"]), i),
                            xytext=(0,dy), textcoords="offset points", ha="center",
                            color="#173c56", fontsize=9, fontweight="bold")
            resumen.append([nombre, mezcla, len(datos), valores[0], centro, valores[-1],
                            bajo["prueba"], alto["prueba"], bajo["fin_ensayo"], alto["fin_ensayo"],
                            len(ext), min(ext) if ext else None, median(ext) if ext else None, max(ext) if ext else None])
        ax.set_yticks(range(3), etiquetas)
        ax.set_ylim(2.49,-.49)
        ax.set_xlim(-3.5, 45)
        ax.set_xlabel("Duración registrada (s)")
        ax.set_title(nombre, loc="left", fontweight="bold")
        ax.grid(axis="x", alpha=.2)
        ax.spines[["top","right"]].set_visible(False)
    fig.suptitle("FLEX · Picos y bajas por mezcla y combustible", fontsize=19, fontweight="bold", x=.095, ha="left", y=.97)
    fig.text(.095,.90,"Cada punto es un ensayo. Los extremos llevan el número de prueba.",color="#375066")
    fig.legend(handles=[
        Line2D([],[],marker="o",color="#477a92",linestyle="none",label="Fin por extinción"),
        Line2D([],[],marker="o",color="#a98360",linestyle="none",label="Otro fin registrado"),
        Line2D([],[],marker="D",color="#173c56",linestyle="none",label="Mínimo / máximo"),
        Line2D([],[],marker="|",markeredgewidth=3,color="#a54416",linestyle="none",label="Mediana")],
        loc="lower center",bbox_to_anchor=(.5,.105),ncol=4,frameon=False)
    fig.text(.095,.035,"Fuente: PSI-69 FLEX. No hay Ar ni Xe identificables en estas filas; las duraciones no miden eficacia de supresión.",color="#375066",fontsize=10)
    fig.subplots_adjust(left=.16,right=.96,bottom=.22,top=.83,wspace=.40)
    fig.savefig(salida/"01_picos_y_bajas_FLEX.png",dpi=175)
    plt.close(fig)
    with (salida/"resumen_extremos_FLEX.csv").open("w",encoding="utf-8-sig",newline="") as f:
        writer=csv.writer(f)
        writer.writerow(["combustible","mezcla","n","min_s","mediana_s","max_s","ensayo_min","ensayo_max",
                         "fin_min","fin_max","n_fin_extincion","min_fin_extincion_s","mediana_fin_extincion_s","max_fin_extincion_s"])
        writer.writerows(resumen)


def referencia(salida):
    fig, ax = plt.subplots(figsize=(10,5.7))
    ax.set_title("Concentración de extinción en quemador de copa",loc="left",fontsize=18,fontweight="bold",pad=30)
    ax.text(0,1.014,"n-heptano · Serie experimental [1] tabulada por NIST", transform=ax.transAxes,color="#375066")
    for i,(gas,v) in enumerate(NIST):
        if v is None:
            ax.text(1,i,"Sin valor en esta serie", color="#5c6470",va="center")
        else:
            ax.hlines(i,0,v,color="#94b6c6",linewidth=3)
            ax.scatter(v,i,color="#126783",s=64,zorder=3)
            ax.text(v+1,i,f"{v} %",fontweight="bold",va="center",color="#173c56")
    ax.set_yticks(range(len(NIST)),[g for g,v in NIST])
    ax.set_ylim(4.55,-.55)
    ax.set_xlim(0,49)
    ax.set_xlabel("Fracción molar del agente añadida al oxidante (%)")
    ax.grid(axis="x",alpha=.18)
    ax.spines[["top","right","left"]].set_visible(False)
    fig.text(.12,.067,"Menor concentración = menos agente requerido en esta prueba.",fontweight="bold",color="#173c56")
    fig.text(.12,.026,"Fuente: NIST, tabla 1, columna Cup Burner [1]. No es una medición FLEX ni una dosis para naves.",fontsize=9,color="#375066")
    fig.subplots_adjust(left=.12,right=.95,bottom=.19,top=.79)
    fig.savefig(salida/"02_concentracion_extincion_NIST.png",dpi=175)
    plt.close(fig)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input",type=Path,required=True)
    parser.add_argument("--output",type=Path,default=Path(__file__).resolve().parent)
    args=parser.parse_args()
    with args.input.open(encoding="utf-8-sig",newline="") as f:
        filas=list(csv.DictReader(f))
    args.output.mkdir(parents=True,exist_ok=True)
    flex(filas,args.output)
    referencia(args.output)


if __name__ == "__main__":
    main()
