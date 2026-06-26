from flask import Flask, request, jsonify
import uuid
import ollama
import json
import os

from fonctions.performances import *
app = Flask(__name__)

client = ollama.Client(host='http://ollama:11434')

############# main #############


@app.route('/api/compile', methods=['POST'], strict_slashes=False)
@app.route('/compile', methods=['POST'], strict_slashes=False)
def compile_code():
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


        #  Requête à l'IA
        prompt_sys = """
            Tu es un expert en infrastructure LLVM.

            RÈGLES DE FORMATAGE JSON :
            1. Tu dois répondre avec un objet JSON valide.
            2. Le JSON contient 3 listes de même longueur : "liste_c", "liste_ll", "liste_explication".

            STRUCTURE INTERNE :
            - "liste_c" : [Chaîne] La ligne de code C originale. Si c'est pour des métadonnées globales, utilise "".
            - "liste_ll" : [[Chaîne]] Une liste de tableaux. Chaque tableau contient les instructions IR liées à la ligne C.
            - "liste_explication" : [[Chaîne]] Une liste de tableaux. Chaque tableau contient les explications correspondant 1-pour-1 aux instructions de liste_ll.

            RÈGLES D'ALIGNEMENT :
            - L'instruction liste_ll[i][j] doit avoir son explication à liste_explication[i][j].
            - Si une ligne C n'a pas d'équivalent IR (ex: une accolade seule), liste_ll[i] et liste_explication[i] doivent être des tableaux vides [].

            EXEMPLE TYPE :
            {
                "liste_c": ["", "int main() {",""],
                "liste_ll": [
                    ["target triple = \\"x86_64\\"", "!0 = !{i32 1, !\\"wchar_size\\", i32 4}"],
                    ["define i32 @main() {"],
                    ["attributes #0 = { noinline nounwind optnone uwtable .."],
                    ["!llvm.module.flags = !{!0, !1, !2, !3, !4}"],
                    ["!5 = !{!"Debian clang version 14.0.6"}"]
                ],
                "liste_explication": [
                    ["Définit l'architecture cible", "Définit la taille du type wchar_t à 4 octets"],
                    ["Début de la fonction principale"],
                    ["noinline : Interdit au compilateur d'insérer le code de cette fonction directement dans l'appelant (inlining)etnounwind : Indique que la fonction ne lancera jamais d'exception"],
                    ["les fichiers sont compatibles entre eux."],
                    [" C'est simplement la "signature" du compilateur qui a généré ce fichier. Ici, c'est la version de Clang fournie avec Debian 11/12."]
                ]
            }

            CONSIGNES DE SÉCURITÉ JSON :
                - Chaque chaîne de caractères doit être sur une SEULE ligne (pas de vrais retours à la ligne).
                - TRÈS IMPORTANT : Tous les guillemets doubles à l'intérieur des instructions LLVM doivent être échappés avec un triple backslash pour le JSON (ex: \\\" ).
                - N'inclus jamais de texte ou d'explications en dehors de l'objet JSON.

        """
        
        # Démarrage des monitors
        gpu_proc, gpu_lines, gpu_thread = start_gpu_monitor()

        reponse = client.chat(
            model="deepseek-r1:14b",
            messages=[
                {"role": "system", "content": prompt_sys},
                {"role": "user", "content": f"Voici le code C :\n{code}\nVoici le code LLVM IR :\n{llvm0}"}
            ],
            options={
                "temperature": 0.2,
                "num_ctx": 9000  
            }
        )
        
        
        # Arrêt et collecte
        gpu_stats  = stop_gpu_monitor(gpu_proc, gpu_lines, gpu_thread)
        # Métriques Ollama natives
        perf_ia = {
            "inference_total_ms":  reponse.get("total_duration", 0)      / 1e6,
            "prompt_eval_ms":      reponse.get("prompt_eval_duration", 0) / 1e6,
            "generation_ms":       reponse.get("eval_duration", 0)        / 1e6,
            "tokens_generated":    reponse.get("eval_count", 0),
            "tokens_per_sec":      round(
                reponse.get("eval_count", 0) /
                max(reponse.get("eval_duration", 1) / 1e9, 1e-9), 2
            ),
            "gpu": gpu_stats
        }
        
        
        content = reponse['message']['content']
        clean_json = content.replace("```json", "").replace("```", "").strip()

        # JSON pour transmettr les données
        donnees_ia = json.loads(clean_json)
        
        return jsonify({
            "status": "success", 
            "perf_ia": perf_ia,
            "liste_c": donnees_ia.get("liste_c", []),
            "optimisations" :{
                "00": 
                {
                    "liste_ll": donnees_ia.get("liste_ll", []),
                    "liste_explication": donnees_ia.get("liste_explication", []),
                    "liste_passes": passes0,
                    "liste_diffs": diffs0,
                    "perf": perf0
                },
                "01" : {
                    "liste_ll": [[line] for line in llvm1.split('\n')] if llvm1 else [],
                    "liste_explication" : [""],
                    "liste_passes": passes1,
                    "liste_diffs": diffs1,
                    "perf": perf1
                },
                "02" : {
                    "liste_ll": [[line] for line in llvm2.split('\n')] if llvm2 else [],
                    "liste_explication": [""],
                    "liste_passes": passes2,
                    "liste_diffs": diffs2,
                    "perf": perf2
                },
                "03" : {
                    "liste_ll": [[line] for line in llvm3.split('\n')] if llvm3 else [],
                    "liste_explication": [""],
                    "liste_passes": passes3,
                    "liste_diffs": diffs3,
                    "perf": perf3
                }
            }
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
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
                model="deepseek-r1:14b",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": f"Voici l'ancien code llvm-ir' :\n{llvm1}\n Voici le nouveau code llvm-ir :\n{llvm2}"}
                ],
                options={
                    "temperature": 0.2,
                    "num_ctx": 9000  
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