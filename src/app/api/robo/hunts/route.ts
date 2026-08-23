import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { fetchSource } from "@/lib/source";

export const runtime = "nodejs";

/** As hunts que o `enter-hunt` aceita — a lista canonica de slugs, do catalogo
 *  do jogo que a dex ja mantem fresco. */
export async function GET() {
  const { resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  const fonte = await fetchSource();
  const hunts = fonte.hunts
    .map((h) => ({ slug: h.slug, nome: h.name, level: h.level, area: h.area }))
    .sort((a, b) => a.level - b.level || a.nome.localeCompare(b.nome, "pt-BR"));

  return NextResponse.json({ hunts });
}
