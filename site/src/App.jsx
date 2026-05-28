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


  function handleTemp(){
    const codeC = inputRef.current.state.doc.toString()

    var code = "";
    var h = 150; //hue
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
        createLineHoverHighlighter(
          lesCouleursOutput, 
          reponseIA[1], 
          tabNumLignesCodeC,
          tabNumLignesCodeIR, 
          setExplications, 
          'output', 
          inputRef,
          outputRef)
      )
    })
    inputRef.current.dispatch({
      effects: inputHighlighterCompartment.reconfigure(
        createLineHoverHighlighter(
          lesCouleursInput, 
          reponseIA[1], 
          tabNumLignesCodeC,
          tabNumLignesCodeIR, 
          setExplications, 
          'input', 
          inputRef,
          outputRef)
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
      <div className="flex-container">
        <Editor
          editorRef={inputRef} 
          doc={"int main() {\n    printf(\"Hello, world!\\n\");\n    return 0;\n}"}
          extensions={inputExtensions}
          langage="C"
        />
        <Editor
          editorRef={outputRef}
          extensions={outputExtensions}
          langage="IR"
        />
      </div>
      <div>
        <button className="btnValider" onClick={handleTemp}>Valider</button>
      </div>
      
      <div className="explications">{explications}</div>
      
    </>
  )
}