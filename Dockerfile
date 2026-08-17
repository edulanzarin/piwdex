# syntax=docker/dockerfile:1

# ---------- deps: instala node_modules uma vez ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder: build de producao standalone ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- migrate: node + pg + scripts de banco ----------
FROM node:22-alpine AS migrate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY db ./db
CMD ["node", "db/setup.mjs"]

# ---------- runner: imagem enxuta que roda o app ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# db/ na imagem final: no Railway nao existe o container piwdex-migrate do compose —
# as migrations rodam via pre-deploy command (`node db/setup.mjs`) nesta mesma imagem.
# O `pg` resolve pelo node_modules do standalone (tracing ja o inclui via src/lib/db.ts).
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
