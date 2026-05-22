from flask import Flask, request, jsonify
import subprocess
from openai import OpenAI
import os

app = Flask(__name__)

client = OpenAI(
    api_key=os.environ.get("API_KEY_DEEPSEEK"),
    base_url="http://10.3.17.220:1234/v1"
)

@app.route('/api/compile', methods=['POST'])
def compile_code():
    try :
        donnes = request.get_json()
        code_c = donnes.get('code', '')
    
    if not code_utilisateur.strip():
        return jsonify({"status": "error", "message": "Le code est vide !"})
    
    question = f"Voici un code C :\n{code_c}\nPeux-tu me dire si ce code est correct et s'il peut être compilé ?"

    reponse = client.chat.completions.create(
        #model="gpt-3.5-turbo",
        model="local-model",
        messages=[
            {"role": "user", "content": question}],
        temperature=0.2

    )
    texte_reponse = reponse.choices[0].message.content
    
    return jsonify({"status": "success", "response": texte_reponse})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
