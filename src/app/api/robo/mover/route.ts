import { NextResponse } from "next/server";
import { exigirConta } from "@/lib/robo/conta";
import { espiarSessao } from "@/lib/robo/motor/sessao";
import { lerVinculo } from "@/lib/robo/vinculo";
import { moverPoke } from "@/lib/robo/jogo/ws";
import { normalizarPokes } from "@/lib/robo/jogo/pokes";

export const runtime = "nodejs";

/** Move um pokemon entre o BOX e o TIME. Pelo socket vivo quando ha um — abrir
 *  um segundo derrubaria a cacada. */
export async function POST(req: Request) {
  const { alvo, resposta } = await exigirConta(req);
  if (resposta) return resposta;
  const { usuario, conta: v } = alvo;

  let pokeId = "";
  let dir: "store" | "withdraw" = "withdraw";
  try {
    const b = (await req.json()) as { pokeId?: string; dir?: string };
    pokeId = String(b?.pokeId ?? "").trim();
    dir = b?.dir === "store" ? "store" : "withdraw";
  } catch {
    /* corpo invalido */
  }
  if (!pokeId) return NextResponse.json({ erro: "sem_poke" }, { status: 400 });

  if (espiarSessao(v.id)?.moverPoke(pokeId, dir)) {
    return NextResponse.json({ ok: true, por: "sessao" });
  }

  // Sem shard nao da pra falar com o jogo por fora da sessao: a chamada
  // avulsa precisa saber em qual servidor a conta vive.
  if (!v.shard) return NextResponse.json({ erro: "sem_shard" }, { status: 409 });

  const lista = await moverPoke(v.tokens, v.shard, pokeId, dir);
  if (!lista) return NextResponse.json({ erro: "nao_confirmou" }, { status: 502 });
  return NextResponse.json({ ok: true, por: "avulsa", time: normalizarPokes(lista).filter((p) => p.team) });
}
