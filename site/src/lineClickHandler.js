import { ViewPlugin, EditorView, Decoration } from "@codemirror/view"
import { RangeSetBuilder } from "@codemirror/state"


export const lineHoverHighlighter = ViewPlugin.fromClass( //méthode statique qui prend la classe et l'enregistre auprès de l'éditeur
    //déclaration d'une classe anonyme
    class {
        constructor(view) { //CM6 passe automatiquement la EditorView en argument
            this.hoveredLine = null
            this.decorations = this.build(view) // attribut imposé par CM6 — c'est lui qu'il lit pour savoir quoi afficher
        }

        update(update) { //Méthode imposée par CM6 — si elle existe sur la classe, CM6 l'appelle automatiquement après chaque transaction (scroll, click, ...). update est un objet ViewUpdate
            if (update.docChanged || update.viewportChanged)
                this.decorations = this.build(update.view)
        }

        setHoveredLine(view, lineNumber) { //lineClickHandler l'appellera via view.plugin(lineHoverHighlighter) pour dire au plugin quelle ligne est survolée.
            this.hoveredLine = lineNumber
            this.decorations = this.build(view)
        }

        build(view) { //Calcule et retourne un RangeSet — la liste de toutes les décorations à appliquer.
            const builder = new RangeSetBuilder()
            for (const { from, to } of view.visibleRanges) {
                let pos = from
                while (pos <= to) {
                    const line = view.state.doc.lineAt(pos)
                    const isHovered = line.number === this.hoveredLine
                    builder.add(
                        line.from, 
                        line.from, 
                        Decoration.line({ attributes: { style: isHovered ? "background: #111111" : "" } }) //Méthode statique de CM6 qui crée une décoration de type "ligne entière"
                    )
                    pos = line.to + 1
                }
            }
            return builder.finish() //retourne le RangeSet final
        }

    }, 
    { decorations: v => v.decorations })


export const lineClickHandler = EditorView.domEventHandlers({ //méthode statique qui crée une extension écoutant les événements DOM

    click(event, view) {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (pos === null) return
        const line = view.state.doc.lineAt(pos)
        console.log(`clic sur la ligne ${line.number} : "${line.text}"`)
    },

    mousemove(event, view) {
        console.log(`la souris bouge`);
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        const plugin = view.plugin(lineHoverHighlighter)
        if (!plugin) return

        if (pos === null) {
            plugin.setHoveredLine(view, null)
        } else {
            const line = view.state.doc.lineAt(pos)
            plugin.setHoveredLine(view, line.number)
        }
        view.dispatch({})
    },

    mouseleave(event, view) {
        console.log(`la souris quitte`);
        const plugin = view.plugin(lineHoverHighlighter)
        if (plugin) {
            plugin.setHoveredLine(view, null)
            view.dispatch({})
        }
    }
    
})