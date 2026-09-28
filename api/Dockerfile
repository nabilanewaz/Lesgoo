# Dhaka Tesla Pool API. Multi-stage: build with every dependency, ship only what runs.

FROM node:22-alpine AS base
# Prisma's query and migration engines need OpenSSL.
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
# The app, then the demo seed (plain JS, so the runtime image doesn't need tsx).
RUN npm run build \
 && npx tsc prisma/seed.ts --outDir dist/seed --module commonjs --target ES2022 \
      --moduleResolution node --esModuleInterop --skipLibCheck --strict
# Drop test and build tools. The generated Prisma client and the Prisma CLI (needed for
# `migrate deploy` at startup) stay.
RUN npm prune --omit=dev

FROM base
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY package.json docker-entrypoint.sh ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=5s --timeout=3s --start-period=30s --retries=10 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
