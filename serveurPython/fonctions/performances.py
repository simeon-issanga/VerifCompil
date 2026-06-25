import subprocess
import threading
import re

#Fonctions pour surveiller l'utilisation du GPU
def start_gpu_monitor():
    proc = subprocess.Popen(
        ["nvidia-smi", "dmon", "-s", "pucvmet", "-d", "1"],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True
    )
    lines = []
    def _reader():
        for line in proc.stdout:
            lines.append(line.rstrip())
    t = threading.Thread(target=_reader, daemon=True)
    t.start()
    return proc, lines, t

def stop_gpu_monitor(proc, lines, reader_thread):
    proc.terminate()
    proc.wait()
    reader_thread.join(timeout=2)
    return parse_dmon_output(lines)

def parse_dmon_output(lines):
    samples = []
    headers = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Ligne de header : commence par "# gpu" ou "# Id"
        if stripped.startswith("#"):
            # Nettoie le # et récupère les noms de colonnes
            headers = stripped.lstrip("#").split()
            continue

        if not headers:
            continue

        vals = stripped.split()
        if len(vals) != len(headers):
            continue

        row = dict(zip(headers, vals))
        try:
            sample = {}
            # sm = shader/compute utilization
            if "sm" in row and row["sm"] != "-":
                sample["gpu_util_pct"] = int(row["sm"])
            # mem = memory bandwidth utilization
            if "mem" in row and row["mem"] != "-":
                sample["mem_util_pct"] = int(row["mem"])
            # pwr = power draw
            if "pwr" in row and row["pwr"] != "-":
                sample["power_w"] = float(row["pwr"])

            if sample:
                samples.append(sample)
        except ValueError:
            continue

    print(f"[GPU DEBUG] {len(samples)} samples valides parsés")

    if not samples:
        return None

    power_values  = [s["power_w"]      for s in samples if "power_w"      in s]
    gpu_values    = [s["gpu_util_pct"] for s in samples if "gpu_util_pct" in s]
    mem_values    = [s["mem_util_pct"] for s in samples if "mem_util_pct" in s]
    duration_s    = len(samples)

    result = {"samples_count": len(samples)}
    if gpu_values:
        result["avg_gpu_util_pct"]  = round(sum(gpu_values) / len(gpu_values), 1)
        result["peak_gpu_util_pct"] = max(gpu_values)
    if mem_values:
        result["avg_mem_util_pct"]  = round(sum(mem_values) / len(mem_values), 1)
    if power_values:
        avg_power = sum(power_values) / len(power_values)
        result["avg_power_w"]    = round(avg_power, 1)
        result["peak_power_w"]   = round(max(power_values), 1)
        result["energy_joules"]  = round(avg_power * duration_s, 2)

    return result


#Fonctions pour surveiller l'utilisation du CPU
def start_perf_stat(pid):
    """Attache perf stat au PID donné."""
    proc = subprocess.Popen(
        ["perf", "stat", "-p", str(pid),"-e", "cycles,instructions,cache-misses,cache-references,task-clock"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,   # perf stat écrit sur stderr
        text=True
    )
    return proc

def stop_perf_stat(proc):
    if proc is None:
        return {"error": "perf non disponible"}
    proc.terminate()
    # communicate() gère le drain du pipe ET attend la fin — pas de deadlock
    _, stderr = proc.communicate(timeout=5)
    print(f"[PERF DEBUG] stderr :\n{stderr}")
    return parse_perf_output(stderr)

def parse_perf_output(stderr):
    """
    perf stat produit sur stderr :
        1,234,567,890      cycles
        847,291,033      instructions    #  0.69  insn per cycle
        142.35 msec  task-clock
    """
    result = {}
    patterns = {
        "cycles":           r"([\d,]+)\s+cycles",
        "instructions":     r"([\d,]+)\s+instructions",
        "cache_misses":     r"([\d,]+)\s+cache-misses",
        "cache_references": r"([\d,]+)\s+cache-references",
        "task_clock_ms":    r"([\d,\.]+)\s+msec\s+task-clock",
        "elapsed_s":        r"([\d,\.]+)\s+seconds time elapsed",
    }
    for key, pattern in patterns.items():
        m = re.search(pattern, stderr)
        if m:
            val = m.group(1).replace(",", "")
            result[key] = float(val) if "." in val else int(val)

    if "instructions" in result and "cycles" in result and result["cycles"] > 0:
        result["ipc"] = round(result["instructions"] / result["cycles"], 3)

    return result if result else None