# Protocolo do WebSocket do jogo (Poke Idle World) — revertido por captura

Conexao: `wss://poke.idleworld.online/ws<shard>?token=<accessJWT>&cmid=<hex>`
- WS cru, frames JSON `{"type":...}`. Token na query (sem auth por frame).
- **Single-session**: a conexao mais nova ganha; a anterior recebe "Conta em uso" e
  cai. O piwdex conectar = roubar a sessao do navegador (e vice-versa).
- Shard descoberto varrendo ws1..ws64 (shard errado fecha com code 4003). Cacheado
  em `link.shard`. Ver `src/lib/game-ws.ts` (`fetchActivePokes`).

## Cliente -> servidor (↑ enviados)
- `{"type":"pokes-get"}` -> responde `pokes`
- `{"type":"boosts-refresh"}`, `{"type":"badge-refresh"}`, `{"type":"trade-get"}`
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
- `autohelper` `{autoCatch, autoCatchBallId, autoCatchShiny, ...}`
- `boosts`, `mail-badge`, `events`, `history` (chat inicial)

### Stream da hunt (so depois do "entrar no campo")
- `field` (~2/seg): `{seq, serverNow, hero:{row,col,facing}, mobs:[{slot,speciesId,hp,
  maxHp,dead,respawning,shiny}], corpses:[], targetSlot, fighting, heroHp, heroMaxHp,
  fainted, reviveInMs, allMobsDead, hits:[{slot,amount,eff,move,type}]}`
- **`field-kill`** (o KILL): `{xpGained, totalXp, level, leveledUp, loot:[{itemId,name,
  qty}], speciesName, shiny, xpParts:{base,streak,boost,vip,event,typeDay,debuff}}`
- `poke-xp` `{id, speciesId, xpGained, xp, level, leveledUp}` — XP do poke ativo
- `catch-result` `{auto, success, speciesName, ballName, ballId, row, col}`
- `balls`/`inventory` reenviados a cada mudanca (bola gasta, loot dropado)
- `shiny-global` — broadcast mundial quando alguem pega shiny (nao e teu)

## Mapa pro Hunt Analyzer (igual ao do jogo)
- Derrotados = contagem de `field-kill`
- XP ganha = soma `field-kill.xpGained` (breakdown em `xpParts`)
- Capturados = `catch-result` com `success:true`
- Loot = acumula `field-kill.loot[]` (valor via npcPrice do data)
- Supply = delta de `balls.counts` x priceGold (+ pocoes)
- Saldo = loot + capturas - supply
