import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL } from "@/lib/site";
import {
  BOT_URL,
  SERVE_BOT,
  SERVE_SITE,
  ehApiDoRobo,
  ehArquivoDeRaiz,
  ehCaminhoDoRobo,
  ehHostDoBot,
} from "@/lib/robo/papel";

/**
 * Quem atende cada host.
 *
 * Uma imagem so publica dois enderecos (o porque esta em `lib/robo/papel.ts`) e
 * e aqui que eles se separam: a dex em `piwdex.com.br`, o robo em
 * `bot.piwdex.com.br`. Cada tela existe num host so, e pedir no host errado nao
 * da erro — leva pro endereco certo.
 *
 * Isso nao e cortesia. Endereco duplicado num site que vive de busca e o pior
 * resultado possivel, e "a mesma pagina responde nos dois dominios" e a forma
 * mais facil de criar duplicata sem perceber.
 *
 * Em Next 16 este arquivo se chama `proxy.ts`: a convencao `middleware.ts` foi
 * depreciada e renomeada, e a funcao exportada se chama `proxy`.
 */

/**
 * "Esse endereco nao existe aqui."
 *
 * Reescreve pra um caminho que nenhuma rota casa, e e isso que faz o Next
 * renderizar o `app/not-found.tsx` com status 404. O jeito curto seria devolver
 * `new NextResponse(null, { status: 404 })`, mas ai o visitante recebe uma
 * pagina em branco em vez do 404 desenhado do site.
 */
function naoExisteAqui(req: NextRequest) {
  return NextResponse.rewrite(new URL("/_endereco-inexistente", req.url));
}

/**
 * O `robots.txt` do subdominio do robo.
 *
 * Ele nao pode ser o do site: la o arquivo CONVIDA o rastreador, e aqui tudo e
 * area logada. Sai daqui em vez de virar um `app/robo-robots.ts` porque o
 * conteudo depende do HOST, e o `robots.ts` do Next nao ve o host — ele geraria
 * um arquivo so pros dois dominios, e quem perde nesse empate e sempre o site.
 */
function robotsDoRobo() {
  return new NextResponse("User-agent: *\nDisallow: /\n", {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" },
  });
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Arquivo que o Next serve por caminho proprio vale nos dois hosts, e sai
  // antes de qualquer decisao: sem isto o subdominio devolveria o pedido do
  // proprio favicon pro site.
  if (ehArquivoDeRaiz(pathname)) return NextResponse.next();

  const noBot = ehHostDoBot(req.headers.get("host"));
  const doRobo = ehCaminhoDoRobo(pathname);

  if (noBot) {
    // Host do robo chegando num processo que so serve a dex. Nao invente
    // resposta: sem as telas na imagem, qualquer coisa que nao seja 404 mente.
    if (!SERVE_BOT) return naoExisteAqui(req);

    if (doRobo) return NextResponse.next();
    if (pathname === "/robots.txt") return robotsDoRobo();
    // O subdominio nao tem conteudo pra indexar, entao nao tem sitemap.
    if (pathname === "/sitemap.xml") return naoExisteAqui(req);
    // A porta de entrada do subdominio e o painel; ele proprio manda pro login
    // quem ainda nao entrou.
    if (pathname === "/") return NextResponse.redirect(new URL("/painel", req.url));

    // Qualquer outra coisa e da dex, e a dex mora no outro endereco.
    return NextResponse.redirect(new URL(`${pathname}${search}`, SITE_URL));
  }

  // --- host do site ---

  // Processo que so serve o robo recebendo o apex (dominio apontado errado, ou o
  // `*.up.railway.app` do proprio servico): manda pro endereco certo em vez de
  // servir a dex de dentro do servico do robo.
  if (!SERVE_SITE) {
    return NextResponse.redirect(new URL(`${pathname}${search}`, BOT_URL));
  }

  if (doRobo) {
    // API no host errado nao se conserta com redirecionamento: um POST de login
    // chegaria no outro dominio sem corpo e sem cookie. 404 e a resposta honesta.
    if (ehApiDoRobo(pathname)) return naoExisteAqui(req);
    return NextResponse.redirect(new URL(`${pathname}${search}`, BOT_URL));
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Tudo, menos o que e servido como arquivo. Sem a exclusao, cada um dos ~910
   * sprites da grade passaria por aqui — e o `public/` inteiro junto.
   */
  matcher: [
    "/((?!_next/static|_next/image|game-sprites/|images/|favicon.ico|ads.txt|llms.txt).*)",
  ],
};
