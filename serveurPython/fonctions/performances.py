import subprocess  # pour lancer nvidia-smi comme processus externe
import threading   # pour lire la sortie de nvidia-smi sans bloquer Flask
import time
import numpy as np

def start_gpu_monitor():
    """
    Lance nvidia-smi en mode surveillance continue (dmon) en arrière-plan.
    Retourne le processus, la liste des lignes collectées, et le thread de lecture.
    Ces trois objets sont nécessaires pour arrêter proprement la surveillance via stop_gpu_monitor().
    """

    # Lance nvidia-smi dmon
    proc = subprocess.Popen(
        ["nvidia-smi", "dmon", "-s", "pucvmet", "-d", "1"],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True
    )

    lines = []  # stocke toutes les lignes produites par dmon pendant l'inférence

    def _reader():
        # lit stdout ligne par ligne
        for line in proc.stdout:
            # Horodatage précis au moment exact où la ligne est reçue
            lines.append((time.perf_counter(), line.rstrip())) # rstrip() supprime le \n final

    t = threading.Thread(target=_reader, daemon=True)
    t.start()

    return proc, lines, t

def stop_gpu_monitor(proc, lines, reader_thread):
    """
    Arrête la surveillance GPU et retourne les statistiques.
    Doit être appelé après la fin de l'inférence.
    """
    proc.terminate() # arrête nvidia-smi
    proc.wait() # Attend que le processus nvidia-smi soit bien terminé avant de lire
    reader_thread.join(timeout=2) # Attend que le thread de lecture ait fini de consommer le reste du pipe

    return parse_dmon_output(lines)

def parse_dmon_output(lines):
    """
    Parse les lignes brutes de nvidia-smi dmon et calcule les statistiques

    dmon produit deux lignes de header puis des lignes de données, par exemple :
        # gpu    pwr   sm   mem  ...
        # Idx      W    %     %  ...
            0    407   88    87  ...
            0    406   84    82  ...

    Le header se répète périodiquement — on ne garde que le premier.
    Les valeurs "-" indiquent une métrique non disponible sur ce GPU.
    """
    
    samples = []
    headers = None  # None = header pas encore rencontré

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        if stripped.startswith("#"):
            cols = stripped.lstrip("#").split() #On récupère le nom des colonnes dans un tableau

            # On ne retient que la première ligne de header qui contient "gpu" ou "Idx"
            if headers is None and ("gpu" in cols or "Idx" in cols):
                headers = [c.lower() for c in cols]
                headers = ["gpu" if c == "idx" else c for c in headers] # Normalise "idx" en "gpu" pour uniformiser l'accès au dict
            continue

        # Ignore les lignes de données qui arrivent avant le premier header
        if headers is None:
            continue

        vals = stripped.split()

        # Rejette les lignes dont le nombre de colonnes ne correspond pas au header
        if len(vals) != len(headers):
            continue

        # Construit un dict {nom_colonne: valeur} pour accéder par nom plutôt que par indice
        row = dict(zip(headers, vals))

        try:
            sample = {"timestamp": np.timestamp}  # TODO : finir (corriger import numpy puis utiliser le timestamp pour le calcul integral)

            # sm = Streaming Multiprocessor utilization. rprésente le pourcentage de temps où le GPU exécutait des kernels de calcul
            if row.get("sm", "-") != "-":
                sample["gpu_util_pct"] = int(row["sm"])

            # mem = Memory bandwidth utilization. represente le pourcentage de saturation du bus entre GPU et VRAM
            if row.get("mem", "-") != "-":
                sample["mem_util_pct"] = int(row["mem"])

            # pwr = Power draw instantané en Watts
            if row.get("pwr", "-") != "-":
                sample["power_w"] = float(row["pwr"])

            # N'ajoute le sample que s'il contient au moins une métrique valide
            if len(sample) > 1:  # > 1 car timestamp est toujours présent
                samples.append(sample)

        except ValueError:
            continue

    # Aucune donnée collectée
    if not samples:
        return None

    # Extrait chaque métrique dans sa propre liste
    power_values = [s["power_w"]      for s in samples if "power_w"      in s]
    gpu_values   = [s["gpu_util_pct"] for s in samples if "gpu_util_pct" in s]
    mem_values   = [s["mem_util_pct"] for s in samples if "mem_util_pct" in s]
    timestamps   = [s["timestamp"]    for s in samples if "power_w"      in s]

    # duration_s : durée totale de l'inférence en secondes. Avec -d 1, chaque sample représente 1 seconde
    duration_s = len(samples)

    result = {"samples_count": len(samples)}

    if gpu_values:
        result["avg_gpu_util_pct"]  = round(sum(gpu_values) / len(gpu_values), 1)
        result["peak_gpu_util_pct"] = max(gpu_values)

    if mem_values:
        result["avg_mem_util_pct"] = round(sum(mem_values) / len(mem_values), 1)

    if power_values and len(power_values) >= 2:
        t = np.array(timestamps)
        p = np.array(power_values)
        
        # Intégration trapézoïdale
        energy_joules = float(np.trapezoid(p, t))
        
        # Durée réelle entre le premier et le dernier sample
        duration_s = t[-1] - t[0]

        result["avg_power_w"]   = round(float(np.mean(p)), 1)
        result["peak_power_w"]  = round(float(np.max(p)), 1)
        result["energy_joules"] = round(energy_joules, 2)
        result["duration_s"]    = round(duration_s, 2)

    elif power_values: #si il n'y a qu'un sample
        result["avg_power_w"]   = round(power_values[0], 1)
        result["peak_power_w"]  = round(power_values[0], 1)
        # Énergie en Joules = puissance moyenne (W) × durée (s)
        result["energy_joules"] = 0.0

    return result