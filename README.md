# piwdex2

Dex e ferramentas para **Poke Idle World** (`poke.idleworld.online`).

Reescrita do piwdex com uma premissa diferente: a dex nao e uma galeria de
sprites, e uma **ferramenta de consulta**. A pergunta que ela responde nao e
"como e o Bulbasaur", e "quem apanha de Fogo, dropa Bulb e da pra encarar no
nivel 40".

## Estado

| Area | Situacao |
|---|---|
| Sistema de design (tokens + 22 primitivas) | pronto |
| Pagina inicial | pronta |
| Pokedex (17 filtros, grid/tabela, estado na URL) | pronta |
| Ficha da especie (stats, fraquezas, golpes, drops, evolucao, spots) | pronta |
| Itens com indice reverso (10 filtros, ficha com quem dropa) | pronto |
| Calculadora de IV/Quality/Poder | pronta |
| Rota de hunt / Breeding / Meta | a fazer |
| Robo (area logada) | a portar do piwdex |

## Rodar

```bash
npm install
npm run dev          # http://localhost:4071
PORT=3000 npm run dev   # outra porta, sem criar script novo
```

Producao:

```bash
npm run build && npm start
# ou
docker compose up -d --build
```

## De onde vem o dado

Direto do catalogo publico do jogo, sem intermediario:

| Endpoint | Conteudo |
|---|---|
| `/game/creatures.json` | especies: stats, tipos, raridade, loot, golpes, evolucao |
| `/game/items.json` | itens: categoria, preco de NPC, cura |
| `/api/game/map-markers` | pontos de caca: area, nivel, posicao no mapa |

O frescor e conferido por **ETag** a cada visita (um HEAD de ~30ms, zero byte) e
o download de 1 MB so acontece quando o jogo mexeu no catalogo. Se a fonte cair,
o site continua de pe com o snapshot versionado em `src/data/piwdex.json` — e
**diz isso na tela** (o selo troca de `AO VIVO` pra `SNAPSHOT`), em vez de
servir dado velho fingindo estar ao vivo.

Atualizar o snapshot de fallback: `npm run ingest`.

## Arquitetura

```
src/
  app/            paginas (App Router)
  components/
    ui/           PRIMITIVAS — botao, campo, select, modal, faixa, ...
    *.tsx         componentes de dominio (card, filtros, navegacao)
  lib/
    source.ts     fonte do catalogo: ETag, cache, fallback
    data.ts       derivacoes (indice reverso de drop, spots, evolucao)
    dex.ts        motor da dex: o que se pode perguntar e como ordenar
    dex-url.ts    a pergunta serializada na URL
    items.ts      motor dos itens: de onde vem, da pra farmar, rende quanto
    items-url.ts  a mesma serializacao, do lado dos itens
    calc-url.ts   o bicho da calculadora, serializado no link
    stats.ts      formula de stat/IV/Poder do jogo (verificada)
    typing.ts     tabela de efetividade e cores de tipo
    rarity.ts     faixas de qualidade (tabela oficial do jogo)
    xp.ts         curva de XP (formula fechada da pokepedia)
    catch-law.ts  lei de captura derivada (ajuste empirico, nao formula oficial)
```

Duas regras que valem em todo arquivo:

1. **Cor e espaco saem de token** (`globals.css`). A excecao sao as cores de
   DADO — tipo de pokemon, faixa de raridade — que vivem em `lib/`, porque sao
   dado do jogo e nao decisao de interface.
2. **Toda tela importa de `@/components/ui`.** Se a primitiva nao serve, o certo
   e abrir uma variante nela, nao criar mais um botao quase igual.

## Convencoes

Slug `piwdex2` governa o nome de tudo (`piwdex2-app`, `piwdex2-db`, rede
`piwdex2-net`). Porta interna constante (3000), externa por variavel. Par de
portas reservado: **4071** (app) / **5071** (banco).

## Aviso

Projeto de fa. Sem vinculo com os autores do Poke Idle World. Todo acesso ao
jogo e de LEITURA.
