# Imagem multi-stage: build completo numa camada, runtime so com o standalone.
# Ver [[Next.js standalone no Docker e o outputFileTracingRoot]] no Brain.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# AdSense: `NEXT_PUBLIC_*` e INLINADO no bundle durante o build, entao o id tem
# que estar aqui — passar por `environment:` no compose e tarde demais, o codigo
# do cliente ja foi gerado. Sem os args, a checagem vira codigo morto e o site
# sai sem anuncio nenhum, que e o padrao certo.
ARG NEXT_PUBLIC_ADSENSE_CLIENT=""
ARG NEXT_PUBLIC_ADSENSE_SLOT_GRADE=""
ARG NEXT_PUBLIC_ADSENSE_SLOT_RODAPE=""
ENV NEXT_PUBLIC_ADSENSE_CLIENT=$NEXT_PUBLIC_ADSENSE_CLIENT \
    NEXT_PUBLIC_ADSENSE_SLOT_GRADE=$NEXT_PUBLIC_ADSENSE_SLOT_GRADE \
    NEXT_PUBLIC_ADSENSE_SLOT_RODAPE=$NEXT_PUBLIC_ADSENSE_SLOT_RODAPE

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# O standalone nao carrega `public/` nem os assets estaticos — os sprites do
# jogo (1,9 MB em public/game-sprites) sumiriam da imagem sem estas duas linhas.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
# Porta INTERNA e constante (3000); a publicada e configuracao, no compose.
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
