import { NextResponse } from "next/server";
import { idDoVotante, registrarUso } from "@/lib/destaque";

/**
 * Registra que alguem PESQUISOU um pokemon.
 *
 * Chamada por `pingDestaque` quando uma ferramenta recebe uma especie escolhida
 * de fato — nunca pelo "preencher exemplo", que e o proprio site enchendo a tela.
 *
 * ## Ela responde 204 sempre, e isso e proposital
 *
 * O cliente dispara e esquece (`keepalive`), entao um corpo de erro nao chega a
 * lugar nenhum. Devolver 4xx aqui so serviria pra pintar de vermelho o console de
 * quem estiver com a aba aberta — e a contagem do destaque nao vale um erro na
 * tela de ninguem.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** O IP de quem chamou, atras do proxy do Railway. */
function ipDe(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

export async function POST(req: Request) {
  try {
    const { id } = (await req.json()) as { id?: unknown };
    const pokeId = Number(id);
    if (Number.isInteger(pokeId) && pokeId > 0) {
      const dia = new Date().toISOString().slice(0, 10);
      const votante = idDoVotante(ipDe(req), req.headers.get("user-agent") ?? "", dia);
      await registrarUso(pokeId, votante);
    }
  } catch {
    // ver o cabecalho: contagem de destaque nao derruba nada, nem grita.
  }
  return new NextResponse(null, { status: 204 });
}
