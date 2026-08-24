/**
 * O aviso de "pesquisaram este pokemon", do lado do navegador.
 *
 * ## Por que ele existe separado do motor
 *
 * `lib/destaque.ts` e `server-only` (fala com o banco). As ferramentas sao
 * componentes de cliente. A ponte e esta funcao, e ela e de proposito a coisa
 * mais burra possivel: um POST que ninguem espera.
 *
 * ## O que NAO deve chamar aqui
 *
 * O "preencher exemplo". O pokemon que ele carrega nao foi escolhido por
 * ninguem — e o site ensinando a usar a tela. Contar ele faria o destaque medir
 * o proprio tutorial, e como o exemplo e sempre o mesmo, ele venceria toda
 * eleicao pra sempre.
 */

/** Evita repetir o mesmo pokemon na mesma aba: o servidor ja deduplica por dia,
 *  mas nao ha razao pra gastar rede confirmando o que ele vai descartar. */
const jaAvisados = new Set<number>();

export function pingDestaque(pokeId: number | null | undefined): void {
  if (typeof window === "undefined") return;
  if (!Number.isInteger(pokeId) || (pokeId as number) <= 0) return;
  const id = pokeId as number;
  if (jaAvisados.has(id)) return;
  jaAvisados.add(id);

  // `keepalive` porque a escolha de um pokemon costuma vir junto de uma
  // navegacao: sem ele o navegador cancela o pedido ao trocar de pagina, e o
  // uso que mais conta — o que levou alguem pra outra tela — seria o que mais
  // se perde.
  void fetch("/api/destaque", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
    keepalive: true,
  }).catch(() => {
    // Silencio: e um contador de enfeite, nao pode aparecer pra ninguem.
  });
}
