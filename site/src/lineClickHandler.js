import { ViewPlugin, EditorView, Decoration } from "@codemirror/view"
import { RangeSetBuilder } from "@codemirror/state"

// on stocke la référence au plugin créé pour que lineClickHandler puisse y accéder
let pluginRefs = new Map()

export function createLineHoverHighlighter(lesCouleurs, lesExplications, tabNumLignesCodeIR, setExplication, editorKey, editeurJumeau) {
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

        setHoveredLine(view, lineNumber) { //lineClickHandler l'appellera via view.plugin(lineHoverHighlighter) pour dire au plugin quelle ligne est survolée.
            
            if (lineNumber !== []){
                var numBloc = 0;
                for (let indiceBloc in tabNumLignesCodeIR){
                    for (let ligne of tabNumLignesCodeIR[indiceBloc]){
                        if (lineNumber === ligne){
                            this.hoveredLine = tabNumLignesCodeIR[indiceBloc];
                            numBloc = indiceBloc;
                        }
                    }
                }
            } else {
                this.hoveredLine = [];
            }
            console.log(this.hoveredLine);
            
            //this.hoveredLine = lineNumber
            this.decorations = this.build(view)

            if (lineNumber !== []) {
                setExplication(lesExplications[numBloc] ?? '')
            } else {
                setExplication('');
            }
        }

        build(view) { //Calcule et retourne un RangeSet — la liste de toutes les décorations à appliquer.
            const builder = new RangeSetBuilder()
            for (const { from, to } of view.visibleRanges) {
                let pos = from
                while (pos <= to) {
                    const line = view.state.doc.lineAt(pos);
                    const deco = lesCouleurs[line.number-1]
                    const isHovered = this.hoveredLine.includes(line.number);
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

export const lineClickHandler = EditorView.domEventHandlers({ //méthode statique qui crée une extension écoutant les événements DOM

    click(event, view) {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (pos === null) return
        const line = view.state.doc.lineAt(pos)
        console.log(`clic sur la ligne ${line.number} : "${line.text}"`)
    },

    mousemove(event, view) {
        if (!pluginRefs) return  // pas encore de plugin créé
        for (const [key, pluginRef] of pluginRefs) {
            const plugin = view.plugin(pluginRef)
            if (plugin) {  // ← null si pas le bon, instance si c'est le bon
                const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
            if (pos === null) {
                plugin.setHoveredLine(view, [])
            } else {
                const line = view.state.doc.lineAt(pos)
                plugin.setHoveredLine(view, line.number)
            }
            view.dispatch({})
            break
            }
        }
    },








    //TODO : quand on quitte, il reste une selection en blanc et la première explication (indice0) apparaît
    mouseleave(event, view) {
        console.log(`la souris quitte`);
        for (const [key, pluginRef] of pluginRefs) {
            const plugin = view.plugin(pluginRef)
            if (plugin) {
                plugin.setHoveredLine(view, [])
                view.dispatch({})
            }
        }
    }

})