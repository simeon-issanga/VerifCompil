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
    print(f"[GPU DEBUG] {len(lines)} lignes collectées :")
    for l in lines:
        print(f"  {repr(l)}")
    return parse_dmon_output(lines)


def parse_dmon_output(lines):
    samples = []
    headers = None  # None = pas encore vu le header

    for line in lines:
        stripped = line.strip()
        
        if stripped and not stripped.startswith("#"):
            vals = stripped.split()
            print(f"  vals={len(vals)} headers={len(headers)} → {vals[:6]}")
        
        if not stripped:
            continue

        if stripped.startswith("#"):
            cols = stripped.lstrip("#").split()
            # Ne prendre que le premier header "gpu/Idx" — ignorer les répétitions
            if headers is None and ("gpu" in cols or "Idx" in cols):
                headers = [c.lower() for c in cols]
                headers = ["gpu" if c == "idx" else c for c in headers]
            continue  # toujours skipper les lignes #

        if headers is None:
            continue

        vals = stripped.split()
        if len(vals) != len(headers):
            continue

        row = dict(zip(headers, vals))
        try:
            sample = {}
            if row.get("sm", "-") != "-":
                sample["gpu_util_pct"] = int(row["sm"])
            if row.get("mem", "-") != "-":
                sample["mem_util_pct"] = int(row["mem"])
            if row.get("pwr", "-") != "-":
                sample["power_w"] = float(row["pwr"])
            if sample:
                samples.append(sample)
        except ValueError:
            continue

    print(f"[GPU DEBUG] {len(samples)} samples valides parsés")

    if not samples:
        return None

    power_values = [s["power_w"]      for s in samples if "power_w"      in s]
    gpu_values   = [s["gpu_util_pct"] for s in samples if "gpu_util_pct" in s]
    mem_values   = [s["mem_util_pct"] for s in samples if "mem_util_pct" in s]
    duration_s   = len(samples)

    result = {"samples_count": len(samples)}
    if gpu_values:
        result["avg_gpu_util_pct"]  = round(sum(gpu_values) / len(gpu_values), 1)
        result["peak_gpu_util_pct"] = max(gpu_values)
    if mem_values:
        result["avg_mem_util_pct"]  = round(sum(mem_values) / len(mem_values), 1)
    if power_values:
        avg_power = sum(power_values) / len(power_values)
        result["avg_power_w"]   = round(avg_power, 1)
        result["peak_power_w"]  = round(max(power_values), 1)
        result["energy_joules"] = round(avg_power * duration_s, 2)

    return result


def start_perf_stat(pid):
    try:
        proc = subprocess.Popen(
            [
                "perf", "stat",
                "-e", "cycles,instructions,cache-misses,task-clock",
                "-p", str(pid),
                "--per-thread"   # surveille tous les threads du process
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True
        )
        return proc
    except FileNotFoundError:
        return None


def stop_perf_stat(proc):
    if proc is None:
        return {"error": "perf non disponible"}
    proc.terminate()
    _, stderr = proc.communicate(timeout=5)
    print(f"[PERF DEBUG] stderr :\n{stderr}")
    return parse_perf_output(stderr)


def parse_perf_output(stderr):
    result = {}

    # Avec --per-thread, il peut y avoir plusieurs lignes par métrique
    # On somme les cycles/instructions et on prend le max du elapsed
    cycles_total       = 0
    instructions_total = 0
    task_clock_total   = 0.0

    for line in stderr.splitlines():
        line = line.strip()

        m = re.search(r"([\d\s]+)\s+cycles", line)
        if m:
            cycles_total += int(m.group(1).replace(" ", "").replace(",", ""))

        m = re.search(r"([\d\s]+)\s+instructions", line)
        if m:
            instructions_total += int(m.group(1).replace(" ", "").replace(",", ""))

        m = re.search(r"([\d\s,\.]+)\s+msec\s+task-clock", line)
        if m:
            task_clock_total += float(m.group(1).replace(" ", "").replace(",", ""))

    m = re.search(r"([\d,\.]+)\s+seconds time elapsed", stderr)
    elapsed = float(m.group(1).replace(",", "")) if m else None

    if cycles_total:       result["cycles"]        = cycles_total
    if instructions_total: result["instructions"]   = instructions_total
    if task_clock_total:   result["task_clock_ms"]  = round(task_clock_total, 2)
    if elapsed:            result["elapsed_s"]       = elapsed

    if result.get("cycles", 0) > 0 and result.get("instructions", 0) > 0:
        result["ipc"] = round(result["instructions"] / result["cycles"], 3)

    return result if result else None