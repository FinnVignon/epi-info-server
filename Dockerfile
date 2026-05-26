FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV ADMIN_DIST_PATH=/app/dist/admin
ENV SERVER_PORT=4000

EXPOSE 4000

CMD ["npm", "start"]

