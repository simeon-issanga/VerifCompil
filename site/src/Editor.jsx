import { useEffect, useRef } from "react"
import { EditorState, RangeSetBuilder } from "@codemirror/state"
import { EditorView, keymap, lineNumbers, Decoration, ViewPlugin   } from "@codemirror/view"
import { defaultKeymap, historyKeymap, history } from "@codemirror/commands"
import { cpp } from "@codemirror/lang-cpp"
import {irLanguage, irHighlight} from "./IRLanguage"
import { tags } from "@lezer/highlight"
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from "@codemirror/language"


export default function Editor({ editorRef, doc="",extensions, langage }) {
    
    const containerRef = useRef(null)

    //charge l'editeur dès que le DOM est prêt
    useEffect(() => {
        const view = new EditorView({
            state : EditorState.create({ 
                doc,
                extensions }),
            parent: containerRef.current,
        })

        // on expose la view au parent via la ref
        editorRef.current = view

        return () => {
            view.destroy()
            editorRef.current = null
        }
    }, [])

    return(
        <div>
        <h2>code en {langage}</h2>
        <div ref={containerRef} />
        </div>
    )
}