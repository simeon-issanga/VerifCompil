# VerifCompil

## Description 
Ce projet a été réalisé durant notre stage en Espagne. Il s'agit d'un site internet sur lequel on peut écrire/coller un code en C et renverra le code en .ll avec une explication grâce à  l'IA des différents blocs.

## Compétences à développer 

![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)

![Py](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)

![JS](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

![LLVM](https://img.shields.io/badge/LLVM-100000?style=for-the-badge&logo=llvm&logoColor=white)

## 🚀 Fonctionnalités

* 📤 Compilation en temps réel : Envoi de code C et génération immédiate de l'IR LLVM.

* 🔍 Analyse des Passes : Extraction et affichage de chaque étape d'optimisation du compilateur Clang.

* ⚖️ Comparaison (Diff) : Visualisation ligne à ligne des changements entre deux passes consécutives.

* 🤖 Explication par IA : Utilisation de modèles de langage (LLM) pour expliquer la correspondance entre le code source et le code généré.

* 🐳 Full Dockerized : Déploiement simplifié via Docker Compose.


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

## Commandes

Pour obtenir le pass de départ de O0
clang helloWorld.c -O0 -emit-llvm -S -o nonOptiO0.llx

Pour obtenir le pass de départ de -01
clang helloWorld.c -O1 -disable-llvm-passes -emit-llvm -S -o nonOptiO1.ll

Pour obtenir le pass de départ de -02
clang helloWorld.c -O2 -disable-llvm-passes -emit-llvm -S -o nonOptiO2.ll

Pour obtenir le pass de départ de -03
clang helloWorld.c -O3 -disable-llvm-passes -emit-llvm -S -o nonOptiO3.ll


Pour obtenir les passes d'opti de O0
clang  -mllvm -print-after-all helloWorld.c -c -o /dev/null 2> passesO0.txt

Pour obtenir les passes d'opti de O1
clang -O1 -mllvm -print-after-all helloWorld.c -c -o /dev/null 2> passesO1.txt

Pour obtenir les passes d'opti de O2
clang -O2 -mllvm -print-after-all helloWorld.c -c -o /dev/null 2> passesO2.txt

Pour obtenir les passes d'opti de O3
clang -O3 -mllvm -print-after-all helloWorld.c -c -o /dev/null 2> passesO3.txt


Pour obtenir la différence entre deux passes
diff -u pass1.ll pass2.ll

