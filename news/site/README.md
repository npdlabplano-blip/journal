# The Daily Brief — Self-Hosted with Cloudflare ZTNA

A daily news journal served from Docker on your Ubuntu box, fronted by Cloudflare Tunnel and protected with Cloudflare Access (Zero Trust).

## Architecture

```
Perplexity cron (6 AM CDT daily)
  │  searches web → writes news.json → git push
  ▼
GitHub  (namsler1/journal)
  │
  │  git pull (hourly)
  ▼
┌──────────────────────────────┐
│  Ubuntu box                  │
│                              │
│  ┌────────────────────────┐  │
│  │  daily-brief container │  │
│  │  nginx :80 (internal)  │  │
│  │  + git pull loop       │  │
│  └───────────┬────────────┘  │
│              │               │
│  ┌───────────▼────────────┐  │
│  │  cloudflared tunnel    │  │
│  │  routes from CF edge   │  │
│  └───────────┬────────────┘  │
└──────────────┼───────────────┘
               │
               ▼
  Cloudflare Edge
  ├── DNS: news.calconam.com → tunnel
  └── Access policy: email OTP → your email only
               │
               ▼
          You (browser)
```

## Quick Start

### 1. Pull the repo and build

```bash
cd ~/journal    # or wherever you cloned it
git pull
docker compose build news
docker compose up -d news
```

The container starts nginx on port 80 (internal only — no host ports exposed).
It immediately clones the repo and copies `news.json`, then re-pulls every hour.

### 2. Add the route to your Cloudflare Tunnel

Find your tunnel config. It's usually at one of these paths:

```bash
# Check where your config lives
cat ~/.cloudflared/config.yml
# or
cat /etc/cloudflared/config.yml
```

Add this block under `ingress:` (above the catch-all):

```yaml
ingress:
  # ... your existing routes (meals.calconam.com, style.calconam.com, etc.) ...

  - hostname: news.calconam.com
    service: http://daily-brief:80
    # ↑ If cloudflared runs on the host (not in Docker), use:
    #   service: http://localhost:8082
    #   and uncomment the ports in docker-compose.yml

  # Catch-all (must be last)
  - service: http_status:404
```

**If cloudflared runs on the Docker host** (not inside Docker), the container's internal hostname won't resolve. In that case:

1. Uncomment the `ports` block in `docker-compose.yml`:
   ```yaml
   ports:
     - "8082:80"
   ```
2. Use `http://localhost:8082` in the tunnel config instead of `http://daily-brief:80`.

**If cloudflared runs in Docker** on the same compose network, use `http://daily-brief:80` directly.

### 3. Restart cloudflared to pick up the new route

```bash
# If running as a systemd service:
sudo systemctl restart cloudflared

# If running manually:
cloudflared tunnel run <your-tunnel-name>
```

### 4. Create the DNS record

If Cloudflare doesn't auto-create the CNAME, add it:

```bash
cloudflared tunnel route dns <your-tunnel-name> news.calconam.com
```

Or manually in the Cloudflare dashboard:
- **Type:** CNAME
- **Name:** `news`
- **Target:** `<tunnel-id>.cfargotunnel.com`
- **Proxy:** ON (orange cloud)

### 5. Set up Cloudflare Access (ZTNA)

Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/) → **Access** → **Applications**.

**Create a new application:**

| Field | Value |
|-------|-------|
| Type | Self-hosted |
| Application name | The Daily Brief |
| Session duration | 24 hours |
| Application domain | `news.calconam.com` |

**Create a policy:**

| Field | Value |
|-------|-------|
| Policy name | Allow Me |
| Action | Allow |
| Include rule | Emails — `namsler123@gmail.com` |

This requires a one-time email PIN whenever you access the site from a new session. Add more emails to the include rule if you want to share access with others.

## Verify It's Working

```bash
# Container running?
docker ps | grep daily-brief

# Container logs (should show git pull + nginx start)
docker logs -f daily-brief

# Health check (from the host)
curl http://localhost:8082/healthz   # if ports are exposed
docker exec daily-brief curl -s http://localhost/healthz

# Tunnel routing
curl -I https://news.calconam.com
# Should get a 302 redirect to Cloudflare Access login
```

## Force a Content Refresh

Don't want to wait for the hourly pull:

```bash
docker exec daily-brief bash -c \
  "cd /tmp/journal-repo && git pull && cp news/site/data/news.json /var/www/news/data/news.json"
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GIT_REPO_URL` | `https://github.com/namsler1/journal.git` | Repo to pull news data from |
| `PULL_INTERVAL_SECONDS` | `3600` | Seconds between GitHub pulls |

## Container Management

```bash
# Start
docker compose up -d news

# Stop
docker compose down news

# Rebuild after repo changes
git pull && docker compose build news && docker compose up -d news

# View logs
docker logs -f daily-brief
```
