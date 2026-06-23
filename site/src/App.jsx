import { useEffect, useRef, useState } from "react"
import './App.css'
import Editor from "./Editor"
import { EditorState, RangeSetBuilder, Compartment } from "@codemirror/state"
import { EditorView, keymap, lineNumbers, Decoration, ViewPlugin } from "@codemirror/view"
import { defaultKeymap, historyKeymap, history } from "@codemirror/commands"
import { cpp } from "@codemirror/lang-cpp"
import { irLanguage, irHighlight } from "./IRLanguage"
import { tags } from "@lezer/highlight"
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { createLineHoverHighlighter, createLineDiffHiglighter, lineClickHandler, requestUpdateLines, resetHighlights } from "./lineClickHandler"
import { useTranslation } from 'react-i18next';
import i18n from './i18n.js'
import PassProgressBar from './PassProgressBar'
import donnees from './donneesTest.json'
import PassChart from './PassChart'

const inputHighlighterCompartment = new Compartment();
const outputHighlighterCompartment = new Compartment();
const previousPassHighlighterCompartment = new Compartment();
const nextPassHighlighterCompartment = new Compartment();

export default function App() {

  //gestion des langues
  const { t, i18n } = useTranslation(); //pour la traduction
  const [language, setLanguage] = useState(i18n.language ?? 'fr');
  const handleLanguageChange = (event) => {
    const nextLang = event.target.value;
    setLanguage(nextLang);
    i18n.changeLanguage(nextLang);
  };

  // useRef : persiste entre les rendus et ne déclenche aucun re-rendu, banger non ?!
  const inputRef = useRef(null)   // view de l'éditeur source
  const outputRef = useRef(null)   // view de l'éditeur output
  const previousPass = useRef(null); // view de l'éditeur previousPass
  const nextPass = useRef(null); // view de l'éditeur nextPass

  const niveau_optimisation = useRef(0);


  const reponseIA = useRef(null); //Ensemble des données affichées

  const [explications, setExplications] = useState('');
  const [currentPass, setCurrentPass] = useState(0);
  const [message, setMessage] = useState('');
  const [nbPasses, setNbPasses] = useState(0);


  const indicesFiltres = useRef([])   // liste des indices de passes avec changement
  const K = useRef(0)                  // nombre total de passes avec changement  
  const [afficherFiltre, setAfficherFiltre] = useState(false) // toggle entre les deux modes (montrer tous les passes / montrer les passes avec changement)


  useEffect(() => {//TEST de données pour reponseIA

    //ajout du ll comme premier pass à chaque niveau d'opti
    reponseIA.current = {
      liste_c: donnees["liste_c"],
      liste_explicationO0: donnees["optimisations"]["00"]["liste_explication"],
      liste_llO0: donnees["optimisations"]["00"]["liste_ll"],
      liste_passesO0: donnees["optimisations"]["00"]["liste_passes"],
      liste_diffsO0: donnees["optimisations"]["00"]["liste_diffs"],
      perfO0: donnees["optimisations"]["00"]["perf"],
      liste_explicationO1: donnees["optimisations"]["01"]["liste_explication"],
      liste_llO1: donnees["optimisations"]["01"]["liste_ll"],
      liste_passesO1: donnees["optimisations"]["01"]["liste_passes"],
      liste_diffsO1: donnees["optimisations"]["01"]["liste_diffs"],
      perfO1: donnees["optimisations"]["01"]["perf"],
      liste_explicationO2: donnees["optimisations"]["02"]["liste_explication"],
      liste_llO2: donnees["optimisations"]["02"]["liste_ll"],
      liste_passesO2: donnees["optimisations"]["02"]["liste_passes"],
      liste_diffsO2: donnees["optimisations"]["02"]["liste_diffs"],
      perfO2: donnees["optimisations"]["02"]["perf"],
      liste_explicationO3: donnees["optimisations"]["03"]["liste_explication"],
      liste_llO3: donnees["optimisations"]["03"]["liste_ll"],
      liste_passesO3: donnees["optimisations"]["03"]["liste_passes"],
      liste_diffsO3: donnees["optimisations"]["03"]["liste_diffs"],
      perfO3: donnees["optimisations"]["03"]["perf"],
    };

    majReponseIA(reponseIA.current?.liste_llO0 ?? [], reponseIA.current?.liste_explicationO0 ?? [], reponseIA.current?.liste_diffsO0 ?? [])
  }, []);


  useEffect(() => { //met à jour l'affichage lors de l'appuie sur les flèches.
    let listePass = reponseIA.current?.["liste_passesO" + niveau_optimisation.current] ?? [];
    previousPass.current.dispatch({
      changes: {
        from: 0,
        to: previousPass.current.state.doc.length,
        insert: listePass[currentPass] ?? "",
      }
    });
    nextPass.current.dispatch({
      changes: {
        from: 0,
        to: nextPass.current.state.doc.length,
        insert: listePass[currentPass + 1] ?? "",
      }
    });

    requestUpdateLines(previousPass.current, currentPass)
    requestUpdateLines(nextPass.current, currentPass)
  }, [currentPass]);

  //met à jour la langue dans les éléments de index.html
  useEffect(() => {
    const h = document.getElementById('app-header');
    const title = document.getElementById('app-title');
    if (h) h.textContent = t('title');
    if (title) title.textContent = t('app-title');
  }, [t, i18n.language]);

  //gestion de la navigation des passes avec les flèches directionnelles
  useEffect(() => {
    const handleKeyDown = (e) => {
      e = e || window.event;
      if (e.keyCode === 37) {
        handleNavigation('previous');
      } else if (e.keyCode === 39) {
        handleNavigation('next');
      }
    };
    document.addEventListener('keydown', handleKeyDown); // TODO : Je suis pas convaincu par la recréation du listener à chaque rendu et le handleNavigtion comme déclencheur
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNavigation]);

  function majReponseIA(listeLL, listeExplications, listeDiffs) {
    const isResponseObject = reponseIA.current && typeof reponseIA.current === 'object' && listeLL;

    resetHighlights(); //réinitialise le highlight des lignes
    let listePass = reponseIA.current?.["liste_passesO" + niveau_optimisation.current] ?? [];


    // indices des diffs avec changement dans listeDiff
    indicesFiltres.current = listeDiffs
      .map((diff, i) => diffAvecChangements(diff) ? i : null)
      .filter(i => i !== null)
    K.current = indicesFiltres.current.length


    if (isResponseObject) {
      setMessage('');
      var code = "";
      var h = 150; //hue
      var lesCouleursOutput = [];
      var lesCouleursInput = [];
      var tabNumLignesCodeIR = []; //représente la structure du code IR en blocs
      var tabNumLignesCodeC = []; //représente la structure du code C en blocs de 1 ligne
      var numLigneIR = 1;
      var numLigneC = 1;
      //création du bloc de code et de la liste des couleurs pour chaque ligne de l'outputEditor et de l'inputEditor
      for (let bloc of listeLL) {
        const couleur = `hsla(${h} 65 65 / 40%)`;
        tabNumLignesCodeIR.push([]); //on ajoute un bloc de code IR
        tabNumLignesCodeC.push([numLigneC++]);
        for (let ligne of bloc) {
          tabNumLignesCodeIR.at(-1).push(numLigneIR++); //on ajoute une ligne (représentée par son numéro) au bloc 
          code += ligne + "\n";
          lesCouleursOutput.push("background: " + couleur);
        }
        lesCouleursInput.push("background: " + couleur);
        h = (h + 30) % 360;
      }
      code = code.slice(0, -2); //supprime le dernier \n

      outputRef.current.dispatch({
        changes: {
          from: 0,
          to: outputRef.current.state.doc.length,
          insert: code,
        },
        effects: outputHighlighterCompartment.reconfigure(
          createLineHoverHighlighter(
            lesCouleursOutput,
            listeExplications,
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
            listeExplications,
            tabNumLignesCodeC,
            tabNumLignesCodeIR,
            setExplications,
            'input',
            inputRef,
            outputRef)
        )
      });
      previousPass.current.dispatch({
        effects: previousPassHighlighterCompartment.reconfigure(
          createLineDiffHiglighter(
            'previous',
            listeDiffs)
        )
      });
      nextPass.current.dispatch({
        effects: nextPassHighlighterCompartment.reconfigure(
          createLineDiffHiglighter(
            'next',
            listeDiffs)
        )
      });

      //TODO : jsp si nécéssaire
      previousPass.current.dispatch({
        changes: {
          from: 0,
          to: previousPass.current.state.doc.length,
          insert: listePass[currentPass] ?? "",
        }
      });
      nextPass.current.dispatch({
        changes: {
          from: 0,
          to: nextPass.current.state.doc.length,
          insert: listePass[currentPass + 1] ?? "",
        }
      });

    } else {
      setMessage(typeof reponseIA.current === 'string' ? reponseIA.current : JSON.stringify(reponseIA.current, null, 2));
    }
    setCurrentPass(0);
    const totalPasses = reponseIA.current?.["liste_passesO" + niveau_optimisation.current]?.length ?? 1;
    setNbPasses(Math.max(0, totalPasses - 1));
  };


  const handleValidate = async () => {
    setMessage('traduction en cours...');
    try {
      const reponse = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inputRef.current.state.doc.toString(), lang: "c" }) //TODO : préciser lagage C/C++
      })

      const texteBrut = await reponse.text()

      try {
        const donnees = JSON.parse(texteBrut)
        if (donnees.status === 'success') {
          reponseIA.current = {
            liste_c: donnees["liste_c"],
            liste_explicationO0: donnees["optimisations"]["00"]["liste_explication"],
            liste_llO0: donnees["optimisations"]["00"]["liste_ll"],
            liste_passesO0: donnees["optimisations"]["00"]["liste_passes"],
            liste_diffsO0: donnees["optimisations"]["00"]["liste_diffs"],
            liste_explicationO1: donnees["optimisations"]["01"]["liste_explication"],
            liste_llO1: donnees["optimisations"]["01"]["liste_ll"],
            liste_passesO1: donnees["optimisations"]["01"]["liste_passes"],
            liste_diffsO1: donnees["optimisations"]["01"]["liste_diffs"],
            liste_explicationO2: donnees["optimisations"]["02"]["liste_explication"],
            liste_llO2: donnees["optimisations"]["02"]["liste_ll"],
            liste_passesO2: donnees["optimisations"]["02"]["liste_passes"],
            liste_diffsO2: donnees["optimisations"]["02"]["liste_diffs"],
            liste_explicationO3: donnees["optimisations"]["03"]["liste_explication"],
            liste_llO3: donnees["optimisations"]["03"]["liste_ll"],
            liste_passesO3: donnees["optimisations"]["03"]["liste_passes"],
            liste_diffsO3: donnees["optimisations"]["03"]["liste_diffs"],
          };
        } else {
          reponseIA.current = "Erreur du serveur : " + donnees.message;
        }
        console.log(donnees);
      } catch (erreurParse) {
        // 4. Si la transformation plante (ce n'est pas du JSON), on affiche l'erreur brute
        reponseIA.current = "Erreur inattendue (Nginx ou plantage Flask) :\n\n" + texteBrut;
      }
    } catch (error) {
      reponseIA.current = 'Erreur de réseau ou serveur injoignable : ' + error.message;
    }
    majReponseIA(reponseIA.current?.liste_llO0 ?? [], reponseIA.current?.liste_explicationO0 ?? [], reponseIA.current?.liste_diffsO0 ?? []);
  }

  function handleNavigation(direction) {
    if (afficherFiltre) {
      // on navigue dans indicesFiltres
      setCurrentPass(prev => {
        const posActuelle = indicesFiltres.current.indexOf(prev)
        if (direction === 'next') {
          const suivant = posActuelle + 1
          return suivant >= indicesFiltres.current.length ? prev : indicesFiltres.current[suivant]
        } else {
          const precedent = posActuelle - 1
          return precedent < 0 ? prev : indicesFiltres.current[precedent]
        }
      })
    } else {
      // navigation normale
      setCurrentPass(prev => {
        const maxIndex = Math.max(0, (reponseIA.current?.["liste_passesO" + niveau_optimisation.current]?.length ?? 0) - 2)
        return direction === 'next'
          ? (prev >= maxIndex ? maxIndex : prev + 1)
          : (prev === 0 ? 0 : prev - 1)
      })
    }
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
  const nextPassExtensions = [
    lineNumbers(),
    irLanguage,
    syntaxHighlighting(irHighlight),
    EditorState.readOnly.of(true),
    EditorView.lineWrapping,
    nextPassHighlighterCompartment.of([]),
  ]
  const previousPassExtensions = [
    lineNumbers(),
    irLanguage,
    syntaxHighlighting(irHighlight),
    EditorState.readOnly.of(true),
    EditorView.lineWrapping,
    previousPassHighlighterCompartment.of([]),
  ]



  //Référence pour simuler le clic sur le input masqué
  const fileInputRef = useRef(null);

  //Déclenché quand on clique sur le bouton visible
  const gererClicBouton = () => {
    fileInputRef.current.click();
  };

  //Déclenché quand l'utilisateur choisit un fichier
  const gererChangementFichier = (evenement) => {
    const fichier = evenement.target.files[0];
    if (!fichier) return;
    const lecteur = new FileReader();
    lecteur.onload = (e) => {
      reponseIA.current = {}
      inputRef.current.dispatch({
        changes: {
          from: 0,
          to: inputRef.current.state.doc.length,
          insert: e.target.result,
        }
      });
      majReponseIA([], [], []);
      setExplications("");
    };
    lecteur.readAsText(fichier);
  };


  //permet de savoir si le diff donné en paramètre possède des changements : retourne un BOOLEAN
  function diffAvecChangements(diffStr) {
    if (!diffStr || diffStr.trim() === '') return false
    // on cherche au moins une ligne commençant par + ou - (hors en-têtes)
    return diffStr.split('\n').some(ligne =>
      (ligne.startsWith('+') || ligne.startsWith('-')) &&
      !ligne.startsWith('+++') && !ligne.startsWith('---') && !ligne.startsWith('+***') && !ligne.startsWith('-***')
    )
  }

  //Compte le nombre de lignes ajoutées supprimées du diff donné
  function compterChangements(listeDiffs, indexDiff) {
    const diff = listeDiffs?.[indexDiff] ?? ''
    if (!diff || diff.trim() === '') return { ajouts: 0, suppressions: 0 }

    let ajouts = 0
    let suppressions = 0
    for (const ligne of diff.split('\n')) {
      if (ligne.startsWith('+') && !ligne.startsWith('+++') && !ligne.startsWith('+***')) ajouts++
      if (ligne.startsWith('-') && !ligne.startsWith('---') && !ligne.startsWith('-***')) suppressions++
    }
    return { ajouts, suppressions }
  }




  const listePass = reponseIA.current?.["liste_passesO" + niveau_optimisation.current] ?? []
  const titrePasse = afficherFiltre
    ? `(${K.current} ${t("modification")}) pass ${currentPass} → ${currentPass + 1} : ${(listePass[currentPass + 1] ?? '').match(/^\s*\*\*\* IR Dump After .* \*\*\*:?$/m)?.[0] ?? ''
    }`
    : `pass ${currentPass + 1} / ${nbPasses} : ${(listePass[currentPass + 1] ?? '').match(/^\s*\*\*\* IR Dump After .* \*\*\*:?$/m)?.[0] ?? ''
    }`
  const { ajouts, suppressions } = compterChangements(reponseIA.current?.["liste_diffsO" + niveau_optimisation.current] ?? [], currentPass)

  return (
    <>
      <div className="language-selector">
        <label htmlFor="language-select">Langue :</label>
        <select id="language-select" value={language} onChange={handleLanguageChange}>
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </div>

      <div>

        <button onClick={gererClicBouton} className="btnImportFichier">{t("fileChoice")}</button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={gererChangementFichier}
          accept=".c,.cpp"
          style={{ display: 'none' }}
        />
      </div>


      <div className="flex-container">
        <Editor
          editorRef={inputRef}
          doc={"int main() {\n    printf(\"Hello, world!\\n\");\n    return 0;\n}"}
          extensions={inputExtensions}
          langage={t("C_code")}
        />
        <Editor
          editorRef={outputRef}
          extensions={outputExtensions}
          langage={t("IR_code")}
        />
      </div>

      <div>
        <button onClick={() => { niveau_optimisation.current = 0; majReponseIA(reponseIA.current?.liste_llO0 ?? [], reponseIA.current?.liste_explicationO0 ?? [], reponseIA.current?.liste_diffsO0 ?? []) }}>O0</button>
        <button onClick={() => { niveau_optimisation.current = 1; majReponseIA(reponseIA.current?.liste_llO1 ?? [], reponseIA.current?.liste_explicationO1 ?? [], reponseIA.current?.liste_diffsO1 ?? []) }}>O1</button>
        <button onClick={() => { niveau_optimisation.current = 2; majReponseIA(reponseIA.current?.liste_llO2 ?? [], reponseIA.current?.liste_explicationO2 ?? [], reponseIA.current?.liste_diffsO2 ?? []) }}>O2</button>
        <button onClick={() => { niveau_optimisation.current = 3; majReponseIA(reponseIA.current?.liste_llO3 ?? [], reponseIA.current?.liste_explicationO3 ?? [], reponseIA.current?.liste_diffsO3 ?? []) }}>O3</button>
        <button className="btnValider" onClick={handleValidate}>{t('submit')}</button>
        <p>{message}</p>
      </div>

      <div className="explications">{explications}</div>

      <button onClick={() => {
        const nouveauMode = !afficherFiltre
        setAfficherFiltre(nouveauMode)
        // en passant en mode filtré, on saute au premier indice avec changement
        if (nouveauMode && indicesFiltres.current.length > 0) {
          setCurrentPass(indicesFiltres.current[0])
        } else {
          setCurrentPass(0)
        }
      }}>
        {afficherFiltre ? t("modifPasses") : t("allPasses")}
      </button>

      <div className="flex-container">
        <button className="btnNavigation" onClick={() => handleNavigation("previous")}>{t('previous')}</button>
        <div>
          <h2>
            {titrePasse}
            <PassProgressBar
              listeDiffs={reponseIA.current?.["liste_diffsO" + niveau_optimisation.current] ?? []}
              currentPass={currentPass}
              onPassClick={(i) => setCurrentPass(i)}
              diffAvecChangements={diffAvecChangements}
            />
            {ajouts > 0 && <span style={{ color: '#00ff26' }}>+{ajouts} {t('lines')} </span>}
            {suppressions > 0 && <span style={{ color: '#ff0000' }}>-{suppressions} {t('lines')}</span>}
            {ajouts === 0 && suppressions === 0 && <span style={{ color: '#888' }}>{t('NoModification')}</span>}
          </h2>
        </div>
        <button className="btnNavigation" onClick={() => handleNavigation("next")}>{t('next')}</button>
      </div>

      <div className="flex-container">
        <Editor
          editorRef={previousPass}
          extensions={previousPassExtensions}
          langage={t('code_version') + ` ${currentPass + 1}  (${(reponseIA.current?.["perfO" + niveau_optimisation.current]?.[currentPass] ?? "") === "inexécutable" ? t("inexecutable") : ((reponseIA.current?.["perfO" + niveau_optimisation.current]?.[currentPass] + "s") ?? "")})`}
        />
        <Editor
          editorRef={nextPass}
          extensions={nextPassExtensions}
          langage={t('code_version') + ` ${currentPass + 2} (${(reponseIA.current?.["perfO" + niveau_optimisation.current]?.[currentPass + 1] ?? "") === "inexécutable" ? t("inexecutable") : ((reponseIA.current?.["perfO" + niveau_optimisation.current]?.[currentPass + 1] + "s") ?? "")})`}
        />
      </div>

      <PassChart
        listeDiffs={reponseIA.current?.["liste_diffsO" + niveau_optimisation.current] ?? []}
        listePasses={reponseIA.current?.["liste_passesO" + niveau_optimisation.current] ?? []}
        diffAvecChangements={diffAvecChangements}
        compterChangements={compterChangements}
        added={t('added')}
        deleted={t('deleted')}
        total={t('total')}
      />

    </>
  )
}