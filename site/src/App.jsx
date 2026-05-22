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

      const donnees = await reponse.json()
      
      if (donnees.status === 'success') {
        setReponseIA(donnees.message)
      } else {
        setReponseIA("Erreur du serveur : " + donnees.message)
      }
    
    }catch (error) {
      console.error('Erreur lors de l\'envoi du code :', error)
    }
  }
  
  return (
    <>
    
      <h1>Ceci est une page de fou</h1>
      <div class="container" >
        <Encadre langage="C"/>
        <Encadre langage="IR"/>
      </div>
      <textarea 
            value={codeC}
            onChange={(e) => setCodeC(e.target.value)}
            placeholder="Entrez votre code C ici"
      />
      <button onClick={envoyer}>Envoyer</button>
           
      <div>{reponseIA}</div>
    </>
  )
}


function Encadre({langage}){


  return (
    <div>
      <div>
        <p>code en {langage}</p>
      </div>
      <input type="text"></input>
    </div>
  );
}