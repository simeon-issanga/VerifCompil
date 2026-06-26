import subprocess
import threading

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