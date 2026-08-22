import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagem standalone pro Docker (chassi do Brain).
  output: "standalone",

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
