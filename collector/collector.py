"""Minimal cross-platform ping collector for Sprint 1."""

import os
import platform
import re
import subprocess
import time

import requests

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000/api/v1")
DEVICE_ID = int(os.getenv("DEVICE_ID", "1"))
TARGET_HOST = os.getenv("TARGET_HOST", "8.8.8.8")
INTERVAL_SECONDS = int(os.getenv("COLLECT_INTERVAL_SECONDS", "10"))


def ping(host: str) -> tuple[float | None, float]:
    is_windows = platform.system().lower() == "windows"
    command = ["ping", "-n" if is_windows else "-c", "1", host]
    completed = subprocess.run(command, capture_output=True, text=True, timeout=10, check=False)
    output = completed.stdout
    if completed.returncode != 0:
        return None, 100.0

    latency_match = re.search(r"(?:time[=<]|Average = |avg = )[\s]*(\d+(?:\.\d+)?)", output, re.IGNORECASE)
    latency = float(latency_match.group(1)) if latency_match else None
    return latency, 0.0


def collect_once() -> dict[str, float | int | None]:
    latency, packet_loss = ping(TARGET_HOST)
    payload = {
        "device_id": DEVICE_ID,
        "latency_ms": latency,
        "packet_loss_percent": packet_loss,
    }
    response = requests.post(f"{BACKEND_URL}/metrics", json=payload, timeout=10)
    response.raise_for_status()
    return response.json()


if __name__ == "__main__":
    print(f"Collecting {TARGET_HOST} every {INTERVAL_SECONDS}s for device #{DEVICE_ID}")
    while True:
        try:
            metric = collect_once()
            print(f"metric #{metric['id']}: latency={metric['latency_ms']} ms")
        except (requests.RequestException, subprocess.SubprocessError) as error:
            print(f"collector error: {error}")
        time.sleep(INTERVAL_SECONDS)
