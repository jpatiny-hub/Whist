# Builds a single image that serves the API and the built web app together,
# so a group can host the whole scoreboard behind one URL.
FROM node:22-slim AS build
WORKDIR /repo

COPY package.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm install

COPY server server
COPY web web

RUN npm run build --workspace web
RUN npm run --workspace server prisma:generate
RUN npm run build --workspace server

FROM node:22-slim
WORKDIR /repo
ENV NODE_ENV=production

COPY package.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm install --omit=dev

COPY --from=build /repo/server/dist server/dist
COPY --from=build /repo/server/prisma server/prisma
COPY --from=build /repo/web/dist web/dist
RUN npm run --workspace server prisma:generate

EXPOSE 4000
WORKDIR /repo/server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
