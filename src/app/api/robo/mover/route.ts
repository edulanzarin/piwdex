import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { espiarSessao } from "@/lib/robo/motor/sessao";
import { lerVinculo } from "@/lib/robo/vinculo";
import { moverPoke } from "@/lib/robo/jogo/ws";
import { normalizarPokes } from "@/lib/robo/jogo/pokes";

export const runtime = "nodejs";

/** Move um pokemon entre o BOX e o TIME. Pelo socket vivo quando ha um — abrir
 *  um segundo derrubaria a cacada. */
export async function POST(req: Request) {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

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

  if (espiarSessao(usuario.id)?.moverPoke(pokeId, dir)) {
    return NextResponse.json({ ok: true, por: "sessao" });
  }

  const v = await lerVinculo(usuario.id);
  if (!v?.shard) return NextResponse.json({ erro: "sem_vinculo" }, { status: 409 });

  const lista = await moverPoke(v.tokens, v.shard, pokeId, dir);
  if (!lista) return NextResponse.json({ erro: "nao_confirmou" }, { status: 502 });
  return NextResponse.json({ ok: true, por: "avulsa", time: normalizarPokes(lista).filter((p) => p.team) });
}
