import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { aplicarAuto, lerAuto, limparPatch } from "@/lib/robo/jogo/auto";
import { lerMochila } from "@/lib/robo/jogo/loja";
import { separarConsumivel } from "@/lib/robo/motor/jobs";
import { atualizarTokens, lerVinculo, marcarVencido } from "@/lib/robo/vinculo";

export const runtime = "nodejs";

/**
 * O Auto-Helper do JOGO — captura, pocao e revive automaticos.
 *
 * Vai por REST de proposito, mesmo com a sessao aberta: e config da conta, nao
 * comando de campo, e REST nao disputa o WebSocket. O frame `autohelper` chega
 * depois e atualiza o painel sozinho.
 */
export async function GET() {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  const v = await lerVinculo(usuario.id);
  if (!v) return NextResponse.json({ erro: "sem_vinculo" }, { status: 409 });

  const r = await lerAuto(v.tokens);
  if (!r) return NextResponse.json({ erro: "jogo_fora_do_ar" }, { status: 502 });
  if ("vencido" in r) {
    await marcarVencido(usuario.id).catch(() => {});
    return NextResponse.json({ erro: "vinculo_vencido" }, { status: 409 });
  }
  if (r.mudou) await atualizarTokens(usuario.id, r.tokens).catch(() => {});

  /**
   * A bolsa, so pocao e revive.
   *
   * O seletor de pocao do jogo escolhe entre o que a CONTA tem, como o de bola —
   * oferecer o catalogo da loja mostraria pocao que nao esta na bolsa e esconderia
   * a que esta (ver a mesma armadilha em `Duas listas parecidas...`). E o revive
   * vem junto por outra razao: sem nenhum na bolsa o Auto-Revive nao levanta
   * ninguem, e o proprio jogo avisa isso.
   */
  const bolsa = await lerMochila(r.tokens).then((m) => (m ? separarConsumivel(m.itens) : null)).catch(() => null);

  return NextResponse.json({
    auto: r.auto,
    bolas: r.bolas,
    pocoes: bolsa?.heal ?? [],
    revives: bolsa?.revive ?? [],
    /** `false` = nao deu pra conferir a bolsa; a tela nao pode ler isso como vazia */
    bolsaLida: !!bolsa,
  });
}

export async function POST(req: Request) {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  let bruto: unknown = {};
  try {
    bruto = await req.json();
  } catch {
    return NextResponse.json({ erro: "corpo_invalido" }, { status: 400 });
  }

  // Campo desconhecido nao chega ao jogo: a lista branca de `CAMPOS_AUTO` e o
  // unico contrato que a rota aceita.
  const patch = limparPatch(bruto);
  if (!Object.keys(patch).length) return NextResponse.json({ erro: "nada_a_mudar" }, { status: 400 });

  const v = await lerVinculo(usuario.id);
  if (!v) return NextResponse.json({ erro: "sem_vinculo" }, { status: 409 });

  const r = await aplicarAuto(v.tokens, patch);
  if (r.mudou) await atualizarTokens(usuario.id, r.tokens).catch(() => {});
  if (!r.ok || !r.leitura) {
    return NextResponse.json({ erro: "jogo_recusou", status: r.status }, { status: 502 });
  }
  return NextResponse.json({ auto: r.leitura.auto, bolas: r.leitura.bolas });
}
