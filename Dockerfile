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
ARG NEXT_PUBLIC_ADSENSE_LAYOUT_GRADE=""
# O endereco do site tambem: ele alimenta `metadataBase`, e o `metadataBase` e
# lido durante o build das paginas estaticas. Declarado como ARG e NAO promovido
# a ENV, ele nao existe pro `npm run build` — foi o estado em que este arquivo
# ficou por um commit.
ARG NEXT_PUBLIC_SITE_URL=""
ARG NEXT_PUBLIC_GOOGLE_VERIFICACAO=""
# O endereco do robo tambem entra no BUILD, e por dois caminhos: o `next.config.ts`
# le esta variavel pra decidir se `/vip` e `/bot-app` apontam pro subdominio (e
# `redirects()` e avaliado uma vez, no build, e gravado no manifesto de rotas), e
# a barra do robo a inlina no bundle do cliente. Sem o ARG, preencher a variavel
# no painel nao teria efeito nenhum.
ARG NEXT_PUBLIC_BOT_URL=""
ENV NEXT_PUBLIC_ADSENSE_CLIENT=$NEXT_PUBLIC_ADSENSE_CLIENT \
    NEXT_PUBLIC_ADSENSE_SLOT_GRADE=$NEXT_PUBLIC_ADSENSE_SLOT_GRADE \
    NEXT_PUBLIC_ADSENSE_SLOT_RODAPE=$NEXT_PUBLIC_ADSENSE_SLOT_RODAPE \
    NEXT_PUBLIC_ADSENSE_LAYOUT_GRADE=$NEXT_PUBLIC_ADSENSE_LAYOUT_GRADE \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GOOGLE_VERIFICACAO=$NEXT_PUBLIC_GOOGLE_VERIFICACAO \
    NEXT_PUBLIC_BOT_URL=$NEXT_PUBLIC_BOT_URL

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

# As migrations rodam como PRE-DEPLOY, na propria imagem do app — e o standalone
# nao carrega nada que o `next build` nao tenha tracado, entao `db/` ficaria de
# fora. Sem esta linha o pre-deploy do robo morre com "Cannot find module
# /app/db/migrate.mjs", o deploy nao promove, e a versao velha continua servindo
# sem nada no log explicando o motivo.
#
# O `pg` que o script precisa ja vem: ele e tracado pelo build (o app usa banco),
# e o standalone o deixa em /app/node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/db ./db

USER nextjs
# Porta INTERNA e constante (3000); a publicada e configuracao, no compose.
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
