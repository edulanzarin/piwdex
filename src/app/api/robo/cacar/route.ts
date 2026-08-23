import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { espiarSessao } from "@/lib/robo/motor/sessao";
import { salvarDesejado } from "@/lib/robo/motor/desejado";
import { fetchSource } from "@/lib/source";

export const runtime = "nodejs";

/**
 * Comeca ou encerra a cacada, sem mexer na sessao.
 *
 * Corpo com `slug` entra na hunt; corpo vazio sai do campo. Trocar de cacada e
 * mandar outro slug: o motor sai do campo antigo e entra no novo pelo mesmo
 * socket, sem largar a sessao e sem dar ao jogo a chance de devolve-la pro
 * navegador no meio.
 */
export async function POST(req: Request) {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  let slug = "";
  try {
    const b = (await req.json()) as { slug?: string };
    slug = String(b?.slug ?? "").trim();
  } catch {
    /* corpo vazio: e o pedido de PARAR a cacada */
  }

  const s = espiarSessao(usuario.id);
  if (!s) return NextResponse.json({ erro: "sem_sessao" }, { status: 409 });

  if (!slug) {
    await salvarDesejado(usuario.id, { slug: null });
    if (!s.pararCacada()) return NextResponse.json({ erro: "sem_sessao" }, { status: 409 });
    return NextResponse.json({ ok: true, slug: null });
  }

  // O slug tem que existir no catalogo. Nao e paranoia: `enter-hunt` com um slug
  // inventado nao da erro nenhum — o jogo simplesmente nao inicia o campo, e o
  // painel ficaria "cacando" com tudo zerado, sem nada explicando por que.
  const fonte = await fetchSource();
  if (!fonte.hunts.some((h) => h.slug === slug)) {
    return NextResponse.json({ erro: "hunt_desconhecida" }, { status: 400 });
  }

  await salvarDesejado(usuario.id, { slug });
  if (!s.cacar(slug)) return NextResponse.json({ erro: "sem_sessao" }, { status: 409 });
  return NextResponse.json({ ok: true, slug });
}
