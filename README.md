# piwdex

Dex e ferramentas completas para o jogo **Poke Idle World** (poke.idleworld.online).
Faz o que o piwtools faz e vai além: **chance real de cada drop**, índice reverso
"onde dropa cada item", localização de hunt por pokemon, cadeia evolutiva e fraquezas.

Domínio: piwdex.com.br

## Como os dados chegam

O jogo serve o catálogo como JSON público (sem auth). O piwdex puxa **direto da
fonte-mestra** — não de terceiros — pra ficar na mesma origem e pegar patch de
balanceamento antes:

- `poke.idleworld.online/game/creatures.json` — 482 pokemons (stats, tipos, raridade,
  hunt level, evolução, XP, preços, drop table com chance, movesets)
- `poke.idleworld.online/game/items.json` — 330 itens
- `poke.idleworld.online/api/game/map-markers` — 347 pontos de hunt

`scripts/ingest.mjs` baixa os três, valida integridade (todo loot bate com um item),
normaliza e grava o snapshot versionado em `src/data/piwdex.json`. As **derivações**
(índice reverso de drop, localizações, evolução) vivem no código (`src/lib/data.ts`),
não no snapshot — assim o snapshot é diffável contra o jogo.

`chance` vem numa escala 0–100000; a porcentagem é `chance / 1000`.

## Rodar

```bash
npm install
npm run ingest     # baixa/atualiza o snapshot da fonte-mestra
npm run dev        # http://localhost:4070
```

Par de portas reservado (chassi do Brain): app **4070**, banco **5070**.

## Roadmap

- [x] Camada 1 — base pública: pokedex, ficha completa, itens e índice reverso de drop.
- [ ] Camada 2 — calculadoras (lucro/hora de farm, melhor spot por item, comparador de
  stats), com fórmulas raspadas de `/pokepedia/systems/*`.
- [ ] Camada 3 — companion logado: proxy da API JWT do jogo + WebSocket (progresso da
  dex, inventário, alertas). Aqui entra o chassi Postgres + Docker compose.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · TypeScript. Dados estáticos
gerados em build (camada 1 é 100% dado público read-only); o backend entra na camada 3.

Projeto não oficial. Dados e sprites são do Poke Idle World / PokeAPI.
