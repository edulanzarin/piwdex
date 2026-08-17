# Protocolo do WebSocket do jogo (Poke Idle World) — revertido por captura

Conexao: `wss://poke.idleworld.online/ws<shard>?token=<accessJWT>&cmid=<hex>`
- WS cru, frames JSON `{"type":...}`. Token na query (sem auth por frame).
- **Single-session**: a conexao mais nova ganha; a anterior recebe "Conta em uso" e
  cai. O piwdex conectar = roubar a sessao do navegador (e vice-versa).
- Shard descoberto varrendo ws1..ws64 (shard errado fecha com code 4003). Cacheado
  em `link.shard`. Ver `src/lib/game-ws.ts` (`fetchActivePokes`).

## Cliente -> servidor (↑ enviados)
- `{"type":"pokes-get"}` -> responde `pokes`
- `{"type":"inv-get"}` -> `inventory`, `{"type":"balls-get"}` -> `balls`,
  `{"type":"autohelper-get"}` -> `autohelper` (getters explicitos; mesmos frames do
  snapshot, sob demanda)
- `{"type":"boosts-refresh"}`, `{"type":"badge-refresh"}`
- `{"type":"trade-get"}` -> `trade` `{trade:null}` (shape confirmado sem trade ativo)
- `{"type":"family-get"}` -> `family` (sistema de guild/familia, ver ↓)
- `{"type":"pending-get"}` -> `pending` (fila de corpos capturaveis, ver ↓)
- **`{"type":"autohelper-refresh"}`** -> MUTA: cicla a bola do auto-catch pra
  proxima bola COM ESTOQUE (observado 1→4→6→4 com Ultra=4 e Idle=6 disponiveis).
  Nome engana — nao e refresh, e o botao de trocar bola. Responde `autohelper`.
- **`{"type":"poke-withdraw","pokeId":"<cuid>"}`** -> tira o poke do BOX pro time.
  MUTA. Responde `pokes` atualizado.
- **`{"type":"poke-store","pokeId":"<cuid>"}`** -> guarda o poke do time no BOX.
  MUTA. Responde `pokes` atualizado.
- **`{"type":"leave-hunt"}`** -> SAI do campo: encerra o stream `field`/`field-kill`.
  O cliente do jogo manda `balls-get`+`inv-get` logo depois pra ressincronizar.
- **`{"type":"send","channel":"world|trade|help","body":"<texto>"}`** -> manda mensagem
  no CHAT (confirmado por captura HAR ago/2026). O servidor ecoa de volta como frame
  `chat` normal (com id/fromName/at) — inclusive pro proprio remetente.
- **`{"type":"enter-hunt","slug":"<huntSlug>"}`** -> ENTRA NO CAMPO: dispara `field-init`
  (mapa) e inicia o stream `field`/`field-kill`/`catch-result` + a acumulacao do
  analyzer. SEM isso, uma conexao recebe so o snapshot; o analyzer fica ZERADO
  (confirmado: segurar a conexao sem enter-hunt = 0 kills, 0 field frames).
- **`{"type":"analyzer-get"}`** -> responde `analyzer` (stats da sessao). Numa conexao
  que nao entrou no campo, volta tudo 0. O slug (ex. "ledian") vem do `hunt-config`
  REST / do `field-init`.
- **`{"type":"poke-summon","pokeId":"<id>"}`** -> define o pokemon ATIVO/LIDER (o que
  caca). MUTA a conta. Verificado: apos summon do Primeape, o `pokes` voltou com ele
  leader:true slot:0 e o lider anterior (Golem) leader:false slot:1. Responde com
  `poke-summon` (echo) + `pokes` atualizado. E o comando de trocar o ativo / do modal
  de cacar. So mandar sabendo o id certo (comando que muta a conta).

## Fluxo real do cliente ao entrar/sair do campo (captura ago/2026)
1. `enter-hunt {slug}` -> 2. `pending-get` + `balls-get` -> chega `pending`, `balls`,
`field-init` e comeca o stream. Ao sair: `leave-hunt` -> `balls-get` + `inv-get`.

## Fluxo do Hunt Analyzer (pixwdex-como-sessao)
1. conecta -> 2. `enter-hunt {slug}` -> 3. poll `analyzer-get` a cada ~5s -> mostra.
Precisa SEGURAR a conexao (o analyzer zera se desconectar). Single-session: enquanto
o piwdex segura, o navegador do jogo fica em "conta em uso".

### field-init `{huntKey, slug, rows, cols, minTx, minTy, grid, ...}` (uma vez, ao entrar)
### analyzer `{kills, seconds, xpGained, lootItems, lootGold, ballsUsed, potionsUsed, supplyGold, captures, shinyCaptures, capturesGold, photos, photoNpcGold, photoMarketAvg, balance, goldPerHour, xpPerHour, killsPerHour, drops:[{itemId,name,qty,gold}]}`

## Servidor -> cliente (↓ recebidos)

### Snapshot (uma vez, ao conectar)
- `pokes` `{list:[GamePoke]}` — box+time individual (id, speciesId, ivTotal, quality,
  shiny, team, leader, starter, sellValue, ...). Ver `normalizeActivePokes`.
- `inventory` `{items:[{itemId,quantity}]}`
- `balls` `{catalog:[...], counts:{ballId:qty}, gold, selected}`
- `autohelper` `{autoCatch, autoCatchBallId, autoCatchNames, autoCatchShiny,
  autoCatchShinyBallId, isVip, balls:[{id,name,iconUrl,quantity}] (so as COM estoque),
  autoPotion, autoPotionThreshold, autoPotionItemId, autoRevive,
  potions:[{id,name,icon,healAmount,quantity}], reviveCount}`
- `boosts`, `mail-badge`, `events`, `history` (chat inicial)
- `family` `{family:null|{...}, canCreate, invites:[], depot:{items:[], pokes:[]}}` —
  sistema de guild/familia com deposito compartilhado (capturado sem familia; shape
  interno do `family` preenchido ainda desconhecido)

### Stream da hunt (so depois do "entrar no campo")
- `field` (~2/seg): `{seq, serverNow, hero:{row,col,facing}, mobs:[{slot,speciesId,hp,
  maxHp,dead,respawning,shiny}], corpses:[], targetSlot, fighting, heroHp, heroMaxHp,
  fainted, reviveInMs, allMobsDead, hits:[{slot,amount,eff,move,type}]}`
- **`field-kill`** (o KILL): `{xpGained, totalXp, level, leveledUp, loot:[{itemId,name,
  qty}], speciesName, shiny, xpParts:{base,streak,boost,vip,event,typeDay,debuff}}`
- `poke-xp` `{id, speciesId, xpGained, xp, level, leveledUp}` — XP do poke ativo
- `catch-result` `{auto, success, speciesName, ballName, ballId, row, col}`
- `balls`/`inventory` reenviados a cada mudanca (bola gasta, loot dropado)
- **`pending`** `{list:[{id, pokeId, name, level, shiny, at(epoch ms), row, col}]}` —
  fila de CORPOS aguardando captura (o que o modal de captura mostra). `pokeId` aqui
  e o numero da SPECIES (193=Yanma), nao o cuid. Reenviada inteira a cada mudanca:
  cresce a cada kill, drena conforme o auto-catch processa (`catch-result`).
- `shiny-global` — broadcast mundial quando alguem pega shiny (nao e teu)
- **`chat`** `{msg:{id, channel:"world|trade|help", fromName, level, isAdmin, isTutor,
  isVip, body, at:ISO}}` — mensagem de chat ao vivo (formato confirmado por HAR).
  `body` pode conter links `[poke!<base64 de {n,lv,sh,q,iv,pw,t1,t2,st}>]`.
- **`history`** `{world:[...], trade:[...], help:[...]}` — backlog do chat no snapshot,
  um array POR CANAL, itens no mesmo shape do `chat.msg`.

## REST (fora do WS) — capturado ago/2026
- `GET /api/auth/me` -> `{user:{id, email, name, avatar, isAdmin, isDev, isCm, ...}}`
- `GET /api/characters/me` -> perfil COMPLETO do personagem: `{character:{id, name,
  level, gold, xp, catches, diamonds, isVip, vipUntil, clan, clanRank, profession,
  referralCode, fishingSkill, battlePassPoints, battlePassClaimed[], streak*,
  autoCatch*, autoPotion*, ...}}` — fonte boa pra tela de perfil no piwdex.
- `GET /api/game/map-markers` -> `{map:{w,h}, hunts:[{slug, name, looktype, level,
  pixel:[x,y], area:"kanto", range:[x1,y1,x2,y2,?]}]}` — CATALOGO de todas as hunts
  com slug + level minimo + posicao no mapa-mundi (~45KB). E a lista canonica de
  slugs validos pro `enter-hunt`.
- `GET /api/game/city-npcs?slug=<cidade>` -> NPCs da cidade `[{x, y, id, kind:
  "nurse|market|pokedepot|shop|fishing|outland_merchant"}]`
- `GET /api/game/offline` -> `{report:null|{...}}` (relatorio do ganho offline)
- Assets estaticos em `/game/`: `creatures.json`, `items.json`, `collision.json`,
  `offsets.json`, `draworder.json`, `maps/<cidade>.json`, `corpses/corpses.json`,
  `asset-packs/version.json`
- NENHUMA mutacao vai por REST na captura — tudo que muta a conta e frame WS.

## Mapa pro Hunt Analyzer (igual ao do jogo)
- Derrotados = contagem de `field-kill`
- XP ganha = soma `field-kill.xpGained` (breakdown em `xpParts`)
- Capturados = `catch-result` com `success:true`
- Loot = acumula `field-kill.loot[]` (valor via npcPrice do data)
- Supply = delta de `balls.counts` x priceGold (+ pocoes)
- Saldo = loot + capturas - supply
