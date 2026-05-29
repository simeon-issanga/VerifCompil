import requests
import time

def testCompile():
    url = "http://localhost:5000/api/compile"
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
        print(f"test rate : {str(e)}")
        exit(1)

if __name__ == "__main__":
    testCompile()