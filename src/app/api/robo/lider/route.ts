import { NextResponse } from "next/server";
import { exigirConta } from "@/lib/robo/conta";
import { espiarSessao } from "@/lib/robo/motor/sessao";
import { lerVinculo } from "@/lib/robo/vinculo";
import { invocarLider } from "@/lib/robo/jogo/ws";
import { normalizarPokes } from "@/lib/robo/jogo/pokes";

export const runtime = "nodejs";

/** Troca o pokemon que caca. Pelo socket vivo quando ha um. */
export async function POST(req: Request) {
  const { alvo, resposta } = await exigirConta(req);
  if (resposta) return resposta;
  const { usuario, conta: v } = alvo;

  let pokeId = "";
  try {
    const b = (await req.json()) as { pokeId?: string };
    pokeId = String(b?.pokeId ?? "").trim();
  } catch {
    /* corpo invalido */
  }
  if (!pokeId) return NextResponse.json({ erro: "sem_poke" }, { status: 400 });

  if (espiarSessao(v.id)?.trocarLider(pokeId)) {
    return NextResponse.json({ ok: true, por: "sessao" });
  }

  // Sem shard nao da pra falar com o jogo por fora da sessao: a chamada
  // avulsa precisa saber em qual servidor a conta vive.
  if (!v.shard) return NextResponse.json({ erro: "sem_shard" }, { status: 409 });

  const lista = await invocarLider(v.tokens, v.shard, pokeId);
  if (!lista) return NextResponse.json({ erro: "nao_confirmou" }, { status: 502 });

  return NextResponse.json({ ok: true, por: "avulsa", time: normalizarPokes(lista).filter((p) => p.team) });
}
