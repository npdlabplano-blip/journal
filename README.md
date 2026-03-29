# Journal — Personal Organization System

A personal journal and home organization system for managing daily life, powered by specialized AI agents.

## Structure

- **`planner/`** — Central hub: calendar, custody schedule, to-do lists, routines
- **`journal/`** — Daily reflections, prayers, sermon notes, Bible study
- **`nutrition/`** — Meal plans, recipes, calorie tracking
- **`style/`** — Wardrobe catalog, outfit suggestions, wishlist
- **`finance/`** — Budget, bills, savings goals, investments
- **`news/`** — Daily news briefings (The Daily Brief)
- **`agents/`** — Agent charters (system prompts for each specialized agent)

## Agents

| Agent | Charter | Purpose |
|-------|---------|---------|
| Nutrition Coach | `agents/nutrition-coach.md` | Meal planning, calorie tracking, weight loss support |
| Devotional Companion | `agents/devotional-companion.md` | Daily Bible readings & reflection |
| Style Guru | `agents/style-guru.md` | Wardrobe management & outfit suggestions |
| Finance Coach | `agents/finance-coach.md` | Budgeting, bills, savings, investments |
| News Briefing | `agents/news-briefing.md` | Daily curated news digest |

---

## Self-Hosted Setup (Ubuntu Server)

Everything below runs on a single Ubuntu box with Docker and Cloudflare Tunnel.

### Prerequisites

```bash
# Docker & Docker Compose
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER    # log out/in after this

# Cloudflare Tunnel
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Git
sudo apt install -y git
```

### Full Rebuild from Scratch

If you ever lose your server, these steps get everything back up:

#### 1. Clone the repo

```bash
cd ~
git clone https://github.com/namsler1/journal.git
cd journal
```

#### 2. Start all containers

```bash
docker compose up -d
```

This starts three containers:

| Container | Image | Port | Sites |
|-----------|-------|------|-------|
| `journal-web` | `nginx:alpine` | `8080` | meals.calconam.com, style.calconam.com |
| `daily-brief` | `nginx:alpine` | `8082` | news.calconam.com |
| `journal-site` | `node:20-alpine` (built) | `8084` | journal.calconam.com |

The `web` and `news` containers use volume mounts — no build step needed. They serve files directly from the repo on disk.

The `journal-site` container is a fullstack Node.js app (Express + React + SQLite) that builds from `journal-site/`. It auto-syncs journal entries to GitHub via the API.

#### Starting journal-site with 1Password

The GitHub token is pulled from 1Password at launch time using `op read` — it stays in memory only, never on disk:

```bash
GITHUB_TOKEN=$(op read "op://OpenClaw/GitHub Journal API/credential") docker compose up -d journal-site
```

Or to start everything (the other containers don't need the token):

```bash
GITHUB_TOKEN=$(op read "op://OpenClaw/GitHub Journal API/credential") docker compose up -d
```

To rebuild after code changes:

```bash
GITHUB_TOKEN=$(op read "op://OpenClaw/GitHub Journal API/credential") docker compose up -d --build journal-site
```

#### 3. Set up the host cron for git pull

```bash
crontab -e
```

Add this line to pull from GitHub every 5 minutes:

```cron
*/5 * * * * cd ~/journal && git pull --quiet >> /tmp/journal-pull.log 2>&1
```

This keeps the site content in sync with what Perplexity pushes to GitHub daily.

#### 4. Set up Cloudflare Tunnel

Authenticate and create the tunnel (one-time):

```bash
cloudflared tunnel login
cloudflared tunnel create calconam
```

Create the config file at `/etc/cloudflared/config.yml`:

```yaml
tunnel: 6b7774fc-8c8d-4b1e-811e-ec1e110ffbae
credentials-file: /etc/cloudflared/6b7774fc-8c8d-4b1e-811e-ec1e110ffbae.json

ingress:
    - hostname: meals.calconam.com
      service: http://localhost:8080
    - hostname: style.calconam.com
      service: http://localhost:8080
    - hostname: news.calconam.com
      service: http://localhost:8082
    - hostname: journal.calconam.com
      service: http://localhost:8084
    - service: http_status:404
```

Set up DNS routes (if not already configured):

```bash
cloudflared tunnel route dns 6b7774fc-8c8d-4b1e-811e-ec1e110ffbae meals.calconam.com
cloudflared tunnel route dns 6b7774fc-8c8d-4b1e-811e-ec1e110ffbae style.calconam.com
cloudflared tunnel route dns 6b7774fc-8c8d-4b1e-811e-ec1e110ffbae news.calconam.com
cloudflared tunnel route dns 6b7774fc-8c8d-4b1e-811e-ec1e110ffbae journal.calconam.com
```

Install as a systemd service so it starts on boot:

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

#### 5. Cloudflare Access (ZTNA)

Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/) → **Access** → **Applications**.

Create applications for each site you want to protect:

| Field | Value |
|-------|-------|
| Type | Self-hosted |
| Application domain | `news.calconam.com` (repeat for meals, style) |
| Session duration | 24 hours |
| Policy | Allow — Emails — `namsler123@gmail.com` |

### Verify Everything

```bash
# All containers running?
docker ps

# Check individual containers
docker logs journal-web
docker logs daily-brief

# Health checks
curl http://localhost:8080    # should return HTML (meals/style)
curl http://localhost:8082/healthz    # should return "ok"
curl http://localhost:8084/api/status  # should return JSON with githubConfigured: true

# Tunnel working?
curl -I https://news.calconam.com
# Should get 302 → Cloudflare Access login

# Cron running?
crontab -l | grep journal
cat /tmp/journal-pull.log
```

### Port Map

| Port | Container | Sites |
|------|-----------|-------|
| 8080 | `journal-web` | meals.calconam.com, style.calconam.com (hostname routing via nginx) |
| 8082 | `daily-brief` | news.calconam.com |
| 8084 | `journal-site` | journal.calconam.com |

### Daily Content Updates

Perplexity runs a cron at 6 AM CDT daily that:
1. Searches for headlines across 6 categories (World Politics, US Politics, DFW News, AI News, JPMorgan Chase, DFW Events)
2. Writes `news/site/data/news.json`
3. Pushes to this GitHub repo

Your host cron pulls every 5 minutes, so new content appears on `news.calconam.com` automatically.

### Container Management

```bash
# Start everything (with GitHub token for journal-site)
GITHUB_TOKEN=$(op read "op://OpenClaw/GitHub Journal API/credential") docker compose up -d

# Start just one service
GITHUB_TOKEN=$(op read "op://OpenClaw/GitHub Journal API/credential") docker compose up -d journal-site

# Start services that don't need the token
docker compose up -d web news

# Stop everything
docker compose down

# Rebuild journal-site after code changes
GITHUB_TOKEN=$(op read "op://OpenClaw/GitHub Journal API/credential") docker compose up -d --build journal-site

# View logs
docker logs -f daily-brief
docker logs -f journal-web
docker logs -f journal-site
```

### Files That Matter

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Defines all containers, ports, volumes |
| `nginx.conf` | Hostname routing for meals + style (web container) |
| `news/site/nginx-news.conf` | Nginx config for The Daily Brief (news container) |
| `news/site/data/news.json` | Daily news data (auto-updated by Perplexity) |
| `journal-site/` | Journal site source (Express + React + SQLite) |
| `journal-site/Dockerfile` | Multi-stage build for journal-site container |
| `/etc/cloudflared/config.yml` | Cloudflare Tunnel routes |
