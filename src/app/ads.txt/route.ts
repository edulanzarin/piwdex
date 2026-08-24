import { ADSENSE_CLIENT } from "@/lib/ads";

export const dynamic = "force-static";

/**
 * O `ads.txt` — quem pode vender o inventario deste site.
 *
 * Ele e GERADO e nao um arquivo em `public/`, e a razao e a que o arquivo antigo
 * escrevia como aviso pra si mesmo: "o id tambem entra em `lib/ads.ts`, os dois
 * precisam bater". Dois lugares que precisam bater sao dois lugares que um dia
 * nao batem — e o modo de falha e cruel, porque nada quebra: o site serve
 * anuncio normalmente e o AdSense marca o inventario como nao autorizado, o que
 * aparece semanas depois como receita que nao chega.
 *
 * Aqui ha uma fonte so. O publisher id sai do MESMO `ADSENSE_CLIENT` que monta o
 * script e as unidades, tirando o prefixo `ca-` que o formato do arquivo nao usa.
 * Esquecer a variavel no build passa a produzir as duas metades do desligado ao
 * mesmo tempo — sem script e sem autorizacao — em vez de meia configuracao.
 *
 * `f08c47fec0942fa0` e o id de certificacao do Google, igual pra toda conta: e
 * dele que a especificacao fala, nao da sua conta.
 *
 * `robots.ts` guarda o outro lado disto: `/ads.txt` nao pode ser bloqueado.
 */
export function GET() {
  const publisher = ADSENSE_CLIENT.trim().replace(/^ca-/, "");

  const corpo = publisher
    ? `google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`
    : [
        "# Sem conta configurada: este arquivo nao autoriza ninguem a vender o",
        "# inventario deste site, que e o estado certo pra quem ainda nao tem",
        "# AdSense. A linha aparece sozinha quando NEXT_PUBLIC_ADSENSE_CLIENT",
        "# estiver presente NO BUILD.",
        "",
      ].join("\n");

  return new Response(corpo, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
