import { ViewPlugin, EditorView, Decoration } from "@codemirror/view"
import { RangeSetBuilder } from "@codemirror/state"

let pluginRefs = new Map() // contient la référence de chaque plugin créé avec createLineHoverHighlighter

let blocHoverInput = []   // lignes C survolées
let blocHoverOutput = []  // lignes IR survolées
let blocClicInput = []    // lignes C du clic
let blocClicOutput = []   // lignes IR du clic
let explicClic = ''       // explication figée par le clic

export function createLineHoverHighlighter(lesCouleurs, lesExplications,tabNumLignesCodeC, tabNumLignesCodeIR, setExplication, editorKey, inputRef, outputRef) {
  const plugin = ViewPlugin.fromClass( //méthode statique qui prend la classe et l'enregistre auprès de l'éditeur
    //déclaration d'une classe anonyme
    class {
        constructor(view) { //CM6 passe automatiquement la EditorView en argument
            this.hoveredLine = []
            this.decorations = this.build(view) // attribut imposé par CM6 — c'est lui qu'il lit pour savoir quoi afficher
        }

        update(update) { //Méthode imposée par CM6 — si elle existe sur la classe, CM6 l'appelle automatiquement après chaque transaction (scroll, click, ...). update est un objet ViewUpdate
            if (update.docChanged || update.viewportChanged)
                this.decorations = this.build(update.view)
        }

        setHoveredLine(view, lineNumber) {
            if (lineNumber !== null) {
                //on cherche dans quel bloc se trouve la ligne survolée
                let numBloc
                if (editorKey === 'output') {
                    for (let i in tabNumLignesCodeIR) {
                        if (tabNumLignesCodeIR[i].includes(lineNumber)) {
                            numBloc = i
                            break
                        }
                    }
                } else {
                    numBloc = lineNumber - 1
                }
                blocHoverInput  = tabNumLignesCodeC[numBloc] ?? []
                blocHoverOutput = tabNumLignesCodeIR[numBloc] ?? []
                // explication : on affiche celle du hover seulement si rien n'est cliqué
                if (explicClic === '') setExplication(lesExplications[numBloc] ?? '')

            } else {
                blocHoverInput  = []
                blocHoverOutput = []
                setExplication(explicClic)
            }

            // mettre à jour les deux éditeurs
            this.decorations = this.build(view)
            const autreView = editorKey === 'output' ? inputRef : outputRef
            const autrePlugin = trouverPlugin(autreView.current)
            if (autrePlugin) {
                autrePlugin.decorations = autrePlugin.build(autreView.current)
                autreView.current.dispatch({})
            }
            view.dispatch({})
        }

        //même principe que pour setHoveredLine mais met à jour l'explication et les variables blocClic au lieu de blocHover
        setClickedLine(view, lineNumber) {
            let numBloc
            if (editorKey === 'output') {
                for (let i in tabNumLignesCodeIR) {
                    if (tabNumLignesCodeIR[i].includes(lineNumber)) {
                        numBloc = i;
                        break
                    }
                }
            } else {
                numBloc = lineNumber - 1;
            }
            blocClicInput  = tabNumLignesCodeC[numBloc] ?? [];
            blocClicOutput = tabNumLignesCodeIR[numBloc] ?? [];
            explicClic = lesExplications[numBloc] ?? '';
            setExplication(explicClic)

            this.decorations = this.build(view)
            const autreView = editorKey === 'output' ? inputRef : outputRef
            const autrePlugin = trouverPlugin(autreView.current)
            if (autrePlugin) {
                autrePlugin.decorations = autrePlugin.build(autreView.current)
                autreView.current.dispatch({})
            }
            view.dispatch({})
        }




        build(view) { //Calcule et retourne un RangeSet — la liste de toutes les décorations à appliquer.
            const builder = new RangeSetBuilder()
            for (const { from, to } of view.visibleRanges) {
                let pos = from
                //on défini le style de chaque ligne. Si elle est survolée ou cliquée -> fond blanc, sinon, son fond par défaut (venant de la liste lesCouleurs)
                while (pos <= to) {
                    const line = view.state.doc.lineAt(pos);
                    const deco = lesCouleurs[line.number-1]
                    const blocHover = editorKey === 'input' ? blocHoverInput : blocHoverOutput;
                    const blocClic  = editorKey === 'input' ? blocClicInput  : blocClicOutput;
                    const isHovered = blocHover.includes(line.number) || blocClic.includes(line.number);        
                    builder.add(
                        line.from, 
                        line.from, 
                        Decoration.line({ attributes: { style: isHovered ? "background: #ffffff" : deco } }) //Méthode statique de CM6 qui crée une décoration de type "ligne entière"
                    )
                    pos = line.to + 1
                }
            }
            return builder.finish() //retourne le RangeSet final
        }


    }, 
    { decorations: v => v.decorations })

    pluginRefs.set(editorKey, plugin)  // clé unique par éditeur
    return plugin
}

export function createLineDiffHiglighter(editorKey, passDiff){
    const plugin = ViewPlugin.fromClass( //méthode statique qui prend la classe et l'enregistre auprès de l'éditeur
    //déclaration d'une classe anonyme
    class {
        constructor(view) { //CM6 passe automatiquement la EditorView en argument
            this.currentDiff = 0
            this.decorations = this.setUpdatedLines(view, 0) // attribut imposé par CM6 — c'est lui qu'il lit pour savoir quoi afficher
        }

        update(update) { //Méthode imposée par CM6 — si elle existe sur la classe, CM6 l'appelle automatiquement après chaque transaction (scroll, click, ...). update est un objet ViewUpdate
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.setUpdatedLines(update.view, this.currentDiff)
            }
        }

        setUpdatedLines(view, currentDif) {
            this.currentDiff = currentDif
            const builder = new RangeSetBuilder()

            if (currentDif === null || !passDiff?.[currentDif])
                return builder.finish()

            const lignesDiff = passDiff[currentDif].split("\n") //on créé un tableau avec pour chaque élément une ligne de Diff

            // couleurParLigneDoc[i] = couleur de la ligne i+1 du document
            const couleurParLigneDoc = []

            // numéro de ligne courant dans le fichier previous et next
            let lignePrevious = 0
            let ligneNext = 0

            for (const ligneDiff of lignesDiff) {
                // on ignore les en-têtes --- et +++ 
                if (ligneDiff.startsWith('---') || ligneDiff.startsWith('+++'))
                    continue

                // ligne @@ : on extrait les numéros de départ
                // format : @@ -startP,countP +startN,countN @@
                if (ligneDiff.startsWith('@@')) {
                    const match = ligneDiff.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
                    console.log(match)
                    if (match) {
                        lignePrevious = parseInt(match[1])  // ligne de départ dans previous
                        ligneNext     = parseInt(match[2])  // ligne de départ dans next
                    }
                    continue
                }

                const symbole = ligneDiff[0]

                if (symbole === '-') {
                    // ligne supprimée — seulement dans previous
                    if (editorKey === 'previous') {
                        couleurParLigneDoc[lignePrevious - 1] = "background: #ff000060"
                    }
                    lignePrevious++

                } else if (symbole === '+') {
                    // ligne ajoutée — seulement dans next
                    if (editorKey === 'next') {
                        couleurParLigneDoc[ligneNext - 1] = "background: #00ff2660"
                    }
                    ligneNext++

                } else if (symbole === ' ') {
                    // ligne inchangée — présente dans les deux
                    if (editorKey === 'previous') {
                        couleurParLigneDoc[lignePrevious - 1] = "background: #ffffff20"
                    } else {
                        couleurParLigneDoc[ligneNext - 1] = "background: #ffffff20"
                    }
                    lignePrevious++
                    ligneNext++
                }
            }

            for (const { from, to } of view.visibleRanges) {
                let pos = from
                while (pos <= to) {
                    const line = view.state.doc.lineAt(pos)
                    const color = couleurParLigneDoc[line.number - 1] ?? "background: #ffffff20"
                    builder.add(line.from, line.from,
                        Decoration.line({ attributes: { style: color } })
                    )
                    pos = line.to + 1
                }
            }

            return builder.finish()
        }

    }, 
    { decorations: v => v.decorations })

    pluginRefs.set(editorKey, plugin)  // clé unique par éditeur
    return plugin

}


export const lineClickHandler = EditorView.domEventHandlers({ //méthode statique qui crée une extension écoutant les événements DOM

    click(event, view) {
        const plugin = trouverPlugin(view)
        if (!plugin) return
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (pos == null) return
        const line = view.state.doc.lineAt(pos)
        plugin.setClickedLine(view, line.number)
    },

    mousemove(event, view) {
        if (!pluginRefs) return  // pas encore de plugin créé
        var plugin = trouverPlugin(view)
        if (plugin) {
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
            if (pos == null) {
                plugin.setHoveredLine(view, null)
            } else {
                const line = view.state.doc.lineAt(pos)
                plugin.setHoveredLine(view, line.number)
            }
            view.dispatch({})
        }
    },

    mouseleave(event, view) {
        const plugin = trouverPlugin(view)
        if (plugin) {
            plugin.setHoveredLine(view, null)
        }
    }

})

export function requestUpdateLines(view, currentDif) {
    const plugin = trouverPlugin(view)
    if (plugin) {
        plugin.decorations = plugin.setUpdatedLines(view, currentDif)  // ← assigner
        view.dispatch({})
    }
}

function trouverPlugin(view) {
    for (const [key, pluginRef] of pluginRefs) {
        const plugin = view.plugin(pluginRef)
        if (plugin) return plugin
    }
    return null
}
