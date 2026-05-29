import { useEffect, useRef, useState } from "react"
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

  const previousPass = useRef(null);
  const nextPass = useRef(null);


  const [reponseIA,setReponseIA] = useState([["int main() {","printf(\"Hello, world!\\n\");","return 0;"],["Cette ligne déclare la fonction main et alloue de la mémoire pour une variable entière. La valeur 0 est stockée dans cette variable.","Cette ligne appelle la fonction printf pour afficher le message \"Hello, world!\\n\". La fonction printf est déclarée plus loin dans le code.","Cette ligne retourne la valeur 0 pour indiquer que le programme s'est terminé avec succès."], [["%1 = alloca i32, align 4","store i32 0, ptr %1, align 4"],["%2 = call i32 (ptr, ...) @printf(ptr noundef @.str)"],["ret i32 0"]]])
  const [explications, setExplications] = useState('');


  

  const PASSESJSON = [
    `
    ; *** IR Dump After EntryExitInstrumenterPass on sum ***
    ; Function Attrs: noinline nounwind optnone ssp uwtable(sync)
    define i32 @sum(i32 noundef %0, i32 noundef %1) #0 {
      %3 = alloca i32, align 4
      %4 = alloca i32, align 4
      store i32 %0, ptr %3, align 4
      store i32 %1, ptr %4, align 4
      %5 = load i32, ptr %3, align 4
      %6 = load i32, ptr %4, align 4
      %7 = add nsw i32 %5, %6
      ret i32 %7
    }
    `,
    `
    ; *** IR Dump After AlwaysInlinerPass on [module] ***
    ; ModuleID = 'sum.c'
    source_filename = "sum.c"
    target datalayout = "e-m:o-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-n32:64-S128-Fn32"
    target triple = "arm64-apple-macosx26.0.0"

    ; Function Attrs: noinline nounwind optnone ssp uwtable(sync)
    define i32 @sum(i32 noundef %0, i32 noundef %1) #0 {
      %3 = alloca i32, align 4
      %4 = alloca i32, align 4
      store i32 %0, ptr %3, align 4
      store i32 %1, ptr %4, align 4
      %5 = load i32, ptr %3, align 4
      %6 = load i32, ptr %4, align 4
      %7 = add nsw i32 %5, %6
      ret i32 %7
    }

    attributes #0 = { noinline nounwind optnone ssp uwtable(sync) "frame-pointer"="non-leaf" "no-trapping-math"="true" "probe-stack"="__chkstk_darwin" "stack-protector-buffer-size"="8" "target-cpu"="apple-m1" "target-features"="+aes,+altnzcv,+bti,+ccdp,+ccidx,+ccpp,+complxnum,+crc,+dit,+dotprod,+flagm,+fp-armv8,+fp16fml,+fptoint,+fullfp16,+jsconv,+lse,+neon,+pauth,+perfmon,+predres,+ras,+rcpc,+rdm,+sb,+sha2,+sha3,+specrestrict,+ssbs,+v8.1a,+v8.2a,+v8.3a,+v8.4a,+v8.5a,+v8a" }

    !llvm.module.flags = !{!0, !1, !2, !3, !4}
    !llvm.ident = !{!5}

    !0 = !{i32 2, !"SDK Version", [2 x i32] [i32 26, i32 5]}
    !1 = !{i32 1, !"wchar_size", i32 4}
    !2 = !{i32 8, !"PIC Level", i32 2}
    !3 = !{i32 7, !"uwtable", i32 1}
    !4 = !{i32 7, !"frame-pointer", i32 1}
    !5 = !{!"Apple clang version 21.0.0 (clang-2100.1.1.101)"}
    `,
    `
    ; *** IR Dump After LowerMatrixIntrinsicsPass on sum ***
    ; Function Attrs: noinline nounwind optnone ssp uwtable(sync)
    define i32 @sum(i32 noundef %0, i32 noundef %1) #0 {
      %3 = alloca i32, align 4
      %4 = alloca i32, align 4
      store i32 %0, ptr %3, align 4
      store i32 %1, ptr %4, align 4
      %5 = load i32, ptr %3, align 4
      %6 = load i32, ptr %4, align 4
      %7 = add nsw i32 %5, %6
      ret i32 %7
    }
    `
    ];
    //TODO : mettre au bon endroit quand on aura fait l'autre fonction pour les passes
    /*
    var codeIR = reponseIA[2].map((elem) => elem.join("\n"));
    codeIR = codeIR.join("\n");
    PASSESJSON.unshift(codeIR);
    */

  const DIFFPASSESJSON = [
      `
      --- passes/pass_db_01.ll        2026-05-28 15:17:37
      +++ passes/pass_db_02.ll        2026-05-28 15:17:37
      @@ -1,4 +1,9 @@
      -; *** IR Dump After EntryExitInstrumenterPass on sum ***
      +; *** IR Dump After AlwaysInlinerPass on [module] ***
      +; ModuleID = 'sum.c'
      +source_filename = "sum.c"
      +target datalayout = "e-m:o-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-n32:64-S128-Fn32"
      +target triple = "arm64-apple-macosx26.0.0"
      +
      ; Function Attrs: noinline nounwind optnone ssp uwtable(sync)
      define i32 @sum(i32 noundef %0, i32 noundef %1) #0 {
        %3 = alloca i32, align 4
      @@ -10,3 +15,15 @@
        %7 = add nsw i32 %5, %6
        ret i32 %7
      }
      +
      +attributes #0 = { noinline nounwind optnone ssp uwtable(sync) "frame-pointer"="non-leaf" "no-trapping-math"="true" "probe-stack"="__chkstk_darwin" "stack-protector-buffer-size"="8" "target-cpu"="apple-m1" "target-features"="+aes,+altnzcv,+bti,+ccdp,+ccidx,+ccpp,+complxnum,+crc,+dit,+dotprod,+flagm,+fp-armv8,+fp16fml,+fptoint,+fullfp16,+jsconv,+lse,+neon,+pauth,+perfmon,+predres,+ras,+rcpc,+rdm,+sb,+sha2,+sha3,+specrestrict,+ssbs,+v8.1a,+v8.2a,+v8.3a,+v8.4a,+v8.5a,+v8a" }
      +
      +!llvm.module.flags = !{!0, !1, !2, !3, !4}
      +!llvm.ident = !{!5}
      +
      +!0 = !{i32 2, !"SDK Version", [2 x i32] [i32 26, i32 5]}
      +!1 = !{i32 1, !"wchar_size", i32 4}
      +!2 = !{i32 8, !"PIC Level", i32 2}
      +!3 = !{i32 7, !"uwtable", i32 1}
      +!4 = !{i32 7, !"frame-pointer", i32 1}
      +!5 = !{!"Apple clang version 21.0.0 (clang-2100.1.1.101)"}
      `,
      `
      --- passes/pass_db_02.ll        2026-05-28 15:17:37
      +++ passes/pass_db_03.ll        2026-05-28 15:17:37
      @@ -1,9 +1,4 @@
      -; *** IR Dump After AlwaysInlinerPass on [module] ***
      -; ModuleID = 'sum.c'
      -source_filename = "sum.c"
      -target datalayout = "e-m:o-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-n32:64-S128-Fn32"
      -target triple = "arm64-apple-macosx26.0.0"
      -
      +; *** IR Dump After LowerMatrixIntrinsicsPass on sum ***
      ; Function Attrs: noinline nounwind optnone ssp uwtable(sync)
      define i32 @sum(i32 noundef %0, i32 noundef %1) #0 {
        %3 = alloca i32, align 4
      @@ -15,15 +10,3 @@
        %7 = add nsw i32 %5, %6
        ret i32 %7
      }
      -
      -attributes #0 = { noinline nounwind optnone ssp uwtable(sync) "frame-pointer"="non-leaf" "no-trapping-math"="true" "probe-stack"="__chkstk_darwin" "stack-protector-buffer-size"="8" "target-cpu"="apple-m1" "target-features"="+aes,+altnzcv,+bti,+ccdp,+ccidx,+ccpp,+complxnum,+crc,+dit,+dotprod,+flagm,+fp-armv8,+fp16fml,+fptoint,+fullfp16,+jsconv,+lse,+neon,+pauth,+perfmon,+predres,+ras,+rcpc,+rdm,+sb,+sha2,+sha3,+specrestrict,+ssbs,+v8.1a,+v8.2a,+v8.3a,+v8.4a,+v8.5a,+v8a" }
      -
      -!llvm.module.flags = !{!0, !1, !2, !3, !4}
      -!llvm.ident = !{!5}
      -
      -!0 = !{i32 2, !"SDK Version", [2 x i32] [i32 26, i32 5]}
      -!1 = !{i32 1, !"wchar_size", i32 4}
      -!2 = !{i32 8, !"PIC Level", i32 2}
      -!3 = !{i32 7, !"uwtable", i32 1}
      -!4 = !{i32 7, !"frame-pointer", i32 1}
      -!5 = !{!"Apple clang version 21.0.0 (clang-2100.1.1.101)"}
      `
    ]
  const [currentPass, setCurrentPass] = useState(0);

  //met à jour l'affichage lors de l'appuie sur les flèches.
  useEffect(()=>{
      previousPass.current.dispatch({
        changes: {
          from: 0,
          to: previousPass.current.state.doc.length,
          insert: PASSESJSON[currentPass] ?? "",
        }
      });
      nextPass.current.dispatch({
        changes: {
          from: 0,
          to: nextPass.current.state.doc.length,
          insert: PASSESJSON[currentPass+1] ?? "",
        }
      });
    }, [currentPass]);

  useEffect(()=>{
    console.log(reponseIA);
    if (Array.isArray(reponseIA)){
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
      });
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
      });
    }
  }, [reponseIA])


  function handleTemp(){

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

  const handleValidate = async() => {
    

    
    try {
      const reponse = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inputRef.current.state.doc.toString() })
      })

      const texteBrut = await reponse.text()
        
      try {
        const donnees = JSON.parse(texteBrut)
        if (donnees.status === 'success') {
          let result = JSON.stringify(donnees, null, 3);
          console.log(result);
          console.log(result["liste_c"]);
          setReponseIA([result["liste_c"], result["liste_explication"],result["liste_ll"]]);
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





  function handleNavigation(direction){
    setCurrentPass(direction === "next" ? (currentPass == PASSESJSON.length-2 ? PASSESJSON.length-2 : currentPass+1 ) : (currentPass == 0 ? 0 : currentPass-1));
    
  }



  const inputExtensions = [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    lineNumbers(),
    cpp(),
    inputHighlighterCompartment.of([]),
    lineClickHandler,
    EditorView.lineWrapping
  ]
  const outputExtensions = [
    lineNumbers(),
    outputHighlighterCompartment.of([]),
    lineClickHandler,
    irLanguage,
    syntaxHighlighting(irHighlight),
    EditorState.readOnly.of(true),
    EditorView.lineWrapping,
  ]

  const passesExtensions = [
    lineNumbers(),
    irLanguage,
    syntaxHighlighting(irHighlight),
    EditorState.readOnly.of(true),
    EditorView.lineWrapping,
  ]


  return (
    <>
      <div className="flex-container">
        <Editor
          editorRef={inputRef} 
          doc={"int main() {\n    printf(\"Hello, world!\\n\");\n    return 0;\n}"}
          extensions={inputExtensions}
          langage="code en C"
        />
        <Editor
          editorRef={outputRef}
          extensions={outputExtensions}
          langage="code en IR"
        />
      </div>
      <div>
        <button className="btnValider" onClick={handleValidate}>Valider</button> //TODO :HandleValidate
      </div>
      
      <div className="explications">{explications}</div>
      
      <div className="flex-container">
        <button className="btnNavigation" onClick={() => handleNavigation("previous")}>previous</button>
        <div><h2>pass {`${currentPass+1} / ${PASSESJSON.length-1} : """ `}</h2></div>
        <button className="btnNavigation" onClick={() => handleNavigation("next")}>next</button>
      </div>
      <div className="flex-container">
        <Editor
          editorRef={previousPass}
          extensions={passesExtensions}
          langage={`code version n° ${currentPass+1}`}
        />
        <Editor
          editorRef={nextPass}
          extensions={passesExtensions}
          langage={`code version n° ${currentPass+2}`}
        />
      </div>

    </>
  )
}