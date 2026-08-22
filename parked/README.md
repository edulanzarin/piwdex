# parked — codigo do piwdex 1 guardado, nao ligado

Isto **nao compila e nao entra no build**: a pasta vive fora de `src/` e esta no
`exclude` do `tsconfig.json`. E arquivo vivo, nao codigo morto — esta aqui pra
ser lido, canibalizado e substituido com calma, nao pra ser religado como esta.

## Por que nao foi religado direto

O robo do piwdex 1 funciona, mas vem colado em quatro coisas que o piwdex2
ainda nao tem e talvez nunca queira do mesmo jeito: Auth.js v5, Postgres,
Mercado Pago e a UI antiga inteira. Arrastar tudo isso pra dentro agora
significaria (a) herdar o design que motivou a reescrita e (b) travar a decisao
de o que o robo vira, que e justamente a decisao em aberto.

## O que tem aqui

```
bot/
  lib/        motor do robo e da conta logada
  api/        rotas (connect, collection, market, vip/*, cron, webhook)
  app/        telas (bot-app, conectar, conta, entrar, criar-conta, admin)
  components/ UI do robo/VIP — no dialeto visual ANTIGO
  db/         migrations em SQL puro + runner (sem ORM)
  docs/       ws-protocol.md e as sondas de engenharia reversa
```

### O que vale ouro aqui (nao jogue fora sem ler)

- **`docs/ws-protocol.md`** — o protocolo do WebSocket do jogo, cravado por
  engenharia reversa. E o unico caminho pros pokemons INDIVIDUAIS (time e
  colecao com IV/quality/power por bicho): a REST so entrega o agregado. Se o
  robo for reescrito do zero, este arquivo e o que evita refazer a descoberta.
- **`lib/game-ws.ts`** — a sondagem paralela de shard com early-exit (~300ms).
  O shard e por conta, nao ha campo nenhum que o revele, e conectar no errado
  fecha com `4003 wrong-shard`.
- **`lib/game-auth.ts`** — o login e POR TOKEN, nao por senha, e isso nao e
  preguica: o `/login` do jogo exige captcha amarrado ao navegador, entao
  proxiar credencial no servidor simplesmente nao funciona. De brinde, e o
  modelo mais seguro (a senha nunca sai do jogo).
- **`lib/hunt-brain.ts` / `lib/market-value.ts` / `lib/poke-sell.ts`** — regra de
  decisao ja calibrada contra a conta real. Dependem de `game-account`, por isso
  nao subiram pro `src/lib`.
- **`db/migrations`** — o schema de `users` e `game_links` (token cifrado,
  refresh persistido, `status='expired'` quando o refresh falha).

### O que NAO precisa vir daqui

Os motores PUROS ja foram portados pro `src/lib` do piwdex2 e estao vivos:
`stats.ts`, `xp.ts`, `typing.ts`, `rarity.ts`, `catch-law.ts`, `balls.ts`,
`combat.ts`, `breeding.ts`, `meta.ts`, `boost.ts`.

## Uma nota sobre a sessao, se o robo voltar

O WebSocket **E** a sessao de jogo: conectar chuta a aba do jogo aberta ("conta
em uso"). O piwdex 1 resolveu isso concentrando tudo que toca a sessao num lugar
so — a Conta virou leitura de snapshot e nunca disputa a sessao; so o robo
conecta. Se o substituto tiver dois lugares abrindo WS, o problema volta.

## Estado

Nada aqui esta agendado. A decisao de o que substitui o robo e do Eduardo.
