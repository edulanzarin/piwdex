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
| Rota de hunt / Breeding / Meta | prontos |
| Robo (area logada, em bot.piwdex.com.br) | pronto |

## Dois enderecos, uma imagem

O piwdex publica **a dex em `piwdex.com.br`** e **o robo em
`bot.piwdex.com.br`**, a partir do mesmo codigo. Quem decide o papel do processo
e `PIW_ROLE` (`site` | `bot` | `ambos`), e o `src/proxy.ts` roteia por host.

A separacao existe por uma razao so, e ela e cara: o robo segura um WebSocket por
usuario, e WebSocket morre inteiro a cada deploy. Enquanto os dois dividiam um
servico, cada publicacao da dex derrubava a cacada de todo mundo — e o log nao
acusava nada, porque um processo novo escreve "Ready" igual ao que rodava ha
horas. Servicos separados = cadencias de deploy separadas.

`PIW_ROLE` ausente em producao vale `site`: esquecer a variavel deixa a dex
intacta e o robo apagado.

## O que o robo faz

**Ligar o robo e tomar a sessao de jogo**, e nada alem disso: o WebSocket **e** a
sessao, e o jogo aceita uma por conta. Cacar e um TRABALHO que roda em cima dela,
ao lado de vender, repor e falar no chat — por isso da pra ligar o robo sem
escolher cacada nenhuma, e trocar de hunt sem largar a sessao.

Os trabalhos:

| Trabalho | Como |
|---|---|
| Cacar | `enter-hunt` + poll do analyzer; kills, capturas e fila de captura ao vivo |
| Levantar o lider | Revive da bolsa em campo; sem Revive, sai do campo e usa a Joy |
| Repor consumivel | bola, pocao e revive, por piso/alvo, com teto de gasto |
| Vender drop | lista BRANCA de itens, respeitando o cadeado do jogador |
| Vender pokemon | so o que passa por todos os vetos (time, lider, inicial, cadeado, shiny, IV, nivel) |
| Automacao do jogo | liga o Auto-Helper (auto-catch, auto-potion, auto-revive) e escolhe as bolas |
| Chat | le os tres canais e manda mensagem pelo mesmo socket (nada sai sozinho) |
| Subir de nivel | escolhe o alvo e troca de hunt sozinho ate o nivel pedido |

No cockpit esses trabalhos moram em DUAS abas, e a linha entre elas e quem
executa. **Automacao** e o Auto-Helper: captura, pocao e revive automaticos, que
rodam no servidor do JOGO — o robo so liga o interruptor, e quando nao pega o
motivo e o VIP de la. **Loja** e o balcao: repor consumivel, vender drop, vender
pokemon, tudo chamada REST nossa e tudo mexendo em ouro. Numa aba so, a decisao
de quanto gastar ficava a tres rolagens da de quanto se recebe, que e a unica
comparacao que essa tela precisa permitir.

A reposicao nunca compra sem CONFERIR a bolsa. O estoque de pocao e revive e
lido por REST na hora da decisao, e nao herdado do frame `inventory` do socket:
o frame nasce vazio a cada conexao, bolsa vazia le como "zero pocoes", zero fura
qualquer piso — e uma conta com 400 pocoes comprava 100 a cada minuto enquanto o
socket nao mandasse o primeiro frame. Nao saber quanto tem e razao pra nao
comprar.

Comprar e vender vao por REST, e por isso podem acontecer com a cacada correndo:
REST nao disputa a sessao. Tudo que MUTA a conta em campo sai pelo socket ja
aberto — abrir um segundo derrubaria a propria cacada.

Nenhuma automacao nasce ligada.

### A cacada automatica reusa o motor da dex

Ela nao tem calculo proprio: chama o mesmo `buildRoute` que a ferramenta publica
de rota usa pra responder "quem cacar do 40 ao 80", com dano, ameaca e XP/h nivel
a nivel. O que a camada do robo acrescenta e o **slug** — o motor raciocina em
especie (`pokeId`) e o `enter-hunt` quer o ponto no mapa.

Escrever uma segunda versao aqui daria duas respostas pra mesma pergunta, e a do
robo seria a que ninguem revisa.

### Quando ele para de tentar

O codigo com que o jogo fecha o WebSocket e a informacao mais importante que o
motor recebe, e cada um pede o oposto do outro:

| Fechamento | O que o motor faz |
|---|---|
| `4003 wrong-shard` | redescobre o shard por sondagem paralela e reconecta |
| `4001 unauthorized` | renova o par; recusado de novo, PARA e marca o vinculo `expired` |
| `4004` | recusa de conta: terminal |
| queda comum | backoff exponencial ate 60s |

Ignorar esse codigo (o desenho antigo) produzia um robo que reconecta pra sempre
sem nunca cacar, e uma tela que so sabia dizer "sessão perdida". O painel hoje
mostra o codigo cru, a frase do jogo e a acao que resolve.

## Rodar

```bash
npm install
npm run dev          # http://localhost:4071
PORT=3000 npm run dev   # outra porta, sem criar script novo
```

Em desenvolvimento o papel padrao e `ambos`: o mesmo servidor atende
`localhost:4071` (dex) e `bot.localhost:4071` (robo). O navegador resolve
`bot.localhost` sozinho, sem mexer em `/etc/hosts`.

O robo precisa de banco:

```bash
docker compose up -d db
npm run db:migrate
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
    robo/         A AREA LOGADA (so o servico do robo usa)
      papel.ts    qual host este processo atende
      auth.ts     login do site (Auth.js sobre SQL puro)
      sessao.ts   os dois portoes: logado, e assinante
      vinculo.ts  a conta do JOGO por usuario (tokens cifrados)
      jogo/       falar com o jogo: token, REST, WebSocket, shard
      motor/      a sessao de cacada viva + o estado desejado
    source.ts     fonte do catalogo: ETag, cache, fallback
    data.ts       derivacoes (indice reverso de drop, spots, evolucao)
    dex.ts        motor da dex: o que se pode perguntar e como ordenar
    dex-url.ts    a pergunta serializada na URL
    items.ts      motor dos itens: de onde vem, da pra farmar, rende quanto
    items-url.ts  a mesma serializacao, do lado dos itens
    calc-url.ts   o pokemon da calculadora, serializado no link
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

Slug `piwdex2` governa o nome de tudo (`piwdex2-app`, `piwdex2-bot`,
`piwdex2-db`, rede `piwdex2-net`). Porta interna constante (3000), externa por
variavel. O projeto tem **duas** portas de app e um banco: **4071** (dex),
**4072** (robo), **5071** (banco).

## Aviso

Projeto de fa. Sem vinculo com os autores do Poke Idle World.

A camada publica (dex, itens, calculadoras) e 100% de LEITURA. O robo, por
definicao, nao e: ele age na conta do proprio usuario, com a credencial que o
proprio usuario forneceu, e so enquanto ele o mantem ligado.
