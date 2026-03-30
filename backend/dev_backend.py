import json
import os
import socket
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen


PROBE_HOST = os.getenv("DEV_BACKEND_PROBE_HOST", "127.0.0.1")
BIND_HOST = os.getenv("DEV_BACKEND_BIND_HOST", "0.0.0.0")
PORT = int(os.getenv("DEV_BACKEND_PORT", "8000"))
HEALTH_URL = f"http://{PROBE_HOST}:{PORT}/api/health"


def port_is_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1.0)
        return sock.connect_ex((host, port)) == 0


def existing_backend_is_hyzync() -> bool:
    try:
        with urlopen(HEALTH_URL, timeout=2) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return payload.get("service") == "hyzync-api"
    except (URLError, TimeoutError, ValueError, OSError):
        return False


def hold_reused_process() -> int:
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        print("[dev-backend] Reuse sentinel stopped.")
        return 0


def main() -> int:
    if port_is_open(PROBE_HOST, PORT):
        if existing_backend_is_hyzync():
            print(
                f"[dev-backend] Reusing existing Hyzync backend at "
                f"http://{PROBE_HOST}:{PORT}"
            )
            return hold_reused_process()

        print(
            f"[dev-backend] Port {PORT} is already in use by a different process. "
            f"Stop that process or set DEV_BACKEND_PORT/VITE_BACKEND_PORT to another port."
        )
        return 1

    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "main:app",
        "--host",
        BIND_HOST,
        "--port",
        str(PORT),
    ]
    if os.getenv("DEV_BACKEND_RELOAD", "").strip().lower() in {"1", "true", "yes", "on"}:
        cmd.append("--reload")

    print(
        f"[dev-backend] Starting Hyzync backend on "
        f"http://{PROBE_HOST}:{PORT}"
    )
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
