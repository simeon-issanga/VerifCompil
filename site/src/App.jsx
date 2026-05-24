import { useState } from 'react'
import './App.css'

export default function App() {
  const [codeC, setCodeC] = useState('')
  const [reponseIA, setReponseIA] = useState('')
  
  const envoyer = async() => {
    try {
      const reponse = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeC })
        })

      const texteBrut = await reponse.text()
      
      try {
        const donnees = JSON.parse(texteBrut)
        if (donnees.status === 'success') {
            setReponseIA(JSON.stringify(donnees, null, 3))
        } else {
            setReponseIA("Erreur du serveur : " + donnees.message)
        }

      } catch (erreurParse) {
        // 4. Si la transformation plante (ce n'est pas du JSON), on affiche l'erreur brute
        setReponseIA("Erreur inattendue (Nginx ou plantage Flask) :\n\n" + texteBrut)
      }
    
    }catch (error) {
      setReponseIA('Erreur de réseau ou serveur injoignable : ' + error.message)
    }
  }
  
  return (
    <>
      <h1>Ceci est une page de fou</h1>
      <div className="flex-container" >
        <Encadre langage="C" placeholder="entrer votre code C ici" onChange={(e) => setCodeC(e.target.value)} />
        <Encadre langage="IR"/>
      </div>
      <button onClick={envoyer}>Traduire</button>
      <div>{reponseIA}</div>
      
    </>
  )
}


function Encadre({langage, placeholder, onChange}){


  return (
    <div>
      <div>
        <h2>code en {langage}</h2>
      </div>
      <textarea placeholder={placeholder} onChange={onChange}></textarea>
    </div>
  );
}