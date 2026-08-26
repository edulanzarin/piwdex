// A pergunta feita a um patch, na URL.
//
// Mesmo contrato da dex, dos itens e do breeding, e aqui o argumento é o de
// sempre com um agravante: um patch grande tem mais de mil mudanças, e a
// pergunta que se leva pra alguém nunca é "olha o patch" — é "olha o que fizeram
// com o Ledian" ou "olha quantos drops sumiram". Sem estado na URL, isso vira
// print de tela, que é o formato em que ninguém confere nada.
//
// São quatro campos e nenhum deles é a lista: a lista se recalcula do arquivo.

import type { Familia, Natureza } from "./patches";

export interface PatchQuery {
  /** busca livre por nome de espécie/item/ponto, ou por drop e golpe */
  q: string;
  /** naturezas escolhidas; vazio = todas */
  nat: Natureza[];
  /** família escolhida; `todas` não filtra */
  fam: Familia | "todas";
  /** `impacto` = o que mais mexeu primeiro; `nome` = alfabético pelo alvo */
  ord: "impacto" | "nome";
}

export const PATCH_PADRAO: PatchQuery = { q: "", nat: [], fam: "todas", ord: "impacto" };

const FAMILIAS: Array<Familia | "todas"> = ["todas", "especie", "item", "spot"];

export function lerPatchQuery(sp: URLSearchParams): PatchQuery {
  const fam = sp.get("fam") as Familia | "todas" | null;
  const ord = sp.get("ord");
  return {
    q: sp.get("q") ?? "",
    // Natureza chega como lista separada por vírgula. Ela NÃO é validada contra
    // a lista de naturezas de propósito: um valor inventado simplesmente não
    // casa com nada e o filtro devolve vazio, que é o que a URL pediu. Validar
    // aqui só trocaria "não achei" por "ignorei o que você escreveu".
    nat: (sp.get("nat") ?? "").split(",").filter(Boolean) as Natureza[],
    fam: fam && FAMILIAS.includes(fam) ? fam : "todas",
    ord: ord === "nome" ? "nome" : "impacto",
  };
}

/** Só o que difere do padrão entra na URL: uma tela recém-aberta tem endereço
 *  limpo, e o link que alguém manda diz exatamente o que ele mexeu. */
export function escreverPatchQuery(q: PatchQuery): string {
  const sp = new URLSearchParams();
  if (q.q.trim()) sp.set("q", q.q.trim());
  if (q.nat.length) sp.set("nat", q.nat.join(","));
  if (q.fam !== "todas") sp.set("fam", q.fam);
  if (q.ord !== "impacto") sp.set("ord", q.ord);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const patchQueryVazia = (q: PatchQuery): boolean =>
  !q.q.trim() && !q.nat.length && q.fam === "todas";
