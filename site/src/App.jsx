import { useRef, useState, useEffect } from "react"
import './App.css'
import Editor from "./Editor"

import { EditorState, RangeSetBuilder } from "@codemirror/state"
import { EditorView, keymap, lineNumbers, Decoration, ViewPlugin   } from "@codemirror/view"
import { defaultKeymap, historyKeymap, history } from "@codemirror/commands"
import { cpp } from "@codemirror/lang-cpp"
import {irLanguage, irHighlight} from "./IRLanguage"
import { tags } from "@lezer/highlight"
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { lineHighlighter } from "./LineHighlighter"
import { lineHoverHighlighter, lineClickHandler } from "./lineClickHandler"

export default function App() {
  // useRef : persiste entre les rendus et ne déclenche aucun re-rendu, banger non ?!
  const inputRef = useRef(null)   // view de l'éditeur source
  const outputRef = useRef(null)   // view de l'éditeur output

  const [codeC, setCodeC] = useState('')
  //TODO : à supprimer
  //const [reponseIA, setReponseIA] = useState([[ "int nombreMystere = 0, nombreSaisi = 0;", "const int MAX = 100, MIN = 1;", "srand(time(NULL));", "nombreMystere = (rand() % (MAX - MIN + 1)) + MIN;", "printf(\"=== Bienvenue dans le Juste Prix ! ===\\n\");", "printf(\"Devinez le nombre cache (entre %d et %d)\\n\\n\", MIN, MAX);", "while (nombreSaisi != nombreMystere) {", " printf(\"Quel est le nombre ? \");", " scanf(\"%d\", &nombreSaisi);", " if (nombreSaisi < nombreMystere) printf(\"C'est plus !\\n\\n\");", " else if (nombreSaisi > nombreMystere) printf(\"C'est moins !\\n\\n\");", " else printf(\"Bravo, vous avez trouve le nombre mystere !!!\\n\\n\");", "}", "return 0;" ],[ "Ces lignes déclarent et initialisent les variables nombreMystere et nombreSaisi.", "Ces lignes déclarent et initialisent les constantes MAX et MIN.", "Cette ligne initialise le générateur de nombres aléatoires.", "Cette ligne génère un nombre aléatoire entre MIN et MAX et l'attribue à nombreMystere.", "Cette ligne affiche le message de bienvenue.", "Cette ligne affiche le message demandant à l'utilisateur de deviner le nombre.", "Cette ligne commence la boucle de jeu.", "Cette ligne demande à l'utilisateur de saisir un nombre.", "Cette ligne compare le nombre saisi par l'utilisateur avec le nombre mystère et affiche un message en conséquence.", "Cette ligne compare le nombre saisi par l'utilisateur avec le nombre mystère et affiche un message en conséquence.", "Cette ligne compare le nombre saisi par l'utilisateur avec le nombre mystère et affiche un message en conséquence.", "Cette ligne termine la boucle de jeu et retourne 0 pour indiquer la fin du programme." ], [ "%1 = alloca i32, align 4\n%2 = alloca i32, align 4", "%4 = alloca i32, align 4\n%5 = alloca i32, align 4", "%6 = call i64 @time(ptr noundef null) #3", "%8 = call i32 @rand() #3\n%9 = srem i32 %8, 100\n%10 = add nsw i32 %9, 1", "%11 = call i32 (ptr, ...) @printf(ptr noundef @.str)", "%12 = call i32 (ptr, ...) @printf(ptr noundef @.str.1, i32 noundef 1, i32 noundef 100)", "br label %13", "%18 = call i32 (ptr, ...) @printf(ptr noundef @.str.2)\n%19 = call i32 (ptr, ...) @__isoc99_scanf(ptr noundef @.str.3, ptr noundef %3)", "%22 = icmp slt i32 %20, %21\n%24 = call i32 (ptr, ...) @printf(ptr noundef @.str.4)", "%28 = icmp sgt i32 %26, %27\n%30 = call i32 (ptr, ...) @printf(ptr noundef @.str.5)", "%32 = call i32 (ptr, ...) @printf(ptr noundef @.str.6)", "ret i32 0" ]]);
  const [reponseIA, setReponseIA] = useState([]);
  const [explications, setExplications] = useState('');


  const [laDonnes, setLaDonnes] = useState(''); //TODO : à supprimer

  useEffect(() => { //TODO : peut être mettre ici la màj de l'affichage ??
    console.log("reponseIA a changé :", reponseIA);
  }, [reponseIA]);

  //TODO : à supprimer quand codeMirror marchera
  function handleOver(index){
    console.log(index);
    setExplications(reponseIA[1][index]);
  }


  const handleValidate = async() => {
    const codeC = inputRef.current.state.doc.toString()
    
    try {
      const reponse = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeC })
      })

      const texteBrut = await reponse.text()
        
      try {
        const donnees = JSON.parse(texteBrut);

        console.log("Données reçues de l'IA :", donnees);
        setLaDonnes(JSON.stringify(donnees));

        if (donnees.status === 'success') {
          let result = JSON.stringify(donnees, null, 3);
          console.log("Résultat formaté :", result);
          setReponseIA([result["liste_c"], result["liste_explication"],result["liste_ll"]]); //TODO decomenter
          //on créé la chaine de caractère qui va être affichée dans l'autre éditeur
          /* TODO : mettre dans le useEffect ?
          var code = "";
          for (let elem of reponseIA[2]){
            code+= elem+"\n";
          }
          //on met à jour l'autre éditeur
          outputRef.current.dispatch({
            changes: {
              from: 0,
              to: outputRef.current.state.doc.length,
              insert: code, //à reformater
            }
          });*/
        } else {
          setReponseIA("Erreur du serveur : " + donnees.message);
        }
      } catch (erreurParse) {
        // 4. Si la transformation plante (ce n'est pas du JSON), on affiche l'erreur brute
        setReponseIA("Erreur inattendue (Nginx ou plantage Flask) :\n\n" + texteBrut)
      }
    }catch (error) {
      setReponseIA('Erreur de réseau ou serveur injoignable : ' + error.message)
    }
  }

  //TODO : à supprimer après les tests
  function handleTemp(){
    const codeC = inputRef.current.state.doc.toString()

    var code = "";
    for (let elem of reponseIA[2]){
      code+= elem+"\n";
    }
    console.log(inputRef.current.state.doc.text); //TODO : permet de voir le tableau des lignes mais pas d'ajouter les onCLick/onOver

    outputRef.current.dispatch({
      changes: {
        from: 0,
        to: outputRef.current.state.doc.length,
        insert: code,
      } 
    });
  }

  const inputExtensions = [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    lineNumbers(),
    cpp(),
  ]
  const outputExtensions = [
    lineNumbers(),
    lineHoverHighlighter,
    //lineHighlighter,
    lineClickHandler,
    irLanguage,
    syntaxHighlighting(irHighlight),
    EditorState.readOnly.of(true),
  ]

  return (
    <>
      <h1>Ceci est une page de fou</h1>

      <div className="flex-container">
        <Editor editorRef={inputRef} 
          doc={"#include <stdio.h>\n\nint main() {\n    printf(\"Hello, world!\\n\");\n    return 0;\n}\n"}
          extensions={inputExtensions}
        />
        <Editor editorRef={outputRef} 
        doc={"// le code apparaîtra ici...\n"}
        extensions={outputExtensions}
        />
      </div>
      
      <button onClick={handleValidate}>Valider</button>
      
      <div className="div">{laDonnes /*pour test*/}</div>
      {/*TODO ici encadre*/}

      <div>{explications}</div>
      
    </>
  )
}

/*
<div className="flex-container" >
        <Encadre langage="C" placeholder="entrer votre code C ici" onChange={(e) => setCodeC(e.target.value)} codeParts={reponseIA[0]} handleOver={handleOver} />
        <Encadre langage="IR" codeParts={reponseIA[2]} handleOver={handleOver}  />
      </div>
      */

function Encadre({langage, placeholder, onChange, codeParts, handleOver}){
  var colors = ["#76e1d8","#64cc44"];
  return (
    <div>
      <div>
        <h2>code en {langage}</h2>
      </div>
      {codeParts.map( (part, index) => {
          return <div key={index} style={{backgroundColor: colors[index%2]}} onMouseOver={ () =>handleOver(index)}>{part}</div>
        })
      }
    </div>
  );
}