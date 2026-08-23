import type { NextConfig } from "next";

/**
 * O endereco do robo, repetido aqui porque `next.config.ts` e carregado antes de
 * qualquer alias de modulo existir — importar de `@/lib/robo/papel` nao resolve.
 * Mesma leitura, mesmo padrao, mesmo `||` (variavel em branco nao e variavel
 * ausente).
 */
const BOT_URL = (process.env.NEXT_PUBLIC_BOT_URL?.trim() || "https://bot.piwdex.com.br")
  .replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Imagem standalone pro Docker (chassi do Brain).
  output: "standalone",

  /**
   * Redirecionamentos herdados do piwdex v1, que este site substituiu no ar.
   *
   * Os dois grupos existem por razoes diferentes, e nenhum deles e sobre esta
   * versao — sao sobre links que ja circulam por ai e nao vao deixar de existir
   * so porque o codigo atras deles mudou.
   */
  async redirects() {
    return [
      // 1. O canonico e o APEX. Sem esta regra o mesmo site responde em dois
      //    enderecos, e buscador trata isso como conteudo duplicado — o pior
      //    resultado possivel pra um site que vive de busca.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.piwdex.com.br" }],
        destination: "https://piwdex.com.br/:path*",
        permanent: true,
      },

      // 2. O cockpit do robo. As rotas dele estao salvas no proprio jogo, no
      //    Discord e no favorito de quem usava, e agora tem pra onde ir: o robo
      //    voltou, noutro endereco. Estes quatro redirects sao a ponte entre o
      //    nome antigo (`/vip`, `/bot-app`, aqui no apex) e o novo.
      //
      //    Segue TEMPORARIO (307) por enquanto. `permanent` ensina navegador e
      //    buscador a nunca mais pedir a rota original — e caro de desfazer, e
      //    so vale a pena depois que o subdominio estiver no ar e estavel. A
      //    troca pra 308 e uma palavra neste arquivo.
      { source: "/vip", destination: `${BOT_URL}/painel`, permanent: false },
      { source: "/vip/:path*", destination: `${BOT_URL}/painel`, permanent: false },
      { source: "/bot-app", destination: `${BOT_URL}/painel`, permanent: false },
      { source: "/bot-app/:path*", destination: `${BOT_URL}/painel`, permanent: false },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      /**
       * Cache dos arquivos de `public/`.
       *
       * O que o Next empacota sai com hash no nome e ja ganha `immutable`
       * sozinho. O que vive em `public/` NAO passa por esse hash: sai com cache
       * curto, e o navegador revalida arquivo por arquivo a cada navegacao. No
       * grid da dex isso e ~60 sprites por pagina virando ~60 requisicoes
       * condicionais com tudo ja em disco — 60 idas de rede pra receber 60
       * "nao mudou".
       *
       * As regras somam com o bloco de seguranca acima em vez de substituir: sao
       * chaves diferentes, e sobrescrita so acontece entre a MESMA chave (nesse
       * caso vence a ultima).
       */
      {
        // Aqui da pra prometer `immutable` porque o NOME e o conteudo:
        // `/game-sprites/<looktype>.webp` sai do bake do catalogo, entao looktype
        // novo e arquivo novo — nunca o mesmo nome com outro desenho. Se um dia
        // um sprite precisar ser REDESENHADO no mesmo looktype, o jeito de
        // publicar e trocar o nome (ou versionar a pasta), e nao encurtar este
        // cache: quem ja visitou fica um ano com o arquivo velho.
        source: "/game-sprites/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // `/images/` NAO leva `immutable`, e a diferenca e deliberada: aqui mora
        // arte AUTORAL que e re-gerada com o mesmo nome (`wallpaper.webp` pelo
        // `bake:wallpaper`, os icones pelo `scripts/pixel-icons/`). Congelar por
        // um ano um arquivo que muda de conteudo sem mudar de nome deixaria quem
        // ja visitou com o wallpaper antigo e sem nenhuma forma de invalidar.
        //
        // Um dia de cache mata a revalidacao por navegacao — que era o custo —, e
        // `stale-while-revalidate` faz a proxima visita servir do disco na hora e
        // buscar a versao nova em segundo plano. Sao ~10 arquivos: o ganho estava
        // em `/game-sprites`, aqui o que importa e nao criar um cache que nao da
        // pra desfazer.
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=2592000" },
        ],
      },
    ];
  },
};

export default nextConfig;
