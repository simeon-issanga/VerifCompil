import subprocess
import threading
import re

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
    headers = None

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        if stripped.startswith("#"):
            cols = stripped.lstrip("#").split()
            if headers is None and ("gpu" in cols or "Idx" in cols):
                headers = [c.lower() for c in cols]
                headers = ["gpu" if c == "idx" else c for c in headers]
            continue

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
                "--per-thread"
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
    return parse_perf_output(stderr)

def parse_perf_output(stderr):
    """
    Avec --per-thread, chaque ligne ressemble à :
        flask-1      409107      cycles
        flask-1        0.63 msec task-clock
    On agrège toutes les valeurs par métrique.
    """
    result = {}
    totals = {
        "cycles":       0,
        "instructions": 0,
        "cache_misses": 0,
        "task_clock_ms": 0.0,
    }

    for line in stderr.splitlines():
        line = line.strip()

        # Retire le préfixe thread (ex: "flask-1") s'il est présent
        # Format : "<thread-name>   <valeur>   <métrique>"
        # ou sans thread : "   <valeur>   <métrique>"
        m = re.match(r'^[\w\-]+\s+(.*)', line)
        normalized = m.group(1).strip() if m else line

        # cycles
        m = re.search(r'^([\d\s,]+)\s+cycles', normalized)
        if m:
            totals["cycles"] += int(m.group(1).replace(" ", "").replace(",", ""))
            continue

        # instructions
        m = re.search(r'^([\d\s,]+)\s+instructions', normalized)
        if m:
            totals["instructions"] += int(m.group(1).replace(" ", "").replace(",", ""))
            continue

        # cache-misses
        m = re.search(r'^([\d\s,]+)\s+cache-misses', normalized)
        if m:
            totals["cache_misses"] += int(m.group(1).replace(" ", "").replace(",", ""))
            continue

        # task-clock (en msec)
        m = re.search(r'^([\d\s,\.]+)\s+msec\s+task-clock', normalized)
        if m:
            totals["task_clock_ms"] += float(m.group(1).replace(" ", "").replace(",", ""))
            continue

    # elapsed time — ligne sans préfixe thread
    elapsed = None
    m = re.search(r'([\d\.]+)\s+seconds time elapsed', stderr)
    if m:
        elapsed = float(m.group(1))

    if totals["cycles"]:        result["cycles"]         = totals["cycles"]
    if totals["instructions"]:  result["instructions"]   = totals["instructions"]
    if totals["cache_misses"]:  result["cache_misses"]   = totals["cache_misses"]
    if totals["task_clock_ms"]: result["task_clock_ms"]  = round(totals["task_clock_ms"], 2)
    if elapsed:                 result["elapsed_s"]       = elapsed

    if result.get("cycles", 0) > 0 and result.get("instructions", 0) > 0:
        result["ipc"] = round(result["instructions"] / result["cycles"], 3)

    return result if result else None