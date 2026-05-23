from flask import Flask, request, jsonify
import subprocess
from openai import OpenAI
import os
import json

app = Flask(__name__)

client = OpenAI(
    api_key=os.environ.get("API_KEY_DEEPSEEK"),
    base_url="https://api.groq.com/openai/v1"
)

@app.route('/api/compile', methods=['POST'], strict_slashes=False)
@app.route('/compile', methods=['POST'], strict_slashes=False)
def compile_code():
    try:
        donnes = request.get_json()
        code_c = donnes.get('code', '')
    
        if not code_c.strip():
            return jsonify({"status": "error", "message": "Le code est vide"})

        # du C au .ll 
        file_path = "fichier.c"
        with open(file_path, "w") as file:
            file.write(code_c)

        commande_bash = ["clang", file_path, "-emit-llvm", "-S", "-c", "-o", "result_file.ll"]
        resultat_terminal = subprocess.run(commande_bash, capture_output=True, text=True)

        if os.path.exists(file_path):
            os.remove(file_path)

        if resultat_terminal.returncode != 0:
            return jsonify({
                "status": "error", 
                "message": f"Erreur de compilation Clang :\n{resultat_terminal.stderr}"
            })

        #  fichier IR
        with open("result_file.ll", "r") as file_ll:
            llvm_ir = file_ll.read()
        os.remove("result_file.ll")

        #  Requête à l'IA
        prompt_sys = """Tu es un compilateur expert. 
        Ton objectif est de faire correspondre les lignes de code C avec les blocs LLVM IR correspondants.
        Tu dois renvoyer uniquement un objet JSON valide avec cette structure exacte :
        {
            "liste_c": ["int a = 5;", "return 0;"],
            "liste_ll": ["%1 = alloca i32\\nstore i32 5, i32* %1", "ret i32 0"],
            "liste_explication": ["Cette ligne alloue de la mémoire pour une variable entière et stocke la valeur 5 dedans.", "Cette ligne retourne la valeur 0 pour indiquer que le programme s'est terminé avec succès."]
        }
        Les trois listes doivent avoir exactement la même taille. L'index 0 de liste_c correspond à l'index 0 de liste_ll et à l'index 0 de liste_explication."""

        reponse = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": prompt_sys},
                {"role": "user", "content": f"Voici le code C :\n{code_c}\nVoici le code LLVM IR :\n{llvm_ir}"}
            ],
            temperature=0.2,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        
        # JSON pour transmettr les données
        donnees_ia = json.loads(reponse.choices[0].message.content)
    
        return jsonify({
            "status": "success", 
            "liste_c": donnees_ia.get("liste_c", []),
            "liste_ll": donnees_ia.get("liste_ll", []),
            "liste_explication": donnees_ia.get("liste_explication", [])
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Erreur interne du serveur Python : {str(e)}"
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)