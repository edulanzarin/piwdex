# API do Poke Idle World — o que a captura completa entregou

Extraido de um HAR com TODAS as acoes do jogo executadas a mao (ago/2026): loja,
mercado, Flint, diaria, missoes, breeding, DM, rankings. Endpoint, corpo e
resposta **conferidos**, nao adivinhados.

O HAR nao entra no repositorio (`.gitignore`: `docs/*.har`) — sao 223 MB e ele
carrega token de sessao. Este arquivo e o que sobrevive dele.

## Ja implementado

| endpoint | uso |
|---|---|
| `GET /api/characters/me` | perfil, Auto-Helper, VIP |
| `GET /api/game/balls` | estoque de bola |
| `GET /api/game/shop` · `POST /api/game/shop/buy` · `/sell` | loja do NPC |
| `GET /api/game/depot` | mochila |
| `GET /api/game/item/lock` | cadeado do jogador |
| `POST /api/game/pokemon/sell` | venda de pokemon |
| `POST /api/game/auto-helper` | Auto-Helper |
| `GET /api/game/daily` · `POST {}` | diaria |
| `GET /api/game/battle-pass` · `POST {action:"claim-mission",missionId}` / `{action:"claim-tier",tier,premium}` | passe |
| `GET /api/game/flint` · `POST /api/game/flint/sell {itemId,qty}` | pedra, em Pewter |

### Formas que importam

**`/api/game/daily`** — `{canClaim, claimedToday, nextDay, blockedByVip,
rewards:[{day,label,qty,kind,claimed,current}]}`. O POST devolve
`{claimed:{label,qty,kind}}`.

**`/api/game/battle-pass`** — `{points, premium, maxTier, missions:[{id,label,
target,have,done,claimed,bpp}], tiers:[{tier,bpp,reached,free:{label,qty},
freeClaimed,prem:{...},premClaimed}]}`. Pendente = `done && !claimed` na missao,
`reached && !freeClaimed` no tier.

**`/api/game/flint`** — `{gold, stones:[{id,name,quantity,unitPrice}], catalog}`.
`stones` e o que a bolsa TEM; `catalog` e o que ele compraria. O preco e por
unidade e nao e o mesmo da loja comum — pedra vendida no balcao errado rende uma
fracao.

## Mapeado e ainda NAO implementado

| endpoint | o que da pra fazer | o que falta decidir |
|---|---|---|
| `GET /api/game/market?category=` · `POST /api/game/market/action` | anunciar item no mercado de jogadores: `{action:"sell",kind:"item",refId,quantity,price,currency:"GOLD"}` | **preco**. Anunciar sozinho exige uma regra de preco (piso, media do mercado, % abaixo do menor) — e um anuncio errado tira o item da bolsa por um valor que ninguem revisou |
| `GET /api/game/tasks` | missoes de NPC por cidade: `{tasks:[{id,npc,city,goals,goalProgress,complete,claimed,xp,cash}]}` | o POST de coleta **nao apareceu na captura** — precisa de uma nova, clicando em "entregar" |
| `GET /api/game/streak` | bonus por abate acumulado: `{earned,spent,available,nextCost,canBuy,tracks:{exp,loot,shiny}}` | o POST de compra de ponto nao apareceu; e **em que trilha** gastar e decisao de estrategia |
| `GET /api/game/breeding?action=center` · `?action=quote&parent1&parent2&free=0|1` | o motor de breeding do piwdex ja calcula o par; falta o comando de criar | o POST de criar ovo nao apareceu na captura |
| `GET /api/game/gifts` | central de presentes (`{gifts:[]}` quando vazia) | a forma de um presente e o POST de resgate |
| `GET /api/game/boss` · `/rankings` · `/pokedex` · `/professions` · `/friends` · `/dm/inbox` | leitura | nada disso muta a conta; e material de TELA, nao de automacao |
| `GET /api/game/hunt-config?slug=` | config por hunt | conferir se acrescenta algo ao que o catalogo publico ja da |
| `POST /api/game/outfits/equip {looktype}` | trocar visual | cosmetico |
| `POST /api/game/fishing-tier {tierId}` | tier de pesca | entender a mecanica antes |

**A captura nao tem o POST de tasks, streak, breeding e gifts** — o que aparece
la e so a leitura. Implementar contra suposicao ali seria mandar um corpo que o
jogo ignora e responder 200: a tela diria "coletado" e nada teria acontecido.
Ver `[[Campo cujo nome você não sabe se lê do payload, nunca se chuta]]`.
