from flask import Flask, request, jsonify
import subprocess
from openai import OpenAI
import os

app = Flask(__name__)

client = OpenAI(
    api_key=os.environ.get("API_KEY_DEEPSEEK"),
    base_url="https://api.groq.com/openai/v1"
)

@app.route('/api/compile', methods=['POST'])
@app.route('/compile', methods=['POST'])
def compile_code():
    try :
        donnes = request.get_json()
        code_c = donnes.get('code', '')
    
        if not code_c.strip():
            return jsonify({"status": "error", "message": "Le code est vide !"})
    
        question = f"Voici un code C :\n{code_c}\nPeux-tu me dire si ce code est correct et s'il peut être compilé ?"

        reponse = client.chat.completions.create(
            #model="gpt-3.5-turbo",
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "user", "content": question}],
            temperature=0.2

        )
        texte_reponse = reponse.choices[0].message.content
    
        return jsonify({"status": "success", "message": texte_reponse})

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f" Impossible de joindre LM Studio : {str(e)}"
        }), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
