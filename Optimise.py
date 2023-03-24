try:
    # IMPORT DEFAULT LIBRARIES
    import json
    from datetime import datetime
    #import psutil
    import ast
    import sys
    import pickle
    import pandas as pd
    import numpy as np
    import geopandas as gpd
    pd.options.mode.chained_assignment = None  # default='warn'

    from pymoo.core.problem import ElementwiseProblem
    from pymoo.algorithms.moo.nsga2 import NSGA2
    from pymoo.operators.crossover.sbx import SBX
    from pymoo.operators.mutation.pm import PM
    from pymoo.operators.sampling.rnd import FloatRandomSampling
    from pymoo.core.population import Population
    from pymoo.core.individual import Individual
    from pymoo.termination import get_termination
    from pymoo.optimize import minimize
    from pymoo.util.ref_dirs import get_reference_directions

    # IMPORT COMPUTE AND SETUP FOR CLOUD USE
    import compute_rhino3d.Util
    import compute_rhino3d.Grasshopper as gh

    # IMPORT CUSTOM SCRIPTS
    from Utility import *
except:
    print('Error importing libraries')

try:
    siteGenerationOutput = json.loads(sys.argv[1])
    #siteGenerationOutput = json.load(open('sample_SiteGeneration_output.json'))
    #siteGenerationOutput = json.load(open('static\sample_input_anna_GPR.json'))
    OptimisationParameters = siteGenerationOutput[list(siteGenerationOutput.keys())[0]]['OptimisationParameters']
    ParameterRanges = siteGenerationOutput[list(siteGenerationOutput.keys())[0]]['ParameterRanges']
    XKeys = ['BKeyXScale', 'BKeyYScale', 'GridAngle', 'GridSpacing', 'ParcelStoreyScale']
    XTypes = ["System.Double","System.Double","System.Double","System.Double","System.Double"]
    FKeys = ['TotalViewObstruction','MeanEWAspectRatio']
except:
    print('Error during pre-optimisation')
try:
    archiveCombinedResults = []
    #archivePerformance = {'seconds':[],'available':[],'used':[],'free':[]}

    class Problem(ElementwiseProblem):
        def __init__(self):
            super().__init__(
                n_var=len(XKeys),
                n_obj=len(FKeys),
                n_constr=1,
                xl=np.array([[float(min),float(max)] for min,max in [ParameterRanges[xkey] for xkey in XKeys]]).transpose()[0],
                xu=np.array([[float(min),float(max)] for min,max in [ParameterRanges[xkey] for xkey in XKeys]]).transpose()[1]
                )

        def _evaluate(self, X, out, *args, **kwargs):
            startTime = datetime.datetime.now()
            raw_output = EvaluateGrasshopper(
                filename="static\gh\BuildingGeneration.ghx",
                X=[json.dumps(siteGenerationOutput)] + list(X),
                XKeys=['SiteGenerationJson'] + XKeys,
                XTypes=["System.String"] + XTypes,
                CloudCompute=True,
                ComputeURL="http://52.77.234.70:80/",
                ComputeKey='0hOfevzxs49OfbXDqyUx',
                Authtoken="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwIjoiUEtDUyM3IiwiYyI6IkFFU18yNTZfQ0JDIiwiYjY0aXYiOiJnUFNyTTc5N1ZlOEYyYUxPYW5qazRRPT0iLCJiNjRjdCI6InczNW1sQ011NTB3dU80Sy9vY2Z4ZzBGcHRkRzVPbVpZc3V0Q0FtZ1RYZDg1bEZwOXJWVXg3eFhUcjlwL2JCMkVaTWVGczl2UDNYM21NN1llQ3ZOVE1CdmNOMFZ2c0VBTE5UQVc5ODR1alM2QUhuZ3BKWjlhK0VYT2RDbEJJbmJOM0czMm5ab0Y0S3BhK0F4RWhJakM4UTBPSTlWNEJHdlloY3MrNHZnNExKUXBKa0JCYUc2RTVSYlYxcHZKUWRXQWtIUzhDbElCck5RN1BpZXJ6K1l1TFE9PSIsImlhdCI6MTYzMjMwMTUyOX0.nSvFFz6GPk_pcBx7pBFh---o-upDD1md34RWP9AZNOI"
                )
            buildingGenerationOutput = json.loads(json.loads(raw_output['values'][0]['InnerTree']['{0}'][0]['data']))

            raw_output = EvaluateGrasshopper(
                filename="static\gh\CombinedEvaluation.ghx",
                X=[json.dumps(siteGenerationOutput),json.dumps(buildingGenerationOutput)],
                XKeys=['SiteGenerationJson', 'BuildingGenerationJson'],
                XTypes=["System.String","System.String"],
                CloudCompute=True,
                ComputeURL="http://52.77.234.70:80/",
                ComputeKey='0hOfevzxs49OfbXDqyUx',
                Authtoken="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwIjoiUEtDUyM3IiwiYyI6IkFFU18yNTZfQ0JDIiwiYjY0aXYiOiJnUFNyTTc5N1ZlOEYyYUxPYW5qazRRPT0iLCJiNjRjdCI6InczNW1sQ011NTB3dU80Sy9vY2Z4ZzBGcHRkRzVPbVpZc3V0Q0FtZ1RYZDg1bEZwOXJWVXg3eFhUcjlwL2JCMkVaTWVGczl2UDNYM21NN1llQ3ZOVE1CdmNOMFZ2c0VBTE5UQVc5ODR1alM2QUhuZ3BKWjlhK0VYT2RDbEJJbmJOM0czMm5ab0Y0S3BhK0F4RWhJakM4UTBPSTlWNEJHdlloY3MrNHZnNExKUXBKa0JCYUc2RTVSYlYxcHZKUWRXQWtIUzhDbElCck5RN1BpZXJ6K1l1TFE9PSIsImlhdCI6MTYzMjMwMTUyOX0.nSvFFz6GPk_pcBx7pBFh---o-upDD1md34RWP9AZNOI"
                )
            combinedEvaluationOutput = json.loads(json.loads(raw_output['values'][0]['InnerTree']['{0}'][0]['data']))
            F = [combinedEvaluationOutput['Objectives'][fkey]['score'] for fkey in FKeys]
            G = [combinedEvaluationOutput['ConstraintViolation']]   
            if F == [None,None]:
                F = [99999,99999]
            
            endTime = datetime.datetime.now()
            archiveDict = {}
            
            for d,key in zip(list(X) + F + G,XKeys + FKeys + ['ConstraintViolation']):
                archiveDict.update({key:d})
            archiveDict.update({'Evaluation':combinedEvaluationOutput})
            archiveCombinedResults.append(archiveDict)

            '''
            deltaTime = endTime-startTime
            archivePerformance['seconds'].append(deltaTime.seconds + deltaTime.microseconds/1000000)
            archivePerformance['available'].append(psutil.virtual_memory().available)
            archivePerformance['used'].append(psutil.virtual_memory().used)
            archivePerformance['free'].append(psutil.virtual_memory().free)
            '''

            out["F"] = F
            out["G"] = G

    MyProblem = Problem()

    MyAlgorithm = NSGA2(
        pop_size=int(OptimisationParameters['PopulationCount']),
        eliminate_duplicates=False,
        sampling = FloatRandomSampling(),
        crossover=SBX(prob=float(OptimisationParameters['CrossOverRate']), eta=15),
        mutation=PM(prob=float(OptimisationParameters['MutationRate']), eta=20),
    )

    MyTermination = get_termination("n_gen", int(OptimisationParameters['GenerationCount']))

    res = minimize(
        problem = MyProblem, 
        algorithm = MyAlgorithm, 
        termination = MyTermination,
        seed=1,
        save_history=True, 
        verbose = False)
except Exception as e:
    print('Error during optimisation:',e)

try:
    df = ReadResults(res)
    df.columns = ['Gen','Pop'] + XKeys + FKeys + ['CV']
except:
    print('Error in optimisation output')

try:
    for i,row in df.iterrows():
        for j, evalrow in enumerate(archiveCombinedResults):
            if [evalrow[x] for x in XKeys] == row[XKeys].to_list():
                modeldict = {}         
                for key in evalrow['Evaluation']['Objectives']:
                    modeldict[key] = evalrow['Evaluation']['Objectives'][key]['mesh']
                if any([ms == None for ms in list(modeldict.values())]):
                    df.loc[i,'Model'] = None
                else:
                    df.loc[i,'Model'] = json.dumps(modeldict)

except:
    print('Error in mapping mesh results to optimisation df:')

try:
    pdf =  GetParetoDF(df, FKeys, MinParetoSolutions=5)
    pdf = pdf.reset_index()
    #pdf.transpose().to_json('sample_pareto_output.json')
    #print('Python optimsiation successful')
    print(pdf.to_json())
except:
    print('Error in computing pareto df')