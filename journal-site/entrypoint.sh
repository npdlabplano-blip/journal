#!/bin/sh
set -e

SRC_DIR="/app/src"
DATA_DIR="/app/data"
BUILD_HASH_FILE="$DATA_DIR/.last-build-hash"

mkdir -p "$DATA_DIR"

# Compute hash of source files
compute_hash() {
  find "$SRC_DIR" \
    -not -path '*/node_modules/*' \
    -not -path '*/dist/*' \
    -not -path '*/.git/*' \
    -not -name '*.db' \
    -not -name '*.db-journal' \
    -type f -exec md5sum {} \; 2>/dev/null | sort | md5sum | awk '{print $1}'
}

# Install deps if needed
install_deps() {
  cd "$SRC_DIR"
  if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
    echo "[entrypoint] Installing dependencies..."
    npm ci
  fi
}

# Build the app
build_app() {
  cd "$SRC_DIR"
  install_deps
  echo "[entrypoint] Building..."
  npm run build
  CURRENT_HASH=$(compute_hash)
  echo "$CURRENT_HASH" > "$BUILD_HASH_FILE"
  echo "[entrypoint] Build complete."
}

# Build if source changed since last build
rebuild_if_needed() {
  CURRENT_HASH=$(compute_hash)
  LAST_HASH=""
  if [ -f "$BUILD_HASH_FILE" ]; then
    LAST_HASH=$(cat "$BUILD_HASH_FILE")
  fi

  if [ "$CURRENT_HASH" != "$LAST_HASH" ]; then
    build_app
    return 0
  fi
  echo "[entrypoint] Source unchanged — skipping build."
  return 1
}

# Poll for changes every 60s, rebuild + restart server if needed
poll_and_rebuild() {
  while true; do
    sleep 60
    CURRENT_HASH=$(compute_hash)
    LAST_HASH=$(cat "$BUILD_HASH_FILE" 2>/dev/null || echo "")

    if [ "$CURRENT_HASH" != "$LAST_HASH" ]; then
      echo "[poll] Source changed — rebuilding..."
      build_app

      # Restart server
      if [ -f /tmp/node.pid ]; then
        kill -TERM $(cat /tmp/node.pid) 2>/dev/null || true
        sleep 2
        cd "$SRC_DIR"
        node dist/index.cjs &
        echo $! > /tmp/node.pid
        echo "[poll] Server restarted."
      fi
    fi
  done
}

# --- Main ---
rebuild_if_needed

# Start the poller in the background
poll_and_rebuild &

# Start the server
cd "$SRC_DIR"
node dist/index.cjs &
echo $! > /tmp/node.pid
wait $(cat /tmp/node.pid)
