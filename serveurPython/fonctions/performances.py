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
    """
    dmon produit des lignes comme :
    # gpu   pwr  gtemp  mtemp    sm   mem   enc   dec  mclk  pclk
        0   145     72      -    87    91     0     0  9501  1980
    """
    samples = []
    for line in lines:
        if line.startswith("#") or not line.strip():
            continue
        vals = line.split()
        if len(vals) < 6:
            continue
        try:
            samples.append({
                "gpu_util_pct": int(vals[3]),   # sm  = shader/compute
                "mem_util_pct": int(vals[4]),   # mem = bande passante
                "power_w":      float(vals[1]), # pwr = watts
            })
        except ValueError:
            continue

    if not samples:
        return None

    power_values = [s["power_w"] for s in samples]
    duration_s   = len(samples)  # 1 sample/sec avec -d 1

    return {
        "samples_count":    len(samples),
        "avg_gpu_util_pct": round(sum(s["gpu_util_pct"] for s in samples) / len(samples), 1),
        "avg_mem_util_pct": round(sum(s["mem_util_pct"] for s in samples) / len(samples), 1),
        "peak_gpu_util_pct":max(s["gpu_util_pct"] for s in samples),
        "avg_power_w":      round(sum(power_values) / len(power_values), 1),
        "peak_power_w":     round(max(power_values), 1),
        "energy_joules":    round(sum(power_values) * duration_s / len(power_values) * duration_s, 2),
        # énergie ≈ puissance_moy × durée
    }


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
    """Arrête perf stat et parse sa sortie stderr."""
    proc.terminate()
    proc.wait()
    stderr = proc.stderr.read()
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


