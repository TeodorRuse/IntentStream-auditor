FROM python:3.12-slim

# Install ADB — we only need the client binary, not the full SDK
RUN apt-get update && apt-get install -y --no-install-recommends \
        android-tools-adb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY adb_poller/adb_poller.py .

# Tell the ADB *client* inside the container to forward all commands to the
# ADB *server* running on the Docker host (where the device/emulator lives).
# docker-compose sets ADB_SERVER_SOCKET via environment.
ENV ADB_SERVER_SOCKET=tcp:host.docker.internal:5037

CMD ["python", "-u", "adb_poller.py"]
