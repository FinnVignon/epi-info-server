FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV ADMIN_DIST_PATH=/app/dist/admin
ENV ASSET_STORAGE_PATH=/data/assets
ENV DATABASE_MIGRATIONS_PATH=/app/database/migrations
ENV SERVER_PORT=4000

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/docker/mysql/migrations ./database/migrations
COPY --from=build /app/scripts ./scripts

RUN mkdir -p /data/assets

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/api/src/index.js"]
