from flask import Flask, request, jsonify
import subprocess
from pathlib import Path
import os
import json
import uuid
import ollama

app = Flask(__name__)

client = ollama.Client(host='http://ollama:11434')



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
        return [transformer_en_liste(pass_dir), transformer_en_liste(diff_dir)]
               
    except Exception as e:
        return [[f"Erreur passes : {str(e)}"], []]
    finally:       
       if os.path.exists(pass_dir):
            for f in Path(pass_dir).glob("*.ll"): f.unlink()
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

        liste_passes, liste_diffs = avoir_passe(file_path, uid)

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
        prompt_sys = """Tu es un expert LLVM. Réponds UNIQUEMENT avec un objet JSON contenant :
        "liste_c": [chaque ligne du code C],
        "liste_ll": [instructions IR correspondantes regroupées par ligne C],
        "liste_explication": [explications courtes].
        Les 3 listes doivent avoir la même taille."""

   
        #if os.environ.get("API_KEY_DEEPSEEK") == "fake_key_for_ci":
        #    donnees_ia = {
        #        "liste_c": ["/* Mode Test */"],
        #        "liste_ll": [["; IR généré"]],
        #        "liste_explication": ["Test réussi sans IA"],
        #        "liste_passes": ["passes"],
        #        "liste_diffs": ["diff"]
        #    }
        #else :
        reponse = client.chat(
            model="qwen2.5-coder:7b",
            messages=[
                {"role": "system", "content": prompt_sys},
                {"role": "user", "content": f"Voici le code C :\n{code_c}\nVoici le code LLVM IR :\n{llvm_ir}"}
            ],
            options={
                "temperature": 0.2,
                "num_ctx": 8000  # équivalent de max_tokens
            }
        )
        
        content = reponse['message']['content']
        clean_json = content.replace("```json", "").replace("```", "").strip()

        # JSON pour transmettr les données
        donnees_ia = json.loads(clean_json)
        
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
        for f in [file_path, output_path, fileTemp]:
            if os.path.exists(f): os.remove(f)



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)