from flask import Flask, request, jsonify
import subprocess
from pathlib import Path
import os
import json
import uuid
import ollama

app = Flask(__name__)

client = ollama.Client(host='http://ollama:11434')

def executer(commande, timeout=15):
    try:
        res = subprocess.run(commande, capture_output=True, text=True, timeout=timeout)
        return res
    except subprocess.TimeoutExpired:
        return None
    except Exception as e:
        return str(e)

def genererLLVM(file_c, uid, opt):
    file_ll = f"temp_{uid}_O{opt}.ll"
    if opt < 0 : 
        print("erreur opt ne peut pas être négatif ")
    elif opt == 0 : 
        commande_bash = ["clang", file_c, "-emit-llvm", "-S", "-c", "-o", file_ll]
        res = executer(commande_bash)
    else : 
        commande_bash = ["clang", f"-O{opt}", "-disable-llvm-passes", "-emit-llvm", "-S", "-o", file_ll]
        res = executer(commande_bash)
    
    if res.returncode == 0:
        if os.path.exists(file_ll):
            with open(file_ll, "r") as f:
                return f.read(), file_ll
    return None, None # à revoire


def difference_entre_passes(file1, file2):
    commande_diff = ["diff", "-u", file1, file2]

    try:
        result = subprocess.run(commande_diff, capture_output=True, text=True)
        return result.stdout 
    except Exception as e:
        return f"Erreur diff : {str(e)}"


def genererPassesDif(file_c, uid, opt):
    pass_dir = f"passes_{uid}_O{opt}"
    os.makedirs(pass_dir, exist_ok=True)
    
    commande_bash = ["clang", f"-O{opt}", "-mllvm", "-print-after-all", file_c, "-c", "-o", "/dev/null"]
    res = executer(commande_bash)
    
    listP = []
    listD = []
    
    if res and res.stderr:
        segments = res.stderr.split("*** IR Dump After")
        vieux_chemin = None
        
        for i, segment in enumerate(segments[1:], 1):
            chemin_actuel = os.path.join(pass_dir, f"pass_{i:02d}.ll")
            contenu = "*** IR Dump After" + segment
            
            with open(chemin_actuel, "w") as f:
                f.write(contenu)
            listP.append(contenu)

            if vieux_chemin:
                diff_res = subprocess.run(["diff", "-u", vieux_chemin, chemin_actuel], capture_output=True, text=True)
                listD.append(diff_res.stdout)
            
            vieux_chemin = chemin_actuel

    for f in Path(pass_dir).glob("*.ll"): f.unlink()
    os.rmdir(pass_dir)
    
    return listP, listD

@app.route('/api/compile', methods=['POST'], strict_slashes=False)
@app.route('/compile', methods=['POST'], strict_slashes=False)
def compile_code():
    uid = str(uuid.uuid4())
    file_path = f"temp_{uid}.c"
    file_s = f"temp_{uid}.ll"
    fileTemp = f"file_temp_{uid}.ll"
    fichSupp = []

    try:

        ## récup code C
        donnes = request.get_json()
        code_c = donnes.get('code', '')
    
        if not code_c.strip():
            return jsonify({"status": "error", "message": "Le code est vide"})
        
        with open(file_path, "w") as file:
            file.write(code_c)

       #0
        llvm0, path0 = genererLLVM(file_c, uid, 0)
        passes0, diffs0 = genererPassesDif(file_c, uid, 0)
        fichSupp.append(path0)

        #1
        llvm1, path1 = genererLLVM(file_c, uid, 1)
        passes1, diffs1 = genererPassesDif(file_c, uid, 1)
        fichSupp.append(path1)

        #2
        llvm2, path2 = genererLLVM(file_c, uid, 2)
        passes2, diffs2 = genererPassesDif(file_c, uid, 2)
        fichSupp.append(path2)

        #3
        llvm3, path3 = genererLLVM(file_c, uid, 3)
        passes3, diffs3 = genererPassesDif(file_c, uid, 3)
        fichSupp.append(path3)


        #  Requête à l'IA
        prompt_sys = """
            Tu es un expert en infrastructure LLVM. Ton rôle est de mapper le code C avec le code LLVM IR de manière chirurgicale.

            RÈGLES DE FORMATAGE JSON :
            1. Tu dois répondre UNIQUEMENT avec un objet JSON valide.
            2. Le JSON contient 3 listes de même longueur : "liste_c", "liste_ll", "liste_explication".

            STRUCTURE INTERNE :
            - "liste_c" : [Chaîne] La ligne de code C originale. Si c'est pour des métadonnées globales, utilise "".
            - "liste_ll" : [[Chaîne]] Une liste de tableaux. Chaque tableau contient les instructions IR liées à la ligne C.
            - "liste_explication" : [[Chaîne]] Une liste de tableaux. Chaque tableau contient les explications correspondant 1-pour-1 aux instructions de liste_ll.

            RÈGLES D'ALIGNEMENT :
            - L'instruction liste_ll[i][j] doit avoir son explication à liste_explication[i][j].
            - Si une ligne C n'a pas d'équivalent IR (ex: une accolade seule), liste_ll[i] et liste_explication[i] doivent être des tableaux vides [].
            - Les métadonnées de début de fichier (!llvm.module.flags, target triple, etc.) doivent être regroupées à l'index 0 avec une explication pour CHAQUE ligne.

            EXEMPLE TYPE :
            {
                "liste_c": ["", "int main() {"],
                "liste_ll": [
                    ["target triple = \\"x86_64\\"", "!0 = !{i32 1, !\\"wchar_size\\", i32 4}"],
                    ["define i32 @main() {"]
                ],
                "liste_explication": [
                    ["Définit l'architecture cible", "Définit la taille du type wchar_t à 4 octets"],
                    ["Début de la fonction principale"]
                ]
            }
        """

        reponse = client.chat(
            model="qwen2.5-coder:7b",
            messages=[
                {"role": "system", "content": prompt_sys},
                {"role": "user", "content": f"Voici le code C :\n{code_c}\nVoici le code LLVM IR :\n{llvm0}"}
            ],
            options={
                "temperature": 0.2,
                "num_ctx": 8000  
            }
        )
        
        content = reponse['message']['content']
        clean_json = content.replace("```json", "").replace("```", "").strip()

        # JSON pour transmettr les données
        donnees_ia = json.loads(clean_json)
        
        return jsonify({
            "status": "success", 
            "liste_c": donnees_ia.get("liste_c", []),
            
            "00": {
                "liste_ll": donnees_ia.get("liste_ll", []),
                "liste_explication": donnees_ia.get("liste_explication", []),
                "liste_passes": passes0,
                "liste_diffs": diffs0
            }
            "01" : {
                "liste_llO1": llvm1,
                "liste_explicationO1" : [""],
                "liste_passesO1": passes1,
                "liste_diffsO1": diffs1
            }

            "02" : {
                "liste_llO2": llvm2,
                "liste_explicationO2": [""],
                "liste_passesO2": passes2,
                "liste_diffsO2": diffs2
            }
            "03" : {
                "liste_llO3": llvm3,
                "liste_explicationO3": [""],
                "liste_passesO3": passes3,
                "liste_diffsO3": diffs3
            }
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        for f in fichSupp:
            if f and os.path.exists(f): os.remove(f)



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)