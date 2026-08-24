# O robo precisa de um IP que seja SEU

## O sintoma

O jogo fecha o WebSocket com `4006 ip-limit` a partir da quarta ou quinta conta
conectada. O limite oficial, publicado no Discord do jogo, e de **20 contas**.

Quatro nao e vinte. O limite que estamos batendo nao e o nosso.

## O diagnostico

O jogo conta por ENDERECO DE SAIDA, e o nosso nao e nosso. O processo do robo
sai pelo NAT do Railway, um endereco compartilhado com outros inquilinos da
plataforma — e qualquer um deles que fale com o mesmo jogo consome a mesma cota
de 20. Nao ha nada a corrigir no codigo: a conta esta certa, o endereco e que
tem mais gente dentro.

Confirmar antes de gastar dinheiro:

```bash
curl -s https://bot.piwdex.com.br/api/robo/saida -H "cookie: <sessão de admin>"
```

- `poolDeSaida: true` — o Railway esta te dando enderecos diferentes por
  conexao (ele atribui tres, com balanceamento). Explica recusa intermitente sem
  padrao.
- `saida` mudando entre dois deploys — sem endereco fixo.
- `tetoAprendido` voltando a um numero baixo mesmo depois de caducar — o limite
  esta grudado no endereco.

## Por que o caminho obvio nao resolve

O Railway tem **Static Outbound IPs** no plano Pro, e a documentacao dele e
explicita:

> There is no guarantee that the IPv4 addresses assigned to your service are
> dedicated. They may be shared with other customers.

Estavel nao e o mesmo que exclusivo. Isso resolve allowlist de firewall (o caso
de uso que a Railway cita), e nao resolve dividir cota com estranhos.

## O que resolve

**Rodar o servico do ROBO num host com IPv4 dedicado.** Um endereco, seu, com os
20 inteiros.

Nao e proxy nem rotacao: e a mesma aplicacao, na mesma forma, numa maquina cujo
endereco nao esta sendo usado por mais ninguem. A diferenca entre as duas coisas
importa — uma faz um operador parecer varios, a outra para de confundir voce com
os outros.

E ja da pra fazer sem reescrever nada, porque o projeto foi partido em dois
servicos quando o robo ganhou subdominio:

| servico | onde | por que |
|---|---|---|
| dex (`PIW_ROLE=site`) | fica no Railway | e leitura publica, o IP de saida nao importa |
| robo (`PIW_ROLE=bot`) | host com IPv4 dedicado | e ele que abre os WebSockets |

### O que a mudanca exige

1. **Uma VM com IPv4 dedicado.** Hetzner CX22, DigitalOcean, Vultr — a faixa de
   4 a 6 euros/mes cobre com folga o que o robo consome.
2. **`docker compose up -d bot`** com o `.env` de producao. O `docker-compose.yml`
   ja tem o servico, e a imagem e a mesma dos dois papeis.
3. **`DATABASE_URL` alcancavel de fora.** Hoje o robo fala com o Postgres pela
   rede interna do Railway; de fora, precisa da URL publica do banco (o Railway
   oferece as duas). **TLS obrigatorio** — a URL publica atravessa a internet.
4. **DNS**: `bot.piwdex.com.br` passa a apontar pro IP novo, com TLS proprio
   (Caddy resolve com uma linha).
5. **A migration roda antes do container novo subir** — `npm run db:migrate`.

### O que NAO muda

Nada no codigo. `PIW_ROLE` ja decide o papel, o `proxy.ts` ja roteia por host, e
a dex continua servindo `piwdex.com.br` de onde esta.

## O que este projeto NAO vai fazer

Rotacao de IP, pool de proxies residenciais, ou qualquer coisa cujo proposito
seja fazer um operador parecer varios. O `4006` existe por uma razao legitima, e
o problema aqui e o oposto de burla-lo: e ter um endereco que corresponda a UMA
pessoa, que e exatamente o que o limite pressupoe.
