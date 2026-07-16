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

* Docker & Docker Compose must be installed on your machine.
* You must have a GPU with a minimum capacity of (~16GB).
  
1. Clone the project
  ```
git clone https://github.com/simeon-issanga/VerifCompil.git
cd VerifCompil
```

2. Configuring environment variables
Create a file `.env`, in the file `config/env/` :

```
mkdir -p config/env
nano config/env/.env
nano .env
```
Add your environment variables here

```
DB_USER=nom user de la bdd
DB_PASSWORD=ton mot de passe
DB_NAME=nom de la base de données
```

3.  Launching with Docker
```
docker compose up -d --build 
```

## CI/CD 

This project uses GitHub Actions to ensure consistent code quality:

1. CI (Continuous Integration): With every push or pull request, GitHub checks the syntax, compiles the frontend and runs integration tests in a temporary Docker environment.

2. CD (Continuous Deployment): If the tests pass, the project is automatically deployed to the production server (Socarrat) via a self-hosted runner.

## Technologies used

* Frontend : React.js, CodeMirror 6 (lib), Vite.
* Backend : Flask (Python 3.10), Clang/LLVM 15+.
* IA : Ollama (3 models used to measure performance)
* Serveur : Nginx (Reverse Proxy), Docker.

## Contributors 

* [Lucas Oustaloup](https://github.com/LucasOtlp)
* [Siméon Issanga--Peyrot](https://github.com/simeon-issanga)


