import os
import requests
import time

def testCompile():
    server_url = os.getenv("TEST_SERVER_URL", "http://localhost:8080")
    url = f"{server_url}/api/compile"
    payload = {
        "code": "int main() { int a = 1; return a; }"
    }
    
    print("Test de l'API Flask...")
    try:
        
        response = requests.post(url, json=payload, timeout=20)
        data = response.json()
        
        assert response.status_code == 200
        assert data["status"] == "success"
        assert "liste_passes" in data
        assert len(data["liste_passes"]) > 0
        
        print("TEST reussi")
     
        
    except Exception as e:
        print(f"échec test compil")
        if 'response' in locals():
            print(f"Status Code: {response.status_code}")
            print(f"Réponse du serveur: {response.text}")
        else:
            print(f"Erreur de connexion : {str(e)}")
        exit(1)

if __name__ == "__main__":
    testCompile()