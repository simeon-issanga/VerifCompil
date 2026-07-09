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
    
    resultat_global = {
        "liste_c": [],
        "liste_ll": [],
        "liste_explication": []
    }
    
    perf = {
        "tokens_generated": 0,
        "tokens_used": 0,
        "total_duration_ms": 0,
        "load_duration_ms": 0,
        "prompt_eval_duration_ms": 0,
        "token_generation_duration_ms": 0,
        "eval_count": 0,
        "prompt_eval_count": 0
    }

    if model_name == "mistral-small":

        prompt_sys ="""

            Tu es un expert en infrastructure LLVM.

            Tu dois répondre avec un objet JSON valide contenant EXACTEMENT ces 3 clés :
            1. "liste_c": [Chaîne] (La ligne C)
            2. "liste_ll": [[Chaîne]] (Les instructions LLVM correspondantes)
            3. "liste_explication": [[Chaîne]] (Les explications correspondantes)

            IMPOORTANT : NE FAIS PAS de commentaires avant ou après le JSON.
            
            Chaque entrée des listes doit correspondre à l'index des autres.
        """
    elif model_name == "deepseek-r1:14b":
        prompt_sys = """Tu es un expert en infrastructure LLVM. 
        Ton rôle est de mapper précisément du code C vers ses instructions LLVM IR.

        CONSIGNE STRICTE :
        1. Tu dois répondre EXCLUSIVEMENT avec un objet JSON valide.
        2. Ne mets aucun texte, avertissement ou commentaire avant ou après le bloc JSON.
        3. Respecte scrupuleusement cette structure :

        {
            "liste_c": ["ligne de code C"],
            "liste_ll": [["instruction LLVM 1", "instruction LLVM 2"]],
            "liste_explication": [["explication 1", "explication 2"]]
        }

        DÉTAILS DES CLÉS :
        - "liste_c" : Une liste de chaînes (chaque élément est une ligne du code C original).
        - "liste_ll" : Une liste de listes (chaque sous-liste contient les instructions LLVM IR correspondant à la ligne C).
        - "liste_explication" : Une liste de listes (chaque sous-liste contient les explications techniques pour chaque instruction LLVM).

        IMPORTANT : Les index des trois listes doivent être parfaitement synchronisés (la ligne C à l'index 0 doit correspondre aux instructions à l'index 0 de liste_ll).
        """

    else : 
        prompt_sys = """You are a specialized LLVM IR expert. 
        Your task is to map C code lines to their corresponding LLVM IR instructions.

        ### RULES:
        1. Return ONLY a valid JSON object.
        2. No conversational text, no markdown code blocks (no ```json).
        3. Ensure a 1:1 mapping between the indices of the three lists.

        ### JSON STRUCTURE:
        {
            "liste_c": ["C line"],
            "liste_ll": [["llvm_inst_1", "llvm_inst_2"]],
            "liste_explication": [["explanation_1", "explanation_2"]]
        }

        ### CONSTRAINTS:
        - "liste_c": Array of strings (the C source lines).
        - "liste_ll": Array of arrays (each sub-array contains the LLVM instructions for that C line).
        - "liste_explication": Array of arrays (each sub-array contains technical explanations).
        
        If a C line has no corresponding LLVM instructions in the provided chunk, return an empty list [] for that index in "liste_ll".
        """

    for i in range(0, len(lignes_llvm), taille_fenetre):
        chunk_llvm = "\n".join(lignes_llvm[i:i + taille_fenetre])
        
        prompt_user = f"Voici le code C complet pour contexte :\n{code_c}\n\nAnalyse UNIQUEMENT ce segment LLVM (lignes {i} à {i+taille_fenetre}) :\n{chunk_llvm}"
        
        reponse = client.chat(
            model=model_name,
            format='json', 
            messages=[
                {"role": "system", "content": prompt_sys},
                {"role": "user", "content": prompt_user}
            ],
            options={"temperature": 0.1, "num_ctx": 4096}
        )
        
        # 1. Accumuler les perfs
        perf["total_duration_ms"] += reponse.get("total_duration", 0) / 1e6
        perf["load_duration_ms"] += reponse.get("load_duration", 0) / 1e6
        perf["prompt_eval_duration_ms"] += reponse.get("prompt_eval_duration", 0) / 1e6
        perf["token_generation_duration_ms"] += reponse.get("eval_duration", 0) / 1e6
        perf["tokens_generated"] += reponse.get("eval_count", 0)
        perf["tokens_used"] += reponse.get("prompt_eval_count", 0)
        perf["eval_count"] += reponse.get("eval_count", 0)
        perf["prompt_eval_count"] += reponse.get("prompt_eval_count", 0)
        
        try:
            content = json.loads(reponse['message']['content'])
            
            if "analyse" in content:
                for item in content["analyse"]:
                    resultat_global["liste_c"].append(item.get("ligne_c", ""))
                    resultat_global["liste_ll"].append(item.get("instructions_ll", []))
                    resultat_global["liste_explication"].append(item.get("explications", []))
            else:
                # Format standard attendu
                resultat_global["liste_c"].extend(content.get("liste_c", []))
                resultat_global["liste_ll"].extend(content.get("liste_ll", []))
                resultat_global["liste_explication"].extend(content.get("liste_explication", []))
        except Exception as e:
            
            nb_lignes = len(chunk_llvm.splitlines())
            # On récupère les 100 premiers caractères de la réponse pour comprendre
            raw_text = reponse['message']['content'][:100].replace('\n', ' ')
            
            resultat_global["liste_c"].extend(["Erreur"] * nb_lignes)
            # On affiche l'erreur Python + un aperçu de ce que l'IA a dit
            resultat_global["liste_ll"].extend([[f"Erreur: {str(e)} | IA a dit: {raw_text}..."]] * nb_lignes)
            resultat_global["liste_explication"].extend([[""]] * nb_lignes)

    return resultat_global, perf