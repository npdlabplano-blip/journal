FROM node:20-alpine

WORKDIR /app

# Build tools for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

EXPOSE 5000

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/journal.db

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s \
  CMD wget -qO- http://localhost:5000/api/status || exit 1

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
