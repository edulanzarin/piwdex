import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * O robots do site.
 *
 * Duas regras existem por causa do AdSense, e as duas sao do tipo que se descobre
 * tarde: **nao bloquear `/ads.txt`** (e por ele que o Google confere quem pode
 * vender o inventario) e **nao bloquear o `Mediapartners-Google`** — esse robo e
 * quem LE a pagina pra escolher anuncio contextual. Bloquear ele nao protege
 * nada; so faz o anuncio vir generico.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: "Mediapartners-Google", allow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
