import React from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function PassChart({ listeDiffs, listePasses, diffAvecChangements, compterChangements, added, deleted, total, title }) {

    //data est un array d'objets, qui, pour chaque pass, donne le nombre total de ligne, le nombre de suppression / ajouts et le numéro du pass
    const data = listeDiffs.map((diff, i) => {
        const { ajouts, suppressions } = compterChangements(listeDiffs,i)
        const nbLignes = (listePasses[i+1] ?? '').split('\n').length
        return {
            pass: i+1,
            ajouts,
            suppressions,
            nbLignes,
        }
    })

    return (
        <>
            <h3>{title}</h3>
            <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <XAxis dataKey="pass" label={{ value: 'Pass', position: 'insideBottom', offset: -1 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="linear" dataKey="ajouts" stroke="#00ff26" dot={false} name={added} />
                    <Line type="linear" dataKey="suppressions" stroke="#ff4444" dot={false} name={deleted} />
                    <Line type="linear" dataKey="nbLignes" stroke="#7c6af7" dot={false} name={total} />
                </LineChart>
            </ResponsiveContainer>
        </>
    )
}