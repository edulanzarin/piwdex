import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { getData } from "@/lib/data";

export const runtime = "nodejs";

/**
 * A ficha de catalogo de UMA especie: id, tipos e stats base.
 *
 * Existe pra o modal de pokemon poder calcular. Ele precisa dos stats BASE pra
 * estimar os IVs individuais a partir dos stats finais, e o catalogo tem ~910
 * especies: mandar o mapa inteiro pro navegador custaria dezenas de KB numa tela
 * que abre um pokemon por vez.
 *
 * Aceita `id` ou `nome` porque as duas fontes chegam diferentes: o time e o box
 * trazem `speciesId`, e o cartao colado no chat traz so o NOME.
 */
export async function GET(req: Request) {
  const { resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  const q = new URL(req.url).searchParams;
  const id = Number(q.get("id") ?? 0);
  const nome = (q.get("nome") ?? "").trim().toLowerCase();
  if (!id && !nome) return NextResponse.json({ erro: "sem_alvo" }, { status: 400 });

  const db = await getData();
  const c = id
    ? db.getCreature(id)
    : db.creatures.find((x) => x.name.toLowerCase() === nome);
  if (!c) return NextResponse.json({ erro: "desconhecida" }, { status: 404 });

  return NextResponse.json({
    especie: {
      speciesId: c.pokeId,
      nome: c.name,
      t1: c.type1,
      t2: c.type2,
      raridade: c.rarity,
      bases: [c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed],
    },
  });
}
