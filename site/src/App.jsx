import { useRef, useState } from "react"
import './App.css'
import Editor from "./Editor"

import { EditorState, RangeSetBuilder, Compartment } from "@codemirror/state"
import { EditorView, keymap, lineNumbers, Decoration, ViewPlugin   } from "@codemirror/view"
import { defaultKeymap, historyKeymap, history } from "@codemirror/commands"
import { cpp } from "@codemirror/lang-cpp"
import {irLanguage, irHighlight} from "./IRLanguage"
import { tags } from "@lezer/highlight"
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { createLineHoverHighlighter, lineClickHandler } from "./lineClickHandler"


const inputHighlighterCompartment = new Compartment();
const outputHighlighterCompartment = new Compartment();


export default function App() {
  // useRef : persiste entre les rendus et ne déclenche aucun re-rendu, banger non ?!
  const inputRef = useRef(null)   // view de l'éditeur source
  const outputRef = useRef(null)   // view de l'éditeur output

  const [codeC, setCodeC] = useState('') //TODO :simplifie la récupération du code entré TODO -> remplacer par une variable normale
  const [reponseIA,setReponseIA] = useState([["int main() {","printf(\"Hello, world!\\n\");","return 0;"],["Cette ligne déclare la fonction main et alloue de la mémoire pour une variable entière. La valeur 0 est stockée dans cette variable.","Cette ligne appelle la fonction printf pour afficher le message \"Hello, world!\\n\". La fonction printf est déclarée plus loin dans le code.","Cette ligne retourne la valeur 0 pour indiquer que le programme s'est terminé avec succès."], [["%1 = alloca i32, align 4","store i32 0, ptr %1, align 4"],["%2 = call i32 (ptr, ...) @printf(ptr noundef @.str)"],["ret i32 0"]]])
  const [explications, setExplications] = useState('');


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
        const donnees = JSON.parse(texteBrut)
        if (donnees.status === 'success') {
          let result = JSON.stringify(donnees, null, 3);
          //setReponseIA([result["liste_c"], result["liste_explication"],result["liste_ll"]]); TODO decomenter
          //on créé la chaine de caractère qui va être affichée dans l'autre éditeur
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
          });
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

  function handleTemp(){
    const codeC = inputRef.current.state.doc.toString()

    var code = "";
    var h = 0; //hue
    var lesCouleursOutput = [];
    var lesCouleursInput = [];
    var tabNumLignesCodeIR = []; //représente la structure du code IR en blocs
    var tabNumLignesCodeC = []; //représente la structure du code C en blocs de 1 ligne
    var numLigneIR = 1;
    var numLigneC = 1;
    //création du bloc de code et de la liste des couleurs pour chaque ligne de l'outputEditor et de l'inputEditor
    for (let bloc of reponseIA[2]){
      const couleur = `hsla(${h} 65 65 / 40%)`;
      tabNumLignesCodeIR.push([]); //on ajoute un bloc de code IR
      tabNumLignesCodeC.push([numLigneC++]);
      for(let ligne of bloc){
        tabNumLignesCodeIR.at(-1).push(numLigneIR++); //on ajoute une ligne (représentée par son numéro) au bloc 
        code+= ligne+"\n";
        lesCouleursOutput.push("background: "+couleur);
      }
      lesCouleursInput.push("background: "+couleur);
      h = (h + 30) % 360;
    }
    code = code.slice(0,-2); //supprime le dernier \n

    console.log(tabNumLignesCodeC);

    outputRef.current.dispatch({
      changes: {
        from: 0,
        to: outputRef.current.state.doc.length,
        insert: code,
      }
    });

    outputRef.current.dispatch({
      effects: outputHighlighterCompartment.reconfigure(
        createLineHoverHighlighter(lesCouleursOutput, reponseIA[1], tabNumLignesCodeIR, setExplications, 2, inputRef)
      )
    })
    inputRef.current.dispatch({
      effects: inputHighlighterCompartment.reconfigure(
        createLineHoverHighlighter(lesCouleursInput, reponseIA[1], tabNumLignesCodeC, setExplications, 1, outputRef)
      )
    })
  }

  const inputExtensions = [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    lineNumbers(),
    cpp(),

    inputHighlighterCompartment.of([]),
    lineClickHandler,
  ]
  const outputExtensions = [
    lineNumbers(),
    outputHighlighterCompartment.of([]),
    lineClickHandler,
    irLanguage,
    syntaxHighlighting(irHighlight),
    EditorState.readOnly.of(true),
  ]

  return (
    <>
      <h1>traduction de C vers LLVM - IR</h1>

      <div className="flex-container">
        <Editor editorRef={inputRef} 
          doc={"int main() {\n    printf(\"Hello, world!\\n\");\n    return 0;\n}"}
          extensions={inputExtensions}
          langage="C"
        />
        <Editor editorRef={outputRef}
          extensions={outputExtensions}
          langage="IR"
        />
      </div>
      <button onClick={handleTemp}>Valider</button>
      
      <div>{explications}</div>
      
    </>
  )
}