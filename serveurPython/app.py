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
    base_url="https://api.groq.com/openai/v1"
)


def transformer_en_liste(dossier_path):
    la_liste = []
    dossier = Path(dossier_path)
    if not dossier.exists():
        return la_liste
    
    for fichier in sorted(dossier.glob("*.ll")):
        with open(fichier, 'r', encoding='utf-8') as f:
            la_liste.append(f.read())
    return la_liste

def avoir_passe(file_c, uid):
    pass_dir = f"passes_{uid}"
    os.makedirs(pass_dir, exist_ok=True)
    
    commande_clang = ["clang", "-mllvm", "-print-after-all", file_c, "-c", "-o", "/dev/null"]
    
    try:
        res = subprocess.run(commande_clang, capture_output=True, text=True, timeout=15)
        output_passes = res.stderr

        segments = output_passes.split("*** IR Dump After")
        for i, segment in enumerate(segments[1:], 1):
            pass_file = os.path.join(pass_dir, f"pass_{i:02d}.ll")
            with open(pass_file, "w") as f:
                f.write("*** IR Dump After" + segment)

        return transformer_en_liste(pass_dir), pass_dir
               
    except Exception as e:
        return [f"Erreur passes : {str(e)}"], None
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
    liste_passes = []
    pass_dir = None
    
    try:
        donnes = request.get_json()
        code_c = donnes.get('code', '')
    
        if not code_c.strip():
            return jsonify({"status": "error", "message": "Le code est vide"})

        
        with open(file_path, "w") as file:
            file.write(code_c)
        
        liste_passes, pass_dir = avoir_passe(file_path, uid)
        
        commande_bash = ["clang", file_path, "-emit-llvm", "-S", "-c", "-o", output_path]
        resultat_terminal = subprocess.run(commande_bash, capture_output=True, text=True, timeout=15)

        if resultat_terminal.returncode != 0:
            return jsonify({
                "status": "error", 
                "message": f"Erreur de compilation Clang :\n{resultat_terminal.stderr}"
            })

        with open(output_path, "r") as file_ll:
            llvm_ir = file_ll.read()

        donnees_ia = {"liste_c": [], "liste_ll": [], "liste_explication": []}
        
        return jsonify({
            "status": "success", 
            "liste_c": donnees_ia.get("liste_c", []),
            "liste_ll": donnees_ia.get("liste_ll", []),
            "liste_explication": donnees_ia.get("liste_explication", []),
            "liste_passes": liste_passes
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        if os.path.exists(file_path): os.remove(file_path)
        if os.path.exists(output_path): os.remove(output_path)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)