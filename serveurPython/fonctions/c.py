from fonctions.base import executer, difference_entre_passes
import os
from time import perf_counter
import subprocess
from pathlib import Path
#TODO : à revoir
import json
# à rectifier pas forcément nécessaire !


def genererLLVM(file_c, uid, opt):
    file_ll = f"temp_{uid}_O{opt}.ll"
    if opt < 0 : 
        print("erreur opt ne peut pas être négatif ")
    elif opt == 0 : 
        commande_bash = ["clang", file_c, "-emit-llvm", "-S", "-c", "-o", file_ll]
        res = executer(commande_bash)
    else : 
        commande_bash = ["clang", file_c, f"-O{opt}", "-emit-llvm", "-S", "-o", file_ll]
        res = executer(commande_bash)
    
    if res and hasattr(res, 'returncode') and res.returncode != 0:
        print(f"ERREUR CLANG O{opt} : {res.stderr}")
        return "", None

    if res and hasattr(res, 'returncode') and res.returncode == 0:
        if os.path.exists(file_ll):
            with open(file_ll, "r") as f:
                return f.read(), file_ll
                
    return "", None



def genererPasses(file_c, uid, opt):
    pass_dir = f"passes_{uid}_O{opt}"
    os.makedirs(pass_dir, exist_ok=True)
    commande_bash = ["clang", f"-O{opt}", "-mllvm", "-print-after-all", file_c, "-c", "-o", "/dev/null"]
    res = executer(commande_bash)

    listP = []
    listD = []
    perf = []

    leContenu, vieux_chemin = genererLLVM(file_c, uid, opt)
    listP.append(leContenu)

    if res and res.stderr:
        segments = res.stderr.split("*** IR Dump After")
        for i, segment in enumerate(segments[1:], 1):
            nomPasse = segment.split("***")[0].strip()
            chemin_actuel = os.path.join(pass_dir, f"pass_{i:02d}.ll")
            contenu = "*** IR Dump After" + segment

            with open(chemin_actuel, "w") as f:
                f.write(contenu)

            listP.append(contenu)

            if vieux_chemin:
                diff_res = difference_entre_passes(vieux_chemin, chemin_actuel)
                listD.append(diff_res)

            mesure = mesurePerf(chemin_actuel, f"{uid}_O{opt}_pass_{i:02d}")
            perf.append(mesure)
            vieux_chemin = chemin_actuel

    for f in Path(pass_dir).glob("*.ll"):
        f.unlink()
    os.rmdir(pass_dir)

    return listP, listD, perf


def mesurePerf(file_ll, uid):
    fichExecuter = f"exe_{uid}"
    pb =""
    with open(file_ll, "r") as f:
        leFich = f.read()
    
    lignes = leFich.splitlines(keepends=True)
    lignesOK = [l for l in lignes if not l.startswith("***")]
    contenuPropre = "".join(lignesOK)

    FichPropre = file_ll.replace(".ll", "_clean.ll")
    with open(FichPropre, "w") as f:
        f.write(contenuPropre)   
    
    try:


        commande_bash = ["clang", FichPropre, "-o", fichExecuter]
        res = subprocess.run(commande_bash, capture_output=True, check=True)
        if not res or res.returncode != 0:
            return res.stderr
        else :
            pb = res.stderr

        try:
            debut = perf_counter()
            subprocess.run([f"./{fichExecuter}"], capture_output=True, timeout=15)
            fin = perf_counter()
            return f"{round((fin - debut) * 1000, 5)} s"
        
        except Exception as e:
            return f"Erreur exécution : {str(e)}"
    
    except Exception as e:
        return f"Pb avec cmd bash : {str(e)} + : + {pb}"
    
    finally:
        if os.path.exists(FichPropre):
            os.remove(FichPropre)
        if os.path.exists(fichExecuter):
            os.remove(fichExecuter)


def traiterFenetres(client, code_c, llvm_complet, model_name):
    lignes_llvm = llvm_complet.split('\n')
    taille_fenetre = 30  
    
    resultat_global = {"liste_c": [], "liste_ll": [], "liste_explication": []}
    perf = {"tokens_generated": 0, "tokens_used": 0, "total_duration_ms": 0, "load_duration_ms": 0, 
            "prompt_eval_duration_ms": 0, "token_generation_duration_ms": 0, "eval_count": 0, "prompt_eval_count": 0}

    # Prompt unique et robuste pour tous les modèles
    prompt_sys = """Tu es un expert en infrastructure LLVM.
    Tu dois mapper du code C vers ses instructions LLVM IR.
    
    RÈGLES :
    1. Réponds UNIQUEMENT avec un objet JSON valide.
    2. Ne mets aucun texte avant ou après le JSON.
    3. Structure attendue :
    {
        "liste_c": ["ligne 1", "ligne 2"],
        "liste_ll": [["instruction A", "instruction B"], ["instruction C"]],
        "liste_explication": [["raison A", "raison B"], ["raison C"]]
    }"""

    for i in range(0, len(lignes_llvm), taille_fenetre):
        chunk_llvm = "\n".join(lignes_llvm[i:i + taille_fenetre])
        prompt_user = f"Code C source pour contexte :\n{code_c}\n\nAnalyse UNIQUEMENT ce segment LLVM (lignes {i} à {i+taille_fenetre}) :\n{chunk_llvm}"
        
        reponse = client.chat(
            model=model_name,
            # Supprimer format='json' ici pour laisser DeepSeek réfléchir (R1)
            messages=[
                {"role": "system", "content": prompt_sys},
                {"role": "user", "content": prompt_user}
            ],
            options={"temperature": 0.1, "num_ctx": 8192} # num_ctx augmenté pour DeepSeek
        )
        
        # Accumulation des perfs (inchangé)
        perf["total_duration_ms"] += reponse.get("total_duration", 0) / 1e6
        perf["tokens_generated"] += reponse.get("eval_count", 0)
        perf["tokens_used"] += reponse.get("prompt_eval_count", 0)
        
        # --- RÉCUPÉRATION ET NETTOYAGE CRITIQUE ---
        raw_content = reponse['message']['content']

        try:
            # 1. Supprimer le bloc de réflexion <think> de DeepSeek-R1
            if "</think>" in raw_content:
                raw_content = raw_content.split("</think>")[-1]

            # 2. Extraire uniquement la partie entre les premières et dernières accolades
            # Cela élimine les backticks ```json ou le texte parasite de Qwen
            debut = raw_content.find("{")
            fin = raw_content.rfind("}")
            
            if debut == -1 or fin == -1:
                raise ValueError("Aucun objet JSON trouvé dans la réponse")
                
            json_propre = raw_content[debut:fin+1]
            content = json.loads(json_propre)

            # 3. Insertion des données
            if "liste_c" in content:
                resultat_global["liste_c"].extend(content.get("liste_c", []))
                resultat_global["liste_ll"].extend(content.get("liste_ll", []))
                resultat_global["liste_explication"].extend(content.get("liste_explication", []))
            elif "analyse" in content: # Fallback pour certains modèles
                for item in content["analyse"]:
                    resultat_global["liste_c"].append(item.get("ligne_c", ""))
                    resultat_global["liste_ll"].append(item.get("instructions_ll", []))
                    resultat_global["liste_explication"].append(item.get("explications", []))

        except Exception as e:
            nb_lignes = len(chunk_llvm.splitlines())
            snippet = raw_content[:50].replace('\n', ' ')
            resultat_global["liste_c"].extend(["Erreur"] * nb_lignes)
            resultat_global["liste_ll"].extend([[f"Erreur parsing: {str(e)} | Début: {snippet}"]] * nb_lignes)
            resultat_global["liste_explication"].extend([[""]] * nb_lignes)

    return resultat_global, perf