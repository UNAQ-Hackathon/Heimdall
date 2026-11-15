"""Gráficas y pares exploratorios para la revisión de ensayos FLEX."""
import argparse
import csv
from collections import Counter
from pathlib import Path
from statistics import median, quantiles

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

GASES = ("O₂/N₂", "CO₂", "He")
FUELS = {"Methanol": "Metanol", "Heptane": "Heptano"}
END = {"Extinction": ("o", "#28808a"), "Disruption": ("^", "#a16d2f"),
       "Completion": ("s", "#657486")}
NUM = ("observado_s", "presion_mmhg", "o2_fraccion", "diametro_mm", "co2_fraccion", "he_fraccion")
LABS = ["Hirst y Booth", "Sheinson et al.", "Dlugogorski et al.", "Saito et al.", "Moore et al.", "Hamins et al."]
CUP = {"CO₂": (20.5, 21, None, 22, 20.4, 23), "N₂": (30.2, 30, 29, 33.6, 30, 32),
       "He": (None, 32, None, None, None, 31), "Ar": (None, 41, 39, 43.3, 38, 41),
       "Xe": (None,) * 6}


def write_csv(path, rows):
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def load(path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        for k in NUM:
            r[k] = float(r[k])
        r["prueba"] = int(r["prueba"])
        r["o2_pct"] = round(100*r["o2_fraccion"], 9)
    if len({r["prueba"] for r in rows}) != len(rows):
        raise ValueError("Se encontraron números de ensayo duplicados.")
    if set(r["mezcla"] for r in rows) != set(GASES):
        raise ValueError("Cambió la cobertura de gases; revisa el análisis por mezcla.")
    return rows


def annotate_groups(rows):
    for fuel in FUELS:
        for gas in GASES:
            group = [r for r in rows if r["fuel"] == fuel and r["mezcla"] == gas]
            times = [r["observado_s"] for r in group]
            q75 = quantiles(times, n=4, method="inclusive")[2]
            low = quantiles([r["o2_pct"] for r in group], n=4, method="inclusive")[0]
            for r in group:
                r["q75_duracion_s"] = q75
                r["q25_o2_pct"] = low
                r["duracion_larga"] = r["observado_s"] >= q75
                r["o2_bajo_relativo"] = r["o2_pct"] <= low
                r["revisar"] = r["duracion_larga"] and r["o2_bajo_relativo"]


def scatter(rows, out):
    fig, axes = plt.subplots(2, 3, figsize=(13.1, 7.4), sharex=True, sharey=True)
    for i, fuel in enumerate(FUELS):
        for j, gas in enumerate(GASES):
            ax = axes[i,j]
            subset = [r for r in rows if r["fuel"] == fuel and r["mezcla"] == gas]
            q, low = subset[0]["q75_duracion_s"], subset[0]["q25_o2_pct"]
            ax.fill_between([10, low], q, 43, color="#fff0e3", zorder=0)
            ax.axhline(q, color="#a67f65", ls=":", lw=1)
            ax.axvline(low, color="#a67f65", ls=":", lw=1)
            for end, (marker, color) in END.items():
                group = [r for r in subset if r["fin_ensayo"] == end]
                ax.scatter([r["o2_pct"] for r in group], [r["observado_s"] for r in group],
                           marker=marker, color=color, s=28, alpha=.78, linewidths=0)
            flags = [r for r in subset if r["revisar"]]
            ax.scatter([r["o2_pct"] for r in flags], [r["observado_s"] for r in flags],
                       facecolors="none", edgecolors="#ae3c15", s=103, lw=1.65)
            extremes = [min(subset,key=lambda r:r["observado_s"]), max(subset,key=lambda r:r["observado_s"])]
            for point in {r["prueba"]:r for r in [*extremes,*flags]}.values():
                ax.annotate(f"#{point['prueba']}", (point["o2_pct"], point["observado_s"]),
                            xytext=(7,-10) if point["revisar"] else (6,5),
                            textcoords="offset points", fontsize=8,
                            color="#ae3c15" if point["revisar"] else "#173043")
            ax.set_title(f"{FUELS[fuel]} · {gas}   n = {len(subset)}   |   revisar: {len(flags)}", loc="left", fontsize=11)
            ax.grid(alpha=.16)
            ax.set_xlim(10, 37)
            ax.set_ylim(-.7,43)
            ax.spines[["top","right"]].set_visible(False)
    fig.suptitle("FLEX · Duración y oxígeno por grupo de gas", x=.073, ha="left", y=.972, fontsize=20, fontweight="bold")
    fig.text(.073,.908, "Área naranja: duración ≥ cuartil superior y O₂ ≤ cuartil inferior del grupo. Círculo naranja: ensayo para revisar.",color="#34495c",fontsize=10.5)
    fig.supxlabel("Oxígeno inicial (% molar)", y=.14,fontsize=11)
    fig.supylabel("Duración registrada (s)", x=.022,fontsize=11)
    legend = [Line2D([], [], marker=shape, linestyle="none", color=color, label=desc)
              for (shape,color),desc in zip(END.values(), ("Extinción", "Disrupción", "Finalización"))]
    fig.legend(handles=legend,ncol=3,loc="lower center",bbox_to_anchor=(.5,.071),frameon=False)
    fig.text(.073,.038,"Fuente: NASA PSI-69. Ar y Xe no se identifican en el CSV FLEX. La selección es exploratoria y no delimita condiciones seguras.", fontsize=9,color="#34495c")
    fig.subplots_adjust(left=.073,right=.974,bottom=.214,top=.84,wspace=.14,hspace=.28)
    fig.savefig(out/"01_puntos_FLEX_por_gas.png",dpi=175)
    plt.close(fig)


def pares(rows):
    """Control y caso no se reutilizan en cada comparación gas-combustible."""
    result = []
    for fuel in FUELS:
        control = [r for r in rows if r["fuel"] == fuel and r["mezcla"] == GASES[0]]
        for gas in GASES[1:]:
            cases = [r for r in rows if r["fuel"] == fuel and r["mezcla"] == gas]
            candidatos = []
            for a in cases:
                for b in control:
                    dx = [abs(a[k]-b[k])/window for k,window in (("o2_pct",1),("presion_mmhg",25),("diametro_mm",.20))]
                    if max(dx) <= 1+1e-10:
                        candidatos.append((sum(e**2 for e in dx),a["prueba"],b["prueba"],a,b))
            used_a, used_b = set(), set()
            for _,ia,ib,a,b in sorted(candidatos,key=lambda c:c[:3]):
                if ia in used_a or ib in used_b:
                    continue
                used_a.add(ia); used_b.add(ib)
                result.append(dict(combustible=FUELS[fuel],mezcla=gas,ensayo_gas=ia,ensayo_base=ib,
                                   duracion_gas_s=a["observado_s"],duracion_base_s=b["observado_s"],
                                   diferencia_s=round(a["observado_s"]-b["observado_s"],6),
                                   o2_gas_pct=a["o2_pct"],o2_base_pct=b["o2_pct"],
                                   presion_gas_mmhg=a["presion_mmhg"],presion_base_mmhg=b["presion_mmhg"],
                                   diametro_gas_mm=a["diametro_mm"],diametro_base_mm=b["diametro_mm"],
                                   fin_gas=a["fin_ensayo"],fin_base=b["fin_ensayo"]))
    return result


def cup_burner(out):
    rows = [dict(gas=gas, estudio=LABS[i], agente_vol_pct=v) for gas, values in CUP.items()
            for i,v in enumerate(values) if v is not None]
    write_csv(out/"referencias_quemador_copa.csv",rows)
    fig,ax=plt.subplots(figsize=(11.2,5.7))
    for j,(gas, values) in enumerate(CUP.items()):
        v=[x for x in values if x is not None]
        if v:
            ax.hlines(j,min(v),max(v),color="#9ab5bd",linewidth=2)
            ax.text(max(v)+.9,j,f"{min(v):g}–{max(v):g} %",va="center",fontweight="bold",color="#173043")
        else:
            ax.text(17,j,"Sin medición comparable",va="center",color="#536572")
        for i,x in enumerate(values):
            if x is not None:
                ax.scatter(x,j+(i-2.5)*.057,s=47,color=plt.cm.tab10(i),marker="o" if i!=5 else "D",zorder=3)
    ax.set_yticks(range(len(CUP)),list(CUP)); ax.set_ylim(4.5,-.5)
    ax.set_xlim(16,50); ax.set_xlabel("Concentración de agente al extinguir (% vol.)")
    ax.grid(axis="x",alpha=.18); ax.spines[["top","right"]].set_visible(False)
    fig.suptitle("Extinción de n-heptano · Puntos por gas y estudio", x=.09, ha="left", y=.96, fontsize=18, fontweight="bold")
    fig.text(.09,.875,"Menor concentración = menos gas necesario en ese ensayo de quemador de copa.",fontsize=10.5,color="#34495c")
    handles=[Line2D([],[],color=plt.cm.tab10(i),marker="o" if i!=5 else "D",linestyle="none",label=l) for i,l in enumerate(LABS)]
    fig.legend(handles=handles,loc="lower center",bbox_to_anchor=(.5,.052),ncol=3,frameon=False,fontsize=9)
    fig.text(.09,.032,"Fuentes: Senecal tabla 2 y Pitts–Blevins tabla 1. Protocolos de copa; no mezclar con microgravedad.",fontsize=9,color="#34495c")
    fig.subplots_adjust(left=.09,right=.96,top=.81,bottom=.27)
    fig.savefig(out/"02_puntos_extincion_por_gas.png",dpi=175)
    plt.close(fig)


def simulation(out):
    gases = ["Xe", "Ar", "N₂", "He", "CO₂"]
    values = [5, 8, 11, 21, 21]
    write_csv(out/"referencias_oxigeno_modelado.csv",[
        {"gas":g,"oxigeno_limite_pct_aprox":v,"tipo":"simulación previa citada" if g=="N₂" else "simulación Alam et al."}
        for g,v in zip(gases,values)])
    fig,ax=plt.subplots(figsize=(10.6,5.45))
    for i,(g,v) in enumerate(zip(gases,values)):
        ax.scatter(v,i,s=85,marker="D" if g=="N₂" else "o",color="#876985" if g=="N₂" else "#146785")
        ax.text(v+.65,i,f"≈ {v} %"+(" · simulación previa" if g=="N₂" else ""),va="center",fontweight="bold",color="#173043")
    ax.set_yticks(range(5),gases); ax.set_ylim(4.5,-.5); ax.set_xlim(0,28)
    ax.set_xlabel("Índice límite de oxígeno modelado (% molar de O₂)")
    ax.grid(axis="x",alpha=.18); ax.spines[["top","right"]].set_visible(False)
    fig.suptitle("Umbral modelado de combustión de una gota de metanol", x=.09,ha="left",y=.96,fontsize=17,fontweight="bold")
    fig.text(.09,.87,"Gota inicial de 1.5 mm, 1 atm · Menor valor: la llama modelada persiste con menos O₂.",fontsize=10,color="#34495c")
    fig.text(.09,.046,"Fuente: Alam, Dryer y Farouk (2016), fig. 4. Resultados simulados; no son límites de ignición ni datos FLEX.",fontsize=9,color="#34495c")
    fig.subplots_adjust(left=.09,right=.95,top=.80,bottom=.18)
    fig.savefig(out/"03_puntos_argon_xenon_simulacion.png",dpi=175)
    plt.close(fig)


def matched_scatter(rows, out):
    fig, axes=plt.subplots(1,2,figsize=(12,4.9),sharex=True)
    for ax,fuel in zip(axes,FUELS.values()):
        ax.axvline(0,color="#637382",ls="--")
        for i,gas in enumerate(GASES[1:]):
            values=sorted(r["diferencia_s"] for r in rows if r["combustible"]==fuel and r["mezcla"]==gas)
            yy=[i+((j*7)%11-5)*.035 for j in range(len(values))]
            ax.scatter(values,yy,s=34,color="#277386",alpha=.8)
            if values:
                ax.scatter([median(values)],[i],s=76,color="#a54416",marker="D")
                ax.text(.035, .92-i*.48,f"n = {len(values)} · Mediana: {median(values):+.2f} s",
                        transform=ax.transAxes,fontsize=9,color="#34495c")
        ax.set_yticks([0,1],["CO₂","He"]);ax.set_ylim(1.5,-.5)
        ax.set_title(fuel,loc="left",fontweight="bold");ax.grid(axis="x",alpha=.2)
        ax.spines[["top","right"]].set_visible(False)
    fig.suptitle("FLEX · Diferencias de duración en pares comparables",x=.08,y=.97,ha="left",fontsize=18,fontweight="bold")
    fig.text(.08,.87,"Cada punto compara dos ensayos del mismo combustible. El rombo es la mediana.",fontsize=10,color="#34495c")
    fig.supxlabel("Duración con CO₂ o He menos duración con O₂/N₂ (s)",y=.12,fontsize=11)
    fig.text(.08,.055,"Pares: O₂ ±1 punto porcentual, presión ±25 mmHg y diámetro ±0.20 mm. Comparación exploratoria, sin efecto causal.",fontsize=9,color="#34495c")
    fig.subplots_adjust(left=.08,right=.97,top=.78,bottom=.23,wspace=.19)
    fig.savefig(out/"04_comparacion_por_pares_FLEX.png",dpi=175)
    plt.close(fig)


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--input",required=True,type=Path)
    cli.add_argument("--output",type=Path,default=Path(__file__).resolve().parent)
    args=cli.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    rows=load(args.input)
    annotate_groups(rows)
    cols=("prueba","identificador","fecha","fuel","mezcla","presion_mmhg","o2_pct","diametro_mm",
          "observado_s","fin_ensayo","q75_duracion_s","q25_o2_pct","duracion_larga","o2_bajo_relativo","revisar")
    write_csv(args.output/"puntos_FLEX.csv", [{key:r[key] for key in cols} for r in rows])
    flagged=[r for r in rows if r["revisar"]]
    write_csv(args.output/"puntos_para_revision.csv",[{key:r[key] for key in cols}
              for r in sorted(flagged,key=lambda r:r["observado_s"],reverse=True)])
    matched=pares(rows)
    write_csv(args.output/"pares_exploratorios.csv",matched)
    scatter(rows,args.output)
    cup_burner(args.output)
    simulation(args.output)
    matched_scatter(matched,args.output)
    print("Ensayos:",len(rows),"Marcados:",len(flagged),
          ascii(dict(Counter((r["fuel"],r["mezcla"]) for r in flagged))))
    for fuel in FUELS.values():
        for gas in GASES[1:]:
            vals=[r["diferencia_s"] for r in matched if r["combustible"]==fuel and r["mezcla"]==gas]
            print(fuel,ascii(gas),"pares:",len(vals),"mediana:",median(vals) if vals else None)


if __name__=="__main__":
    main()
