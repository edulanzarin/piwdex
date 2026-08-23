import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { pedirAoJogo } from "@/lib/robo/jogo/auth";
import { normalizarPerfil } from "@/lib/robo/jogo/pokes";
import { lerBolas } from "@/lib/robo/jogo/auto";
import { lerMochila } from "@/lib/robo/jogo/loja";
import { atualizarTokens, lerVinculo } from "@/lib/robo/vinculo";

export const runtime = "nodejs";

/**
 * A conta inteira: treinador, bolsa e mochila.
 *
 * Tudo por REST, e essa e a razao de existir: abrir o jogo no navegador pra
 * conferir o saldo custa a sessao — com o robo ligado, custa a cacada. Aqui a
 * mesma informacao sai sem tomar nada de ninguem.
 *
 * As tres chamadas vao em paralelo porque nenhuma depende da outra, e a soma
 * serial delas seria o tempo de abertura da aba.
 */
export async function GET() {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  const v = await lerVinculo(usuario.id);
  if (!v) return NextResponse.json({ erro: "sem_vinculo" }, { status: 409 });

  const [me, bolas, mochila] = await Promise.all([
    pedirAoJogo("/api/characters/me", v.tokens).catch(() => null),
    pedirAoJogo("/api/game/balls", v.tokens).catch(() => null),
    lerMochila(v.tokens).catch(() => null),
  ]);

  if (!me) return NextResponse.json({ erro: "jogo_fora_do_ar" }, { status: 502 });
  if (me.mudou) await atualizarTokens(usuario.id, me.tokens).catch(() => {});
  if (!me.res.ok) return NextResponse.json({ erro: "vinculo_vencido" }, { status: 409 });

  const perfil = normalizarPerfil(await me.res.json().catch(() => null));
  const catalogo = bolas?.res.ok ? lerBolas(await bolas.res.json().catch(() => null)) : [];

  return NextResponse.json({
    perfil,
    bolas: catalogo,
    // Ordenada pelo que ocupa mais valor: a pergunta que a mochila responde e "o
    // que esta parado aqui", e o topo da lista e onde ela se resolve.
    mochila: (mochila?.itens ?? [])
      .filter((i) => i.quantidade > 0)
      .sort((a, b) => b.quantidade * b.precoNpc - a.quantidade * a.precoNpc),
  });
}
