from flask import Flask, request, jsonify
import subprocess
from openai import OpenAI
from pathlib import Path
import os
import json
import uuid

app = Flask(__name__)

client = OpenAI(
    api_key=os.environ.get("API_KEY_DEEPSEEK"),
    base_url="http://ollama:11434/v1"
)


def transformer_en_liste(dossier_path):
    la_liste = []
    dossier = Path(dossier_path)
    
    if not dossier.exists():
        return la_liste
    
    for fichier in sorted(dossier.glob("*")):
        with open(fichier, 'r', encoding='utf-8') as f:
            la_liste.append(f.read())
    return la_liste

def difference_entre_passes(file1, file2):
    commande_diff = ["diff", "-u", file1, file2]

    try:
        result = subprocess.run(commande_diff, capture_output=True, text=True)
        return result.stdout 
    except Exception as e:
        return f"Erreur diff : {str(e)}"


def avoir_passe(file_c, uid):
    vieuxFichiers = None
    pass_dir = f"passes_{uid}"
    diff_dir = f"diffs_{uid}"
    os.makedirs(pass_dir, exist_ok=True)
    os.makedirs(diff_dir, exist_ok=True)

    commande_clang = ["clang", "-mllvm", "-print-after-all", file_c, "-c", "-o", "/dev/null"]
    
    try:
        res = subprocess.run(commande_clang, capture_output=True, text=True, timeout=15)
        output_passes = res.stderr

        vieuxFichiers = None

        segments = output_passes.split("*** IR Dump After")
        
        for i, segment in enumerate(segments[1:], 1):
            file_name = f"pass_{i:02d}.ll"
            pass_file = os.path.join(pass_dir, file_name)

            with open(pass_file, "w") as f:
                f.write("*** IR Dump After" + segment)

            if vieuxFichiers is not None:
                diff_file = difference_entre_passes(vieuxFichiers, pass_file)    
                chemFich = os.path.join(diff_dir, f"diff_{i:02d}.txt")
                with open(chemFich, "w") as f_diff:
                    f_diff.write(diff_file)

            vieuxFichiers = pass_file
        return [transformer_en_liste(pass_dir), transformer_en_liste(diff_dir), pass_dir, diff_dir]
               
    except Exception as e:
        return [[f"Erreur passes : {str(e)}"], [], None, None]
    finally:       
        if os.path.exists(pass_dir):
            for f in Path(pass_dir).glob("*.ll"):
                f.unlink()
            os.rmdir(pass_dir)


@app.route('/api/compile', methods=['POST'], strict_slashes=False)
@app.route('/compile', methods=['POST'], strict_slashes=False)
def compile_code():
    uid = str(uuid.uuid4())
    file_path = f"temp_{uid}.c"
    output_path = f"temp_{uid}.ll"
    fileTemp = f"file_temp_{uid}.ll"
    liste_passes = []
    liste_diffs = []
    try:
        donnes = request.get_json()
        code_c = donnes.get('code', '')
    
        if not code_c.strip():
            return jsonify({"status": "error", "message": "Le code est vide"})

        
        with open(file_path, "w") as file:
            file.write(code_c)

        result_fct = avoir_passe(file_path, uid)
        liste_passes = result_fct[0]
        liste_diffs = result_fct[1]

        commande_bash = ["clang", file_path, "-emit-llvm", "-S", "-c", "-o", output_path]
        resultat_terminal = subprocess.run(commande_bash, capture_output=True, text=True, timeout=10)

        if resultat_terminal.returncode != 0:
            return jsonify({
                "status": "error", 
                "message": f"Erreur de compilation Clang :\n{resultat_terminal.stderr}"
            })

        with open(output_path, "r") as file_ll:
            llvm_ir = file_ll.read()

        ## on a zappé le premier passe entre .ll généré 
        with open(fileTemp, "w") as f_temp:
            f_temp.write(liste_passes[0])

        resultTemp = difference_entre_passes(output_path, fileTemp)
        liste_diffs.insert(0, resultTemp)

        #  Requête à l'IA
        prompt_sys = """
        Tu es un expert en infrastructure LLVM et en compilation C. 
        Ton rôle est de créer une cartographie précise entre le code source C et le code LLVM IR généré.

        RÈGLES CRUCIALES POUR LE FORMAT JSON :
        1. Tu dois renvoyer UN OBJET JSON UNIQUE contenant trois listes : "liste_c", "liste_ll", "liste_explication".
        2. Ces trois listes DOIVENT avoir exactement la même longueur (N éléments).
        3. L'élément i de "liste_c" doit correspondre exactement aux éléments i de "liste_ll" et "liste_explication".

        STRATÉGIE DE MAPPAGE :
        - "liste_c" : Doit contenir le code C ligne par ligne, sans aucune modification.
        - "liste_ll" : Pour chaque ligne de C, regroupe TOUTES les instructions LLVM IR correspondantes dans une seule chaîne de caractères (utilise \\n pour séparer les instructions IR dans cette chaîne). 
        - Si une ligne C ne produit pas d'IR (comme une accolade seule '{' ou un commentaire), mets une chaîne vide "" dans "liste_ll".
        - "liste_explication" : Donne une explication technique concise de ce que fait ce bloc IR spécifique.

        EXEMPLE DE STRUCTURE ATTENDUE :
        {
        "liste_c": ["int a = 5;", "return a;"],
        "liste_ll": [["%1 = alloca i32\\nstore i32 5,] [i32* %1"]], ["%2 = load i32, i32* %1\\nret i32 %2"],
        "liste_explication": ["Allocation et stockage de la constante 5.", "Chargement de la variable et instruction de retour."]
        }

        Réponds uniquement en JSON valide, sans texte avant ou après.
        """

   
        if os.environ.get("API_KEY_DEEPSEEK") == "fake_key_for_ci":
            donnees_ia = {
                "liste_c": ["/* Mode Test */"],
                "liste_ll": [["; IR généré"]],
                "liste_explication": ["Test réussi sans IA"],
                "liste_passes": ["passes"],
                "liste_diffs": ["diff"]
            }
        else :
            reponse = client.chat.completions.create(
                model="qwen2.5-coder:7b",
                messages=[
                    {"role": "system", "content": prompt_sys},
                    {"role": "user", "content": f"Voici le code C :\n{code_c}\nVoici le code LLVM IR :\n{llvm_ir}"}
                ],
                temperature=0.2,
                max_tokens=8000,
                response_format={"type": "json_object"}
            )
            content = reponse.choices[0].message.content
            
            if content.startswith("```json"):
                content = content.replace("```json", "", 1).replace("```", "", 1).strip()
            elif content.startswith("```"):
                content = content.replace("```", "", 1).replace("```", "", 1).strip()

            donnees_ia = json.loads(content)

            donnees_ia = json.loads(content)
            # JSON pour transmettr les données
            donnees_ia = json.loads(reponse.choices[0].message.content)
        
        return jsonify({
            "status": "success", 
            "liste_c": donnees_ia.get("liste_c", []),
            "liste_ll": donnees_ia.get("liste_ll", []),
            "liste_explication": donnees_ia.get("liste_explication", []),
            "liste_passes": liste_passes,
            "liste_diffs": liste_diffs
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        if os.path.exists(file_path): os.remove(file_path)
        if os.path.exists(output_path): os.remove(output_path)
        if os.path.exists(fileTemp): os.remove(fileTemp)



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)