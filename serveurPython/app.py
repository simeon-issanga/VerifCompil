from flask import Flask, request, jsonify
import uuid
import ollama
import json
import os

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
            Tu es un expert en compilation et en LLVM IR. Ta tâche est d'analyser un code C et son code LLVM IR correspondant, puis de générer une structure JSON qui fait le lien entre chaque ligne de code C et les instructions IR qui lui sont associées.

            RÈGLES STRICTES :
            1. Le JSON doit suivre EXACTEMENT cette structure :
            {
                "liste_c": ["ligne1", "ligne2", ...],
                "liste_ll": [["instr1", "instr2"], ["instr3"], ...],
                "liste_explication": [["explication1", "explication2"], ["explication3"], ...]
            }

            2. Pour CHAQUE ligne de code C (même les lignes vides), tu dois :
            - La mettre dans "liste_c"
            - Associer les instructions IR correspondantes dans "liste_ll"
            - Donner une explication pour CHAQUE instruction IR dans "liste_explication"

            3. RÈGLES DE CORRESPONDANCE :
            - Si une ligne C ne produit PAS d'instructions IR (ex: ligne vide, commentaire, directives de préprocesseur), mets un tableau vide [] dans "liste_ll" et "liste_explication"
            - Si une ligne C produit des métadonnées (comme target triple, module flags, etc.), mets "" dans "liste_c" et associe ces métadonnées dans "liste_ll"
            - Les métadonnées globales (target triple, !0 = !{...}, etc.) doivent être dans le PREMIER élément de "liste_c" avec la valeur ""

            4. FORMAT DES EXPLICATIONS :
            - Chaque explication doit être en FRANÇAIS
            - Doit être concise (1 phrase max)
            - Doit expliquer ce que fait l'instruction IR en termes simples

            5. GESTION DES LIGNES MULTIPLES :
            - Une ligne C peut produire plusieurs instructions IR : regroupe-les dans le même tableau
            - Une instruction IR peut être produite par plusieurs lignes C : duplique-la dans chaque tableau

            6. ORDRE :
            - Respecte l'ordre d'apparition dans le code C
            - Respecte l'ordre d'apparition dans le code IR

            EXEMPLE DE SORTIE ATTENDUE :
            {
                "liste_c": ["", "int main() {", "    int x = 5;", "    return x;", "}"],
                "liste_ll": [
                    ["target triple = \"x86_64\"", "!0 = !{i32 1, \"wchar_size\", i32 4}"],
                    ["define i32 @main() {"],
                    ["%1 = alloca i32", "store i32 5, i32* %1"],
                    ["%2 = load i32, i32* %1", "ret i32 %2"],
                    ["}"]
                ],
                "liste_explication": [
                    ["Définit l'architecture cible", "Définit la taille de wchar_t à 4 octets"],
                    ["Début de la fonction principale"],
                    ["Alloue 4 octets sur la pile", "Stocke la valeur 5 dans la variable"],
                    ["Charge la valeur de la variable", "Retourne la valeur chargée"],
                    ["Fin de la fonction"]
                ]
            }

            Analyse le code C et le LLVM IR fournis et génère le JSON correspondant.
                
        """

        reponse = client.chat(
            model="deepseek-r1:14b",
            messages=[
                {"role": "system", "content": prompt_sys},
                {"role": "user", "content": f"Voici le code C :\n{code}\nVoici le code LLVM IR :\n{llvm0}"}
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



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)