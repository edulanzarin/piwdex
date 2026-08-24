import { NextResponse } from "next/server";
import { exigirConta } from "@/lib/robo/conta";
import { pedirAoJogo } from "@/lib/robo/jogo/auth";
import { normalizarPerfil } from "@/lib/robo/jogo/pokes";
import { lerBolas } from "@/lib/robo/jogo/auto";
import { ehConsumivel, lerMochila } from "@/lib/robo/jogo/loja";
import { espiarSessao } from "@/lib/robo/motor/sessao";
import { lerConfig } from "@/lib/robo/motor/config";
import { vendaveis } from "@/lib/robo/motor/jobs";
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
export async function GET(req: Request) {
  const { alvo, resposta } = await exigirConta(req);
  if (resposta) return resposta;
  const { usuario, conta: v } = alvo;


  const [me, bolas, mochila] = await Promise.all([
    pedirAoJogo("/api/characters/me", v.tokens).catch(() => null),
    pedirAoJogo("/api/game/balls", v.tokens).catch(() => null),
    lerMochila(v.tokens).catch(() => null),
  ]);

  if (!me) return NextResponse.json({ erro: "jogo_fora_do_ar" }, { status: 502 });
  if (me.mudou) await atualizarTokens(v.id, me.tokens).catch(() => {});
  if (!me.res.ok) return NextResponse.json({ erro: "vinculo_vencido" }, { status: 409 });

  const perfil = normalizarPerfil(await me.res.json().catch(() => null));
  const catalogo = bolas?.res.ok ? lerBolas(await bolas.res.json().catch(() => null)) : [];
  const itens = mochila?.itens.filter((i) => i.quantidade > 0) ?? [];

  // Time e box juntos, com a marca de quem a venda automatica levaria. A sessao
  // viva tem a lista fresca; sem ela, o snapshot gravado no vinculo ainda
  // responde o time (o box so existe com o socket aberto).
  const viva = espiarSessao(v.id);
  const estado = viva?.estado();
  const box = viva?.boxAoVivo() ?? [];
  const time = estado?.time.length ? estado.time : (v.time?.lista ?? []);
  const cfg = await lerConfig(v.id).catch(() => null);
  const marcados = cfg ? new Set(vendaveis(box, cfg).map((p) => p.id)) : new Set<string>();

  return NextResponse.json({
    perfil,
    bolas: catalogo,
    // A BOLSA e o que a cacada GASTA: bola, pocao, revive. Ela mora separada da
    // mochila porque as duas respondem perguntas opostas — uma diz com o que da
    // pra continuar cacando, a outra diz o que a cacada ja rendeu.
    consumiveis: itens.filter((i) => ehConsumivel(i.categoria)),
    pokemons: [
      ...time.map((p) => ({ ...p, vendavel: false })),
      ...box.map((p) => ({ ...p, vendavel: marcados.has(p.id) })),
    ],
    /** o box so existe com a sessao aberta: a tela precisa saber a diferenca
     *  entre "box vazio" e "o robo esta desligado" */
    boxVivo: !!estado?.conectado,
    // Ordenada pelo que ocupa mais valor: a pergunta que a mochila responde e "o
    // que esta parado aqui", e o topo da lista e onde ela se resolve.
    mochila: itens
      .filter((i) => !ehConsumivel(i.categoria))
      .sort((a, b) => b.quantidade * b.precoNpc - a.quantidade * a.precoNpc),
  });
}
