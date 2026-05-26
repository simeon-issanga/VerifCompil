import { tags } from "@lezer/highlight"
import { EditorView, lineNumbers, Decoration, ViewPlugin } from "@codemirror/view"
import { RangeSetBuilder } from "@codemirror/state" 


// les deux couleurs de fond alternées
const evenLine = Decoration.line({ attributes: { style: "background: #6ce7a1" } })
const oddLine  = Decoration.line({ attributes: { style: "background: #5cd5f4" } })

export const lineHighlighter = ViewPlugin.fromClass(
    class {
        constructor(view) { 
            this.decorations = this.build(view) 
        }

        update(update) {
            if (update.docChanged || update.viewportChanged)
                this.decorations = this.build(update.view)
        }

        build(view) {
            const builder = new RangeSetBuilder()
            for (const { from, to } of view.visibleRanges) {
                let pos = from
                while (pos <= to) {
                    const line = view.state.doc.lineAt(pos)
                    const deco = line.number % 2 === 0 ? evenLine : oddLine //TODO décider la couleur des lignes
                    builder.add(line.from, line.from, deco)
                    pos = line.to + 1
                }
            }
            return builder.finish()
        }
    }, 
    { decorations: v => v.decorations })
