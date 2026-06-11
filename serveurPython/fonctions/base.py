import subprocess
import os
from pathlib import Path

def executer(commande, timeout=15):
    try:
        res = subprocess.run(commande, capture_output=True, text=True, timeout=timeout)
        return res
    except subprocess.TimeoutExpired:
        return None
    except Exception as e:
        return str(e)


def difference_entre_passes(file1, file2):
    commande_diff = ["diff", "-u", file1, file2]

    try:
        result = subprocess.run(commande_diff, capture_output=True, text=True)
        return result.stdout 
    except Exception as e:
        return f"Erreur diff : {str(e)}"
