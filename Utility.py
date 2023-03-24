import sys
sys.path.append(".")
import os
import copy
import rhino3dm
import datetime
import pymoo
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import random
import pickle
import matplotlib as mpl
import base64
import compute_rhino3d.Util
import requests
import json

from pymoo.algorithms.moo.nsga2 import NSGA2
from pymoo.core.problem import ElementwiseProblem
from pymoo.optimize import minimize
from pymoo.factory import get_sampling, get_crossover, get_mutation, get_termination, get_problem, get_performance_indicator
from pymoo.util.misc import stack
from pymoo.indicators.hv import Hypervolume
from pymoo.util.running_metric import RunningMetric

def Parameterbounds(X,P):
    lower = [round(float(x*(1-(P/2))),3) for x in X]
    upper = [round(float(x*(1+(P/2))),3) for x in X]

    if upper[3]  > 1.0:
        lower[3] -= upper[3] - 1.0
        upper[3] = 1.0

    if upper[4] > 0.5:
        lower[4] -= upper[4] - 0.5
        upper[4] = 0.5

    return lower,upper

def Remap(OldValue, OldMin, OldMax):
    OldRange = (OldMax - OldMin)  
    NewRange = 1 
    return (((OldValue - OldMin) * NewRange) / OldRange)

def func_pf(flatten=True, **kwargs):
        f1_a = np.linspace(0.1**2, 0.4**2, 100)
        f2_a = (np.sqrt(f1_a) - 1)**2

        f1_b = np.linspace(0.6**2, 0.9**2, 100)
        f2_b = (np.sqrt(f1_b) - 1)**2

        a, b = np.column_stack([f1_a, f2_a]), np.column_stack([f1_b, f2_b])
        return stack(a, b, flatten=flatten)

def func_ps(flatten=True, **kwargs):
        x1_a = np.linspace(0.1, 0.4, 50)
        x1_b = np.linspace(0.6, 0.9, 50)
        x2 = np.zeros(50)

        a, b = np.column_stack([x1_a, x2]), np.column_stack([x1_b, x2])
        return stack(a,b, flatten=flatten)

def PrintResult(res, export = False):

    try:
        dfs = []
        for generation,data in enumerate(res.history):

            if len(np.array(data.result().X).shape) == 1:
                arr = np.concatenate(([data.result().X],[data.result().F]),axis=1)
            else:
                arr = np.concatenate((data.result().X,data.result().F),axis=1)

            labels = ['Length/mm','Depth/mm','Height/mm','Span/%','Leg/%','Gap/%','CapMat','LegMat','Waste/%','VolRatio/%','TotalDisp/cm','EmbCarbon/KgCO2e']
            df = pd.DataFrame(arr, columns = labels)
            df.reset_index(level=0, inplace=True)
            df.insert(0, 'Gen', [generation]*df.shape[0])
            dfs.append(df)
        df = pd.concat(dfs,ignore_index=True)

        time = str(datetime.datetime.now().strftime("%Y-%m-%d %H-%M-%S")) 
        with pd.option_context('display.max_rows',10):
            print('\n\n')
            pd.set_option('display.max_columns', None)
            print(df)
        if export:
            pd.DataFrame(df).to_csv(time + ".csv")

    except Exception as e: 
        print('error: {0}'.format(e))
    return

def ExtractHistory(res):
    hist = res.history
    n_evals = []             # corresponding number of function evaluations\
    hist_F = []              # the objective space values in each generation
    hist_cv = []             # constraint violation in each generation
    hist_cv_avg = []         # average constraint violation in the whole population

    for algo in hist:

        # store the number of function evaluations
        n_evals.append(algo.evaluator.n_eval)

        # retrieve the optimum from the algorithm
        opt = algo.opt

        # store the least contraint violation and the average in each population
        hist_cv.append(opt.get("CV").min())
        hist_cv_avg.append(algo.pop.get("CV").mean())

        # filter out only the feasible and append and objective space values
        feas = np.where(opt.get("feasible"))[0]
        hist_F.append(opt.get("F")[feas])
    return n_evals,hist_F,hist_cv,hist_cv_avg

def PlotHypervolume(res, prefix):
    n_evals,hist_F,hist_cv,hist_cv_avg = ExtractHistory(res)
    X, F = res.opt.get("X", "F")
    approx_ideal = F.min(axis=0)
    approx_nadir = F.max(axis=0)

    metric = Hypervolume(ref_point= np.array([10]*len(F[0])),
                     norm_ref_point=False,
                     zero_to_one=True,
                     ideal=approx_ideal,
                     nadir=approx_nadir)
    hv = [metric.do(_F) for _F in hist_F]

    plt.figure(figsize=(7, 5))
    plt.plot(n_evals, hv,  color='black', lw=0.7, label="Avg. CV of Pop")
    plt.scatter(n_evals, hv,  facecolor="none", edgecolor='black', marker="p")
    plt.title("Convergence")
    plt.xlabel("Function Evaluations")
    plt.ylabel("Hypervolume")
    plt.savefig(prefix + ' Hypervolume convergence.png')
    return

def SaveResult(res, filename = None):
    if filename:
        fn = filename + '.pickle'
    else:
        fn = '{0}.pickle',format(str(datetime.datetime.now().strftime("%Y-%m-%d %H-%M-%S")))
    try:
        with open(fn,'wb') as f:
            pickle.dump(res,f,protocol=pickle.HIGHEST_PROTOCOL)
    except Exception as ex:
        print("Error during pickling object (Possibly unsupported):", ex)
 
def LoadResult(filename):

    try:
        with open(filename + '.pickle', "rb") as f:
            return pickle.load(f)
    except Exception as ex:
        print("Error during unpickling object (Possibly unsupported):", ex)

def ReadResults(res):
    arr = []
    for generation, population in enumerate(res.history):
        for index, individual in enumerate(res.history[generation].pop):
            arr.append([generation, index] + list(individual.X) + list(individual.F) + list(individual.G))
    df = pd.DataFrame(arr)
    return df

def PlotPairwise(df, basemap, fig_size, label_size, tick_size, marker_size):
    variable_count = len(df.columns)
    fig, axs = plt.subplots(variable_count, variable_count, figsize=(fig_size,fig_size))

    fig.tight_layout()
    plt.subplots_adjust(left = 0.1, right = 0.9, top = 0.9, bottom = 0.1)

    offdiagonal_indicies = [[i,j] for i in range(variable_count-1) for j in range(variable_count-1-i)]
    gen_count = int(max(list(basemap)) + 1)
    norm = mpl.colors.Normalize(vmin = 0, vmax = gen_count)

    for i in range(variable_count):
        for j in range(variable_count):
            ax_y = variable_count-j-1
            ax_x = i
            ax = axs[ax_y,ax_x]
            ax.set_xlabel(df.columns[ax_x], fontsize = label_size)
            ax.set_ylabel(df.columns[ax_y], fontsize = label_size)


            if [i,j] in offdiagonal_indicies:

                ax.scatter(x = df.iloc[:,ax_x], y = df.iloc[:,ax_y], c = basemap , cmap = 'Blues', s=marker_size)
                
                ax.tick_params(axis='both', labelsize = tick_size)


                if ax_x != 0:
                    ax.sharey(axs[0,ax_y])
                    ax.set_ylabel(None)
                if ax_y != variable_count-1:
                    ax.sharex(axs[ax_x,variable_count-1])
                    ax.set_xlabel(None)
            
            elif ax_x==ax_y:
                
                
                hist_arr = [[] for i in range(gen_count)]
                for row in range(df.shape[0]):
                    hist_arr[int(basemap.iloc[row])].append(df.iloc[row,ax_x])
                
                
                colors = [mpl.cm.Blues(norm(x)) for x in range(gen_count)]
                
                ax.hist(hist_arr, color = colors, histtype = 'barstacked')
                ax.tick_params(axis='both', labelsize = tick_size)
                ax.set_ylabel(None)
                if ax_y != variable_count-1:
                    ax.set_xlabel(None)

                if ax_y == variable_count-1:
                    ax.set_xlabel(df.columns[ax_x])
            
            else:
                ax.axis('off')

    plt.colorbar(mpl.cm.ScalarMappable(norm=norm, cmap='Blues'), label = 'Generation', ax = axs[0,variable_count-1], orientation = 'horizontal')
    return fig,axs

def PlotSingleObj(df):
    fig, ax = plt.subplots(1,1)
    ax.scatter(y = df['WeightedObj'], x = df['Gen'], s = 10)
    ax.set_xlabel('Generation')
    ax.set_ylabel('WeightedObj')
    return fig, ax


def PlotRunningMetric(res, prefix):
    filename = "{0}\{1} Running Metric.png".format(os.getcwd(),prefix)
    g_count = len(res.history)
    running = RunningMetric(delta_gen=int(g_count/10),
                            n_plots=10,
                            only_if_n_plots=True,
                            key_press=False,
                            do_show=False,
                            filename = filename
                            )

    for algorithm in res.history:
        running.notify(algorithm)

def NormalizeDF(df):    
    arr = df.to_numpy().transpose().copy()
    #print("Normalizing DF using ranges:")
    for i,row in enumerate(arr):
        #print(row.min(), row.max())
        arr[i] = np.interp(row, (row.min(), row.max()), (0,1))
    return pd.DataFrame(arr.transpose(),columns = df.columns)


def DeNormalizeDF(df,refdf):
    arr = df.to_numpy().transpose()
    refarr = refdf.to_numpy().transpose()
    print("DeNormalizing DF using ranges:")
    for i in range(len(arr)):
        arr[i] = np.interp(arr[i], (0,1), (refarr[i].min(),refarr[i].max()))
        print(refarr[i].min(),refarr[i].max())
    return pd.DataFrame(arr.transpose(),columns = df.columns)

def EvaluateGrasshopper(filename,X,XKeys,XTypes,CloudCompute = False,ComputeURL=None,ComputeKey=None,Authtoken=None):
    if CloudCompute:
        compute_rhino3d.Util.url = ComputeURL
        compute_rhino3d.Util.apiKey = ComputeKey

    else:
        compute_rhino3d.Util.authToken = Authtoken
        compute_rhino3d.Util.url = "http://localhost:8081/"
    
    gh_data = open(filename, mode="r", encoding="utf-8-sig").read()
    decoded = base64.b64encode(gh_data.encode("utf-8")).decode("utf-8")
    myjson = {
        "algo": decoded,
        "pointer": None,
        "values":[]
        }
    for x,xkey,xtype in zip(X,XKeys,XTypes):
        myjson['values'].append({
            "ParamName": "RH_IN:" + xkey,
                "InnerTree": {
                    "{ 0; }": [
                        {
                            "type": xtype,
                            "data": x
                        }
                    ]
                }
        })

    response = requests.post(
        url=compute_rhino3d.Util.url + "grasshopper", 
        headers={"RhinoComputeKey" : ComputeKey},
        json=myjson
        )
    return json.loads(response.content.decode("utf-8"))

def is_pareto_efficient(costs):
    """
    Find the pareto-efficient points
    :param costs: An (n_points, n_costs) array
    :return: A (n_points, ) boolean array, indicating whether each point is Pareto efficient
    """
    is_efficient = np.ones(costs.shape[0], dtype = bool)
    for i, c in enumerate(costs):
        if is_efficient[i]:
            is_efficient[is_efficient] = np.any(costs[is_efficient]<c, axis=1)  # Keep any point with a lower cost
            is_efficient[i] = True  # And keep self
    return is_efficient

def GetParetoDF(df, FKeys, MinParetoSolutions):
    PD = 0
    pdf = pd.DataFrame([])
    copydf = df.copy()
    while pdf.shape[0] < MinParetoSolutions:
        boollist = is_pareto_efficient(copydf[FKeys].to_numpy())
        ndf = copydf.loc[boollist,:]
        ndf['PD'] = PD
        pdf = pd.concat([pdf,ndf],axis=0)
        copydf = copydf.loc[[not elem for elem in boollist],:]
        PD += 1
    return pdf 