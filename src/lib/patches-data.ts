// Ponte entre o diário em disco e as telas.
//
// O arquivo `src/data/patches.json` é escrito pela ingestão e versionado no
// repositório, e mesmo assim tudo que sai daqui é DESCONFIADO — pelo mesmo
// motivo da bolsa e dos bosses, com um agravante: este arquivo é escrito por um
// robô que roda de seis em seis horas sem ninguém olhando. Uma passada
// interrompida no meio da escrita, um teto que mudou de forma, um campo que
// virou `null` — nada disso pode derrubar a página inteira.
//
// Entrada podre sai calada. Um patch que não passa no saneamento é um patch a
// menos na lista, e não uma tela de erro.

import bruto from "@/data/patches.json";
import type { Diario, Familia, Mudanca, Natureza, Patch } from "./patches";
import { DIARIO_VAZIO } from "./patches";

const NATUREZAS = new Set<string>([
  "especie-nova",
  "especie-sumiu",
  "stat",
  "tipo",
  "raridade",
  "nivel",
  "xp",
  "ouro",
  "ouro-abate",
  "evolucao",
  "drop-novo",
  "drop-sumiu",
  "drop-chance",
  "golpe-novo",
  "golpe-sumiu",
  "golpe-poder",
  "golpe-recarga",
  "golpe-nivel",
  "item-novo",
  "item-sumiu",
  "item-preco",
  "spot-novo",
  "spot-sumiu",
  "spot-nivel",
]);

const FAMILIAS = new Set<string>(["especie", "item", "spot"]);

function saneiaMudanca(x: unknown): Mudanca | null {
  if (!x || typeof x !== "object") return null;
  const m = x as Record<string, unknown>;
  if (typeof m.natureza !== "string" || !NATUREZAS.has(m.natureza)) return null;
  const a = m.alvo as Record<string, unknown> | undefined;
  if (!a || typeof a !== "object") return null;
  if (typeof a.familia !== "string" || !FAMILIAS.has(a.familia)) return null;
  if (typeof a.nome !== "string" || !a.nome) return null;
  if (typeof a.id !== "string" && typeof a.id !== "number") return null;
  return {
    natureza: m.natureza as Natureza,
    alvo: { familia: a.familia as Familia, id: a.id, nome: a.nome },
    ...(typeof m.detalhe === "string" && m.detalhe ? { detalhe: m.detalhe } : {}),
    de: (m.de ?? null) as Mudanca["de"],
    para: (m.para ?? null) as Mudanca["para"],
  };
}

function saneiaPatch(x: unknown): Patch | null {
  if (!x || typeof x !== "object") return null;
  const p = x as Record<string, unknown>;
  if (typeof p.id !== "string" || !p.id) return null;
  if (typeof p.data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(p.data)) return null;
  const mudancas = Array.isArray(p.mudancas)
    ? p.mudancas.map(saneiaMudanca).filter((m): m is Mudanca => m !== null)
    : [];
  // Patch sem mudança nenhuma não é patch vazio: é gravação interrompida. A
  // ingestão não escreve entrada sem conteúdo.
  if (!mudancas.length) return null;
  return {
    id: p.id,
    data: p.data,
    quando: typeof p.quando === "string" ? p.quando : p.data,
    desde: typeof p.desde === "string" ? p.desde : "",
    pipeline: Number.isFinite(Number(p.pipeline)) ? Number(p.pipeline) : 0,
    origem: typeof p.origem === "string" ? p.origem : "desconhecida",
    mudancas,
    cortadas: Math.max(0, Math.trunc(Number(p.cortadas) || 0)),
    avisos: Array.isArray(p.avisos) ? p.avisos.filter((a): a is string => typeof a === "string") : [],
  };
}

function lerDiario(): Diario {
  const d = bruto as unknown as Record<string, unknown>;
  if (!d || typeof d !== "object" || !Array.isArray(d.patches)) return DIARIO_VAZIO;
  const patches = d.patches.map(saneiaPatch).filter((p): p is Patch => p !== null);
  // A ordem é a do arquivo (a ingestão põe o novo na frente), mas ordenar aqui
  // custa nada e protege de uma escrita fora de ordem virar uma linha do tempo
  // embaralhada na tela.
  patches.sort((a, b) => (a.quando < b.quando ? 1 : a.quando > b.quando ? -1 : 0));
  return {
    pipeline: Number(d.pipeline) || 0,
    atualizadoEm: typeof d.atualizadoEm === "string" ? d.atualizadoEm : "",
    patches,
  };
}

export const DIARIO: Diario = lerDiario();

export const PATCHES: Patch[] = DIARIO.patches;

export const patchPorId = (id: string): Patch | undefined => PATCHES.find((p) => p.id === id);

export const ultimoPatch = (): Patch | undefined => PATCHES[0];

/**
 * O catálogo do jogo está mais novo do que o último patch registrado?
 *
 * É a única pergunta que impede esta página de mentir por omissão. O diário é
 * escrito por uma rotina de seis em seis horas; se ela quebrar, a página fica
 * exatamente igual — completa, datada, e velha. Comparar com o carimbo AO VIVO
 * do `source.ts` faz a tela dizer "o jogo mexeu em algo que ainda não entrou
 * aqui" em vez de deixar o silêncio passar por "nada mudou".
 */
export function pendente(catalogoEm: string): boolean {
  const ultimo = ultimoPatch();
  if (!ultimo) return true;
  // Compara por INSTANTE, e nunca por string. O `generatedAt` do catálogo ao
  // vivo é o `Last-Modified` cru da fonte — "Wed, 20 Aug 2026 03:03:51 GMT" —, e
  // o do diário é ISO. Comparados como texto, "W" ganha de "2" e a página
  // anunciava atraso em cima de um diário perfeitamente em dia.
  const cat = Date.parse(catalogoEm);
  const reg = Date.parse(ultimo.quando);
  if (!Number.isFinite(cat) || !Number.isFinite(reg)) return false;
  return cat > reg;
}

/** `AAAA-MM-DD` de uma data que pode vir em ISO ou em cabeçalho HTTP. Vazio
 *  quando não dá pra ler — tela nenhuma deve imprimir data que ela não entendeu. */
export function dia(quando: string): string {
  const t = Date.parse(quando);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : "";
}
