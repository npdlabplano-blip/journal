# --- Build stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# --- Production stage ---
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies + better-sqlite3 native build tools
COPY package.json package-lock.json ./
RUN apk add --no-cache python3 make g++ && \
    npm ci --omit=dev && \
    apk del python3 make g++

# Copy built output from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -S journal && adduser -S journal -G journal && \
    mkdir -p /app/data && chown -R journal:journal /app/data

USER journal

# SQLite data volume
VOLUME /app/data
ENV DATABASE_PATH=/app/data/journal.db
ENV NODE_ENV=production

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:5000/api/status || exit 1

CMD ["node", "dist/index.cjs"]
