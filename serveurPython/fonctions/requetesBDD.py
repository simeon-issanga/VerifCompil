import psycopg2
import os

def connexion():
    try :
        laConnexion = psycopg2.connect(
            
        )
        return laConnexion
    
    except psycopg2.Error as err :
        print("pb co") 
        return None

def envoyerDonnes(laConnexion,donnees):
    if laConnexion is None:
        print("pb connexion bdd")
        return None 

