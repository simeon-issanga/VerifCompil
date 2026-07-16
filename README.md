# VerifCompil

## Description 

[schemas stage.pdf](https://github.com/user-attachments/files/30077356/schemas.stage.pdf)
[performances des modèles stage.pdf](https://github.com/user-attachments/files/30077355/performances.des.modeles.stage.pdf)



## Skills to develop 

![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)

![Py](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)

![JS](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

![LLVM](https://img.shields.io/badge/LLVM-100000?style=for-the-badge&logo=llvm&logoColor=white)

## 🚀 Features

* 📤 Real-time compilation: Sending C code and immediately generating the LLVM IR.

* 🔍 Passe Analysis: Extracting and displaying each stage of the Clang compiler’s optimisation process.

* ⚖️ Comparison (Diff): Line-by-line visualisation of the changes between two consecutive passes.

* 🤖 AI explanation: Using large language models (LLMs) to explain the correspondence between the source code and the generated code.

* 🐳 Fully Dockerised: Simplified deployment via Docker Compose.


## Installation and Launch

* Docker & Docker Compose installés sur votre machine.
* Vous devez posséder un GPU avec un minimum de capacité. (~16Go)
  
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
nano .env
```
Ajoutez-y vos variables d'environnements

```
DB_USER=nom user de la bdd
DB_PASSWORD=ton mot de passe
DB_NAME=nom de la base de données
```

3.  Lancement avec Docker
```
docker compose up -d --build 
```

## CI/CD 

Ce projet utilise GitHub Actions pour assurer une qualité de code constante :

1. CI (Continuous Integration) : À chaque Push ou Pull Request, GitHub vérifie la syntaxe, compile le frontend et lance des tests d'intégration dans un environnement Docker éphémère.

2. CD (Continuous Deployment) : Si les tests sont validés, le projet est automatiquement déployé sur le serveur de production (Socarrat) via un Self-Hosted Runner.

## Technologie utilisées

* Frontend : React.js, CodeMirror 6 (Éditeurs de code), Vite.
* Backend : Flask (Python 3.10), Clang/LLVM 15+.
* IA : Ollama (3 modeles utilisés pour mesurer les performances)
* Serveur : Nginx (Reverse Proxy), Docker.

## Contributeurs 

* [Lucas Oustaloup](https://github.com/LucasOtlp)
* [Siméon Issanga--Peyrot](https://github.com/simeon-issanga)



Pour obtenir la différence entre deux passes
diff -u pass1.ll pass2.ll

