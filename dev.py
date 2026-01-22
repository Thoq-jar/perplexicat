import subprocess
import signal
import sys

flask_process = None
vite_process = None


def cleanup(signum=None, frame=None) -> None:
    print("\nShutting down...")
    if flask_process:
        flask_process.terminate()
    if vite_process:
        vite_process.terminate()
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    print("Starting Flask backend...")
    flask_process = subprocess.Popen(["python", "run.py"])

    print("Starting Vite dev server...")
    vite_process = subprocess.Popen(["pnpm", "dev"], cwd="frontend")

    print()
    print("Flask running on http://localhost:5001")
    print("Vite running on http://localhost:5173")
    print()
    print("Press Ctrl+C to stop both servers")

    try:
        flask_process.wait()
        vite_process.wait()
    except KeyboardInterrupt:
        cleanup()
