import { tags } from "@lezer/highlight"
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from "@codemirror/language"

export const irLanguage = StreamLanguage.define({
    token(stream) {
        // commentaires
        if (stream.match(/;.*/)) return "comment"

        // mots-clés : define, declare, ret, br, call...
        if (stream.match(/\b(define|declare|ret|br|call|alloca|load|store|add|sub|mul|icmp|phi|label|global|constant|type|void|i1|i8|i16|i32|i64|float|double|ptr)\b/))
        return "keyword"

        // labels (%nom:)
        if (stream.match(/%[\w.]+:/)) return "labelName"

        // variables locales (%var)
        if (stream.match(/%[\w.]+/)) return "variableName"

        // variables globales (@func)
        if (stream.match(/@[\w.]+/)) return "function"

        // nombres
        if (stream.match(/-?\d+(\.\d+)?([eE][+-]?\d+)?/)) return "number"

        // strings
        if (stream.match(/"[^"]*"/)) return "string"

        stream.next()
        return null
    }
})

export const irHighlight = HighlightStyle.define([
    { tag: tags.comment,       color: "#6a737d" },
    { tag: tags.keyword,       color: "#c678dd" },
    { tag: tags.labelName,     color: "#e5c07b" },
    { tag: tags.variableName,  color: "#e06c75" },
    { tag: tags.function,      color: "#61afef" },
    { tag: tags.number,        color: "#d19a66" },
    { tag: tags.string,        color: "#98c379" },
])

