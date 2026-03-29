#!/bin/sh

SRC_DIR="/app/src"
BUILD_DIR="/app/build"
DATA_DIR="/app/data"
BUILD_HASH_FILE="$DATA_DIR/.last-build-hash"

mkdir -p "$DATA_DIR" "$BUILD_DIR"

compute_hash() {
  find "$SRC_DIR" \
    -not -path '*/node_modules/*' \
    -not -path '*/dist/*' \
    -not -path '*/.git/*' \
    -not -name '*.db' \
    -not -name '*.db-journal' \
    -type f -exec md5sum {} \; 2>/dev/null | sort | md5sum | awk '{print $1}'
}

build_app() {
  echo "[entrypoint] Copying source to build directory..."
  rsync -a --delete \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.git' \
    --exclude='*.db' \
    --exclude='*.db-journal' \
    "$SRC_DIR/" "$BUILD_DIR/"

  cd "$BUILD_DIR"

  # Install ALL deps (including devDependencies needed for build)
  echo "[entrypoint] Installing dependencies..."
  NODE_ENV=development npm ci

  echo "[entrypoint] Building..."
  npm run build

  # Prune devDependencies after build
  echo "[entrypoint] Pruning dev dependencies..."
  npm prune --omit=dev

  compute_hash > "$BUILD_HASH_FILE"
  echo "[entrypoint] Build complete."
}

needs_build() {
  # Always build if dist doesn't exist
  if [ ! -f "$BUILD_DIR/dist/index.cjs" ]; then
    return 0
  fi

  CURRENT_HASH=$(compute_hash)
  LAST_HASH=$(cat "$BUILD_HASH_FILE" 2>/dev/null || echo "")

  if [ "$CURRENT_HASH" != "$LAST_HASH" ]; then
    return 0
  fi

  return 1
}

poll_and_rebuild() {
  while true; do
    sleep 60

    if needs_build; then
      echo "[poll] Source changed — rebuilding..."
      build_app

      if [ -f /tmp/node.pid ]; then
        kill -TERM $(cat /tmp/node.pid) 2>/dev/null || true
        sleep 2
        cd "$BUILD_DIR"
        node dist/index.cjs &
        echo $! > /tmp/node.pid
        echo "[poll] Server restarted."
      fi
    fi
  done
}

# --- Main ---
if needs_build; then
  build_app
else
  echo "[entrypoint] Source unchanged and build exists — skipping build."
fi

poll_and_rebuild &

cd "$BUILD_DIR"
node dist/index.cjs &
echo $! > /tmp/node.pid
wait $(cat /tmp/node.pid)
