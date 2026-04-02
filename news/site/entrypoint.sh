#!/bin/bash
# ============================================================
# The Daily Brief — Container Entrypoint
#
# 1. Clones/pulls the journal repo from GitHub
# 2. Copies fresh news.json into the nginx serve directory
# 3. Starts nginx in the foreground
# 4. Background loop re-pulls on a configurable interval
# ============================================================

REPO_URL="${GIT_REPO_URL:-https://github.com/npdlabplano-blip/journal.git}"
PULL_INTERVAL="${PULL_INTERVAL_SECONDS:-3600}"
SITE_DIR="/var/www/news"
REPO_DIR="/tmp/journal-repo"

echo "=== The Daily Brief ==="
echo "Repo:     $REPO_URL"
echo "Interval: ${PULL_INTERVAL}s"

sync_news() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pulling from GitHub..."
    if [ -d "$REPO_DIR/.git" ]; then
        cd "$REPO_DIR" && git pull --quiet 2>&1
    else
        git clone --depth 1 --single-branch "$REPO_URL" "$REPO_DIR" 2>&1
    fi

    if [ $? -eq 0 ] && [ -f "$REPO_DIR/news/site/data/news.json" ]; then
        mkdir -p "$SITE_DIR/data"
        cp "$REPO_DIR/news/site/data/news.json" "$SITE_DIR/data/news.json"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] news.json updated"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] sync failed or no data found"
    fi
}

# Initial sync before nginx starts
sync_news

# Background pull loop
(
    while true; do
        sleep "$PULL_INTERVAL"
        sync_news
    done
) &

echo "=== Starting nginx ==="
exec nginx -g "daemon off;"
