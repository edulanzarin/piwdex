import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { ehConsumivel, lerLoja, lerMochila } from "@/lib/robo/jogo/loja";
import { atualizarTokens, lerVinculo } from "@/lib/robo/vinculo";

export const runtime = "nodejs";

/**
 * O catalogo da loja e a mochila.
 *
 * A tela de automacao precisa dos dois pra deixar de ser um formulario de ids:
 * qual bola repor sai do catalogo, e o que marcar pra venda sai do que a mochila
 * de fato tem, com o preco do NPC ao lado. Escolher item por numero era o que
 * fazia essa configuracao ficar desligada pra sempre.
 */
export async function GET() {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  const v = await lerVinculo(usuario.id);
  if (!v) return NextResponse.json({ erro: "sem_vinculo" }, { status: 409 });

  const [loja, mochila] = await Promise.all([lerLoja(v.tokens), lerMochila(v.tokens)]);
  if (!loja) return NextResponse.json({ erro: "jogo_fora_do_ar" }, { status: 502 });
  if (loja.mudou) await atualizarTokens(usuario.id, loja.tokens).catch(() => {});

  return NextResponse.json({
    loja: loja.loja,
    // So DROP. Pocao, revive e bola ficam de fora: sao o que a cacada gasta, e
    // oferecer os dois na mesma lista de venda e como a bolsa fica vazia por um
    // clique em "marcar tudo".
    //
    // Ordenado pelo que rende mais: a decisao de "o que deixo o robo vender" e
    // sobre o que enche a mochila, e o topo da lista e onde ela se resolve.
    mochila: (mochila?.itens ?? [])
      .filter((i) => i.quantidade > 0 && !ehConsumivel(i.categoria))
      .sort((a, b) => b.quantidade * b.precoNpc - a.quantidade * a.precoNpc),
  });
}
