# VerifCompil

## Description 
Ce projet a été réalisé durant notre stage en Espagne. Il s'agit d'un site internet sur lequel on peut écrire/coller un code en C et renverra le code en .ll avec une explication grâce à  l'IA des différents blocs.

## Compétences à développer 

![alt text](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

![alt text](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)

![alt text](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)

![alt text](https://img.shields.io/badge/LLVM-100000?style=for-the-badge&logo=llvm&logoColor=white)

## 🚀 Fonctionnalités

* 📤 Compilation en temps réel : Envoi de code C et génération immédiate de l'IR LLVM.

* 🔍 Analyse des Passes : Extraction et affichage de chaque étape d'optimisation du compilateur Clang.

* ⚖️ Comparaison (Diff) : Visualisation ligne à ligne des changements entre deux passes consécutives.

* 🤖 Explication par IA : Utilisation de modèles de langage (LLM) pour expliquer la correspondance entre le code source et le code généré.

* 🐳 Full Dockerized : Déploiement simplifié via Docker Compose.

## Architecture du Projet

VerifCompil/
├── site/                # Frontend React (Vite, CodeMirror)
├── serveurPython/       # Backend Flask (Clang, Python, OpenAI API)
├── config/
│   ├── nginx/           # Configuration du Reverse Proxy Nginx
│   └── env/             # Variables d'environnement (.env)
├── tests/               # Batterie de tests (Unitaires & Intégration)
└── docker-compose.yml   # Orchestration des conteneurs

## Installation et Lancement

* Docker & Docker Compose installés sur votre machine.
* Une clé API
  
1. Cloner le projet
  ```
git clone https://github.com/simeon-issanga/VerifCompil.git
cd VerifCompil
```

2. Configuration des variables d'environnement
Créez un fichier `.env` dans le dossier `config/env/` :

```
mkdir -p config/env
nano config/env/.env
```
Ajoutez-y votre clé API

```
API_KEY=votre_cle_api_ici
```

3.  Lancement avec Docker
```
docker compose up --build -d
```
L'application est maintenant accessible sur : http://localhost:8080

## CI/CD 

Ce projet utilise GitHub Actions pour assurer une qualité de code constante :

1. CI (Continuous Integration) : À chaque Push ou Pull Request, GitHub vérifie la syntaxe, compile le frontend et lance des tests d'intégration dans un environnement Docker éphémère.

2. CD (Continuous Deployment) : Si les tests sont validés, le projet est automatiquement déployé sur le serveur de production (Socarrat) via un Self-Hosted Runner.

## Technologie utilisées

* Frontend : React.js, CodeMirror 6 (Éditeurs de code), Vite.
* Backend : Flask (Python 3.10), Clang/LLVM 15+.
* IA : _
* Serveur : Nginx (Reverse Proxy), Docker.

## Contributeurs 

* [Lucas Oustaloup](https://github.com/LucasOtlp)
* [Siméon Issanga--Peyrot](https://github.com/simeon-issanga)

