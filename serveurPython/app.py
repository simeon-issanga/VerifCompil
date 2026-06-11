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


def difference_entre_passes(file1, file2):
    commande_diff = ["diff", "-u", file1, file2]

    try:
        result = subprocess.run(commande_diff, capture_output=True, text=True)
        return result.stdout 
    except Exception as e:
        return f"Erreur diff : {str(e)}"


def genererPasses(file_c, uid, opt):
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
        llvm0, path0 = genererLLVM(file_path, uid, 0)
        passes0, diffs0 = genererPasses(file_path, uid, 0)
        fichSupp.append(path0)

        #1
        llvm1, path1 = genererLLVM(file_path, uid, 1)
        passes1, diffs1 = genererPasses(file_path, uid, 1)
        fichSupp.append(path1)

        #2
        llvm2, path2 = genererLLVM(file_path, uid, 2)
        passes2, diffs2 = genererPasses(file_path, uid, 2)
        fichSupp.append(path2)

        #3
        llvm3, path3 = genererLLVM(file_path, uid, 3)
        passes3, diffs3 = genererPasses(file_path, uid, 3)
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

            CONSIGNES DE SÉCURITÉ JSON :
                - Chaque chaîne de caractères doit être sur une SEULE ligne (pas de vrais retours à la ligne).
                - TRÈS IMPORTANT : Tous les guillemets doubles à l'intérieur des instructions LLVM doivent être échappés avec un triple backslash pour le JSON (ex: \\\" ).
                - N'inclus jamais de texte ou d'explications en dehors de l'objet JSON.
                
        """

        reponse = client.chat(
            model="deepseek-r1:14b",
            messages=[
                {"role": "system", "content": prompt_sys},
                {"role": "user", "content": f"Voici le code C :\n{code_c}\nVoici le code LLVM IR :\n{llvm0}"}
            ],
            options={
                "temperature": 0.1,
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
            "optimisations" :{
                "00": 
                {
                    "liste_ll": donnees_ia.get("liste_ll", []),
                    "liste_explication": donnees_ia.get("liste_explication", []),
                    "liste_passes": passes0,
                    "liste_diffs": diffs0
                },
                "01" : {
                    "liste_ll": [[line] for line in llvm1.split('\n')] if llvm1 else [],
                    "liste_explication" : [""],
                    "liste_passes": passes1,
                    "liste_diffs": diffs1
                },
                "02" : {
                    "liste_ll": [[line] for line in llvm2.split('\n')] if llvm2 else [],
                    "liste_explication": [""],
                    "liste_passes": passes2,
                    "liste_diffs": diffs2
                },
                "03" : {
                    "liste_ll": [[line] for line in llvm3.split('\n')] if llvm3 else [],
                    "liste_explication": [""],
                    "liste_passes": passes3,
                    "liste_diffs": diffs3
                }
            }
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        for f in fichSupp:
            if f and os.path.exists(f): os.remove(f)



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)