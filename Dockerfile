FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
COPY web/package*.json ./web/

# Install all deps (includes native sqlite rebuild for linux/alpine)
RUN npm ci --ignore-scripts
RUN npm rebuild better-sqlite3 --workspace=server

# ── Build frontend ────────────────────────────────────────────────────────────
FROM base AS web-build
COPY web/ ./web/
RUN npm run build --workspace=web

# ── Production image ──────────────────────────────────────────────────────────
FROM node:22-alpine AS prod
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/server/node_modules ./server/node_modules 2>/dev/null || true
COPY server/ ./server/
COPY --from=web-build /app/web/dist ./web/dist

# Persist the SQLite database on a mounted volume
VOLUME ["/app/server/data"]

ENV PORT=3001
ENV NODE_ENV=production
# Set to your rosId to be the first admin (must exist in the person table)
ENV FIRST_ADMIN_ROS_ID=ros_sara_m
# Set to "false" to disable fixture data and require a real ROS sync
ENV USE_FIXTURE_ROS=true

EXPOSE 3001

CMD ["node", "--import=tsx/esm", "server/src/index.ts"]
