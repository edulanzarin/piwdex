# Deploy no Railway

O que colar no **Raw Editor** da aba *Variables* do serviço, e as armadilhas que
não aparecem no painel.

## O que o código de fato lê

Cinco variáveis, e só. Todo o resto (`PORT`, `HOSTNAME`, `NODE_ENV`,
`NEXT_TELEMETRY_DISABLED`) já é responsabilidade do `Dockerfile`.

| variável | quando é lida | se faltar |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | build **e** runtime | cai em `https://piwdex.com.br` |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | **build** | site sem anúncio nenhum |
| `NEXT_PUBLIC_ADSENSE_SLOT_RODAPE` | **build** | faixa do rodapé não existe |
| `NEXT_PUBLIC_ADSENSE_SLOT_GRADE` | **build** | grade sem anúncio intercalado |
| `NEXT_PUBLIC_ADSENSE_LAYOUT_GRADE` | **build** | unidade de feed sobe e não pinta |

`PIW_TOKEN` aparece no código mas é do `scripts/ingest.mjs`, que roda na máquina
do Eduardo. **Não** vai pro Railway.

## 1. Agora: site no ar, sem anúncio

```json
{
  "NEXT_PUBLIC_SITE_URL": "https://piwdex.com.br",
  "PORT": "3000",
  "NEXT_PUBLIC_ADSENSE_CLIENT": "",
  "NEXT_PUBLIC_ADSENSE_SLOT_RODAPE": "",
  "NEXT_PUBLIC_ADSENSE_SLOT_GRADE": "",
  "NEXT_PUBLIC_ADSENSE_LAYOUT_GRADE": ""
}
```

As quatro do AdSense vão vazias de propósito: elas existem pra você preencher
depois sem ter que lembrar o nome de cada uma. Vazio é o estado desligado, e ele
não desenha nem espaço reservado.

## 2. Com o Postgres ligado

```json
{
  "NEXT_PUBLIC_SITE_URL": "https://piwdex.com.br",
  "PORT": "3000",
  "DATABASE_URL": "${{Postgres.DATABASE_PRIVATE_URL}}",
  "NEXT_PUBLIC_ADSENSE_CLIENT": "",
  "NEXT_PUBLIC_ADSENSE_SLOT_RODAPE": "",
  "NEXT_PUBLIC_ADSENSE_SLOT_GRADE": "",
  "NEXT_PUBLIC_ADSENSE_LAYOUT_GRADE": ""
}
```

Três coisas sobre essa linha:

- **`Postgres` é o NOME DO SERVIÇO** no seu projeto, não uma palavra mágica. Se o
  serviço se chamar `piwdex-db`, a referência é `${{piwdex-db.DATABASE_PRIVATE_URL}}`.
- **`DATABASE_PRIVATE_URL`, não `DATABASE_URL`.** A pública sai pela internet e
  conta como egress cobrado; a privada anda pela rede interna do projeto e é de
  graça. Dois serviços no mesmo projeto nunca precisam da pública.
- **Hoje isto não faz nada.** O piwdex2 não tem uma linha de código de banco: a
  camada pública (dex, itens, calculadoras) não tem estado, e o robô está em
  `parked/`, fora do `tsconfig`. Subir um Postgres agora é conta rodando pra um
  banco ocioso. Vale se você quer a reserva feita; não vale se é pra "já deixar
  pronto".

## 3. Depois da aprovação no AdSense

```json
{
  "NEXT_PUBLIC_SITE_URL": "https://piwdex.com.br",
  "PORT": "3000",
  "NEXT_PUBLIC_ADSENSE_CLIENT": "ca-pub-0000000000000000",
  "NEXT_PUBLIC_ADSENSE_SLOT_RODAPE": "0000000000",
  "NEXT_PUBLIC_ADSENSE_SLOT_GRADE": "0000000000",
  "NEXT_PUBLIC_ADSENSE_LAYOUT_GRADE": "-fb+5w+4e-db+86"
}
```

O `ads.txt` **não** é variável: é arquivo em `public/`, entra na imagem no build.
Trocar a linha dele é commit, não painel.

## As armadilhas

### `NEXT_PUBLIC_*` é decidido no BUILD, não no restart

O Next inlina essas variáveis no bundle do cliente durante o `next build`. Mudar
o valor no painel e reiniciar o serviço não muda nada — tem que **rebuildar**.

O Railway já faz a coisa certa aqui: alterar variável dispara deploy novo, e como
o `Dockerfile` recebe cada uma como `ARG`, o valor diferente invalida o cache da
camada do `npm run build`. Só não confunda com "restart", que não rebuilda.

### Variável em branco não é variável ausente

Este par derrubou o build uma vez:

```dockerfile
ARG NEXT_PUBLIC_SITE_URL=""      # ARG vazio entrega STRING VAZIA, não undefined
```
```ts
process.env.NEXT_PUBLIC_SITE_URL ?? "https://piwdex.com.br"   // ?? aceita ""
```

`??` só cai no padrão com `undefined` ou `null`. Com string vazia ele devolve a
vazia, e `new URL("")` estoura no `metadataBase` — build inteiro no chão por uma
variável opcional deixada em branco. Hoje o código usa `||` com `.trim()`. Vale
pra qualquer variável nova: **em config, use `||`.**

### O `docker-compose.yml` não é usado aqui

Ele é o chassi de desenvolvimento e do servidor próprio. O Railway lê o
`Dockerfile` da raiz direto, e o par de portas 4071/5071 do projeto não significa
nada lá — quem publica é o proxy do Railway.

### Porta

`PORT=3000` bate com o `ENV PORT=3000` e o `EXPOSE 3000` do `Dockerfile`, e o
`HOSTNAME=0.0.0.0` (também no `Dockerfile`) é o que faz o processo aceitar
conexão de fora do container. Sem ele o Next escuta só no hostname da máquina e o
proxy do Railway não alcança.

### Domínio

Enquanto o site estiver no `*.up.railway.app`, `NEXT_PUBLIC_SITE_URL` continua
apontando pra `piwdex.com.br` — e isso é o certo. Sitemap, canonical e metadado
social têm que declarar o endereço **canônico**, não o temporário. Não troque por
`https://${{RAILWAY_PUBLIC_DOMAIN}}`: você ensinaria o Google a indexar o domínio
do Railway.

O AdSense, porém, analisa o domínio que você cadastrar. Cadastre `piwdex.com.br`
só depois do DNS apontado e do site respondendo nele.
