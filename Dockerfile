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
ENV SERVER_PORT=4000

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN mkdir -p /data/assets

EXPOSE 4000

CMD ["node", "dist/api/src/index.js"]
