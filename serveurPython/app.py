from flask import Flask, request, jsonify
import uuid
import ollama
import json
import os


from fonctions.performances import *
from db import insert_prompt

app = Flask(__name__)

client = ollama.Client(host='http://ollama:11434')
MODEL="mistral-small"
#MODEL == "deepseek-r1:14b"
#MODEL == "qwen2.5-coder:7b"
idM=0
############# main #############


@app.route('/api/compile', methods=['POST'], strict_slashes=False)
@app.route('/compile', methods=['POST'], strict_slashes=False)
def compile_code():
    listeC = []
    listeLLVM = []
    listeE = []
    uid = str(uuid.uuid4())

    fichSupp = []

    ## récup code 
    donnes = request.get_json()
    code = donnes.get('code', '')
    langage = donnes.get('lang', '') 
    if not code.strip() or langage not in ['c', 'cpp']:
        return jsonify({"status": "error", "message": "Le code est vide"})
    

    if langage == 'cpp':
        import fonctions.cpp as fct
        file_path = f"temp_{uid}.cpp"
    else:
        import fonctions.c as fct
        file_path = f"temp_{uid}.c"


    perf_ia = {}
    status=True
    try:
        with open(file_path, "w") as file:
            file.write(code)

        #0
        llvm0, path0 = fct.genererLLVM(file_path, uid, 0)
        passes0, diffs0,perf0 = fct.genererPasses(file_path, uid, 0)
        fichSupp.append(path0)

        #1
        llvm1, path1 = fct.genererLLVM(file_path, uid, 1)
        passes1, diffs1,perf1 = fct.genererPasses(file_path, uid, 1)
        fichSupp.append(path1)

        #2
        llvm2, path2 = fct.genererLLVM(file_path, uid, 2)
        passes2, diffs2,perf2 = fct.genererPasses(file_path, uid, 2)
        fichSupp.append(path2)

        #3
        llvm3, path3 = fct.genererLLVM(file_path, uid, 3)
        passes3, diffs3,perf3 = fct.genererPasses(file_path, uid, 3)
        fichSupp.append(path3)
    except Exception as e :
        print("pb avec la transi llvm")
###### V0

    ####### V1#######

    try:
        gpu_proc, gpu_lines, gpu_thread = start_gpu_monitor()

        donnees_ia, perfs_brutes = fct.traiterFenetres(client, code, llvm0, MODEL)
        
        gpu_stats = stop_gpu_monitor(gpu_proc, gpu_lines, gpu_thread)

        # Construction de l'objet de performance final
        perf_ia = {
            "done": True,
            "tokens_generated": perfs_brutes["tokens_generated"],
            "tokens_used": perfs_brutes["tokens_used"],
            "total_duration_ms": perfs_brutes["total_duration_ms"],
            "load_duration_ms": perfs_brutes["load_duration_ms"],
            "prompt_eval_duration_ms": perfs_brutes["prompt_eval_duration_ms"],
            "token_generation_duration_ms": perfs_brutes["token_generation_duration_ms"],
            "gpu": gpu_stats, 
        }

        if MODEL == "mistral-small":
            idM = 3
        elif MODEL == "deepseek-r1:14b":
            idM = 2
        else :
            idM = 1
        
        status = True
        
        return jsonify({
            "status": "success", 
            "perf_ia": perf_ia,
            "liste_c": donnees_ia.get("liste_c", []),
            "optimisations" :{
                "00": {
                    "liste_ll": donnees_ia.get("liste_ll", []),
                    "liste_explication": donnees_ia.get("liste_explication", []),
                    "liste_passes": passes0,
                    "liste_diffs": diffs0,
                    "perf": perf0
                },
                "01" : { "liste_ll": [[l] for l in llvm1.split('\n')], "liste_explication": [""], "liste_passes": passes1, "liste_diffs": diffs1, "perf": perf1 },
                "02" : { "liste_ll": [[l] for l in llvm2.split('\n')], "liste_explication": [""], "liste_passes": passes2, "liste_diffs": diffs2, "perf": perf2 },
                "03" : { "liste_ll": [[l] for l in llvm3.split('\n')], "liste_explication": [""], "liste_passes": passes3, "liste_diffs": diffs3, "perf": perf3 }
            }
        })
    except Exception as e:
        status=False
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        insert_prompt(
            perf_ia=perf_ia,
            modele_id= idM,
            status=status
        )
        for f in fichSupp:
            if f and os.path.exists(f): os.remove(f)

@app.route('/api/expliquer', methods=['POST'], strict_slashes=False)
@app.route('/expliquer', methods=['POST'], strict_slashes=False)
def expliquerDiffPass():
    donnees = request.get_json()
    llvm1 =  donnees.get('llvm1')
    llvm2 = donnees.get('llvm2')

    prompt = """Tu es un expert en infrastructure LLVM. Ton rôle est d'expliquer ce qui change entre 2 passes
    RÈGLES DE FORMATAGE :
        1. Renvoie un JSON valide 
        2. Ne mets pas de texte avant ou après le JSON

        STRUCTURE INTERNE :
        - explication : ""

    """

    try : 
        reponse = client.chat(
                model=MODEL,
                format='json',
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": f"Voici l'ancien code llvm-ir' :\n{llvm1}\n Voici le nouveau code llvm-ir :\n{llvm2}"}
                ],
                options={
                    "temperature": 0.2,
                    "num_ctx": 12000,
                    "num_predict": 4096  
                }
        )
        
        content = reponse['message']['content']
        clean_json = content.replace("```json", "").replace("```", "").strip()
        donnees_ia = json.loads(clean_json)

        return jsonify({
                "status": "success",
                "explication" : donnees_ia.get("explication","")
        })
    except Exception as e : 
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/test')
def test():
    return {"status": "ok"}, 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)