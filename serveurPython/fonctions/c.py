from fonctions.base import executer, difference_entre_passes
import os
from time import perf_counter
import subprocess
from pathlib import Path
#TODO : à revoir
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
        res = executer(commande_bash)

        if not res or res.returncode != 0:
            return "inexécutable"

        try:
            debut = perf_counter()
            subprocess.run([f"./{fichExecuter}"], capture_output=True, timeout=10)
            fin = perf_counter()
            return f"{round((fin - debut) * 1000, 5)}"
        
        except Exception as e:
            return f"Erreur exécution : {str(e)}"
    
    except Exception as e:
        return f"Pb avec cmd bash : {str(e)}"
    
    finally:
        if os.path.exists(FichPropre):
            os.remove(FichPropre)
        if os.path.exists(fichExecuter):
            os.remove(fichExecuter)