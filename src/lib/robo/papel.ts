/**
 * Qual das duas caras deste mesmo codigo o processo esta servindo.
 *
 * O piwdex publica DOIS enderecos a partir de uma imagem so: a dex em
 * `piwdex.com.br` e o robo em `bot.piwdex.com.br`. Nao e capricho de
 * organizacao — e a licao mais cara do v1, anotada no Brain como
 * "Processo que guarda conexao viva nao tolera deploy frequente": o robo segura
 * um WebSocket por usuario, e o WebSocket morre inteiro a cada deploy. Enquanto
 * a dex e o robo dividiam o mesmo servico, cada push de SEO derrubava a cacada
 * de todo mundo, e o log nao acusava nada (processo novo escreve "Ready"
 * igualzinho ao que rodava ha horas). Servicos separados = cadencias de deploy
 * separadas: publicar a dex tres vezes num dia deixa de ser um evento pro robo.
 *
 * Este arquivo e importado pelo `proxy.ts`, que roda antes de qualquer rota e em
 * TODA requisicao. Por isso ele se mantem no osso: leitura de env e comparacao
 * de string, sem banco e sem import pesado. Nao e limite de runtime (o proxy do
 * Next 16 roda em Node), e custo por requisicao.
 */

export type Papel = "site" | "bot" | "ambos";

/**
 * `site` = so a dex. `bot` = so o robo. `ambos` = os dois no mesmo processo,
 * separados por host (e o modo de desenvolvimento: um `npm run dev` atende
 * `localhost` e `bot.localhost` ao mesmo tempo).
 *
 * O padrao em producao e `site`, e a escolha e deliberada. A regra do chassi
 * manda validar env no boot, mas aqui a variavel ausente tem um estado seguro
 * obvio: o servico que ja esta no ar hoje e a dex. Esquecer a variavel deixa a
 * dex intacta e o robo apagado; qualquer outro padrao ou derruba o site por
 * falta de config, ou vaza as telas do robo pro dominio da busca.
 */
export const PAPEL: Papel = (() => {
  const bruto = process.env.PIW_ROLE?.trim().toLowerCase();
  if (bruto === "site" || bruto === "bot" || bruto === "ambos") return bruto;
  return process.env.NODE_ENV === "production" ? "site" : "ambos";
})();

export const SERVE_SITE = PAPEL === "site" || PAPEL === "ambos";
export const SERVE_BOT = PAPEL === "bot" || PAPEL === "ambos";

/** Endereco publico do robo. So muda em ambiente de teste. */
export const BOT_URL = (process.env.NEXT_PUBLIC_BOT_URL?.trim() || "https://bot.piwdex.com.br")
  .replace(/\/$/, "");

/**
 * O host pedido e o do robo?
 *
 * Compara so o hostname (o `Host` vem com a porta em dev) e aceita tres formas:
 * o host configurado, qualquer coisa comecando em `bot.` e o `bot.localhost` do
 * desenvolvimento — que o Chrome e o Firefox resolvem pra 127.0.0.1 sozinhos,
 * sem mexer em `/etc/hosts` e sem gastar uma segunda porta do par reservado.
 */
export function ehHostDoBot(host: string | null | undefined): boolean {
  if (!host) return false;
  const nome = host.split(":")[0].toLowerCase();
  if (!nome) return false;
  let configurado = "";
  try {
    configurado = new URL(BOT_URL).hostname.toLowerCase();
  } catch {
    /* BOT_URL torto: sobra o prefixo, que ja cobre o caso real */
  }
  return nome === configurado || nome.startsWith("bot.");
}

/**
 * As telas que existem no subdominio do robo, e SO elas.
 *
 * E lista explicita, nao prefixo comum (`/robo/*`), e a diferenca importa: com
 * prefixo, o endereco que a pessoa ve carregaria o nome da pasta pra sempre
 * (`bot.piwdex.com.br/robo/painel`), e a alternativa — reescrever `/painel` pra
 * `/robo/painel` — arrastaria junto tudo que o Next serve por caminho proprio:
 * `/icon.png`, `/opengraph-image.jpg`, os assets de rota. Cada um deles viraria
 * um 404 silencioso no subdominio.
 *
 * O preco e ter que lembrar de somar a rota aqui ao criar uma tela nova. E um
 * preco barato: sao cinco, e esquecer manda o visitante pro site em vez de
 * quebrar a pagina.
 */
export const ROTAS_ROBO = [
  "/entrar",
  "/criar-conta",
  "/conectar",
  "/painel",
  "/assinatura",
] as const;

/** Caminhos de API que so respondem no subdominio do robo. */
export const APIS_ROBO = ["/api/robo", "/api/auth"] as const;

const casa = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

/** O caminho pertence ao robo (tela ou API)? */
export function ehCaminhoDoRobo(pathname: string): boolean {
  return (
    ROTAS_ROBO.some((r) => casa(pathname, r)) || APIS_ROBO.some((r) => casa(pathname, r))
  );
}

/** So as APIs — que, no host errado, viram 404 em vez de redirecionamento:
 *  redirecionar um POST de login pra outro dominio nao entrega nada util. */
export function ehApiDoRobo(pathname: string): boolean {
  return APIS_ROBO.some((r) => casa(pathname, r));
}

/**
 * Arquivo que o Next serve por caminho proprio e que vale nos DOIS hosts:
 * favicon, icone da aba, imagem social. Sem esta excecao, o subdominio do robo
 * mandaria o pedido do proprio favicon de volta pro site.
 */
export function ehArquivoDeRaiz(pathname: string): boolean {
  return (
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png" ||
    pathname === "/opengraph-image.jpg" ||
    pathname.startsWith("/_next/")
  );
}
