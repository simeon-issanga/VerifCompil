import { useState } from 'react'
import './App.css'

export default function App() {

  return (
    <>
      <h1>Ceci est une page de fou</h1>
      <div class="container" >
        <Encadre langage="C"/>
        <Encadre langage="IR"/>
      </div>
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