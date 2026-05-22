from flask import Flask, request, jsonify
import subprocess
from openai import OpenAI
import os

app = Flask(__name__)

client = OpenAI(
    api_key=os.environ.get("API_KEY_DEEPSEEK"),
    base_url="https://api.deepseek.com/v1"
)

@app.route('/api/compile', methods=['POST'])
def compile_code():
    ## code 
    return jsonify({"message": "API prête !"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
