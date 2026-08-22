// O endereco publico do site, num lugar so.
//
// Ele aparece no sitemap, no robots e nos metadados sociais — tres lugares que
// discordariam entre si no dia em que o dominio mudasse. `NEXT_PUBLIC_SITE_URL`
// existe pra ambiente de teste apontar pra si mesmo sem editar codigo.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://piwdex.com.br").replace(/\/$/, "");
