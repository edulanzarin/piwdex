// O endereco publico do site, num lugar so.
//
// Ele aparece no sitemap, no robots e nos metadados sociais — tres lugares que
// discordariam entre si no dia em que o dominio mudasse. `NEXT_PUBLIC_SITE_URL`
// existe pra ambiente de teste apontar pra si mesmo sem editar codigo.
//
// `||` e nao `??`, e a diferenca nao e estilo: variavel VAZIA nao e variavel
// ausente pro `??`. Uma plataforma que declara a variavel sem valor (o `ARG`
// vazio do Dockerfile, o campo em branco no painel do Railway) entrega string
// vazia, o `??` a aceita como valor bom, e `new URL("")` derruba o build inteiro
// no `metadataBase`. O `.trim()` cobre o espaco solto que sobra de copiar e colar.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://piwdex.com.br")
  .replace(/\/$/, "");
