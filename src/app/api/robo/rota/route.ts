import { NextResponse } from "next/server";
import { exigirConta } from "@/lib/robo/conta";
import { espiarSessao } from "@/lib/robo/motor/sessao";
import { lerConfig } from "@/lib/robo/motor/config";
import { planejarRota } from "@/lib/robo/motor/rota";

export const runtime = "nodejs";

/**
 * O plano da subida, sem precisar ligar nada.
 *
 * A tela pode mostrar a rota ANTES de o usuario ligar a cacada automatica — que e
 * a unica forma de ele decidir se concorda com ela. Ligar pra descobrir o que o
 * robo pretende fazer e a ordem errada quando o robo joga sozinho por horas.
 *
 * O lider sai da sessao viva quando ha uma; sem ela, do snapshot de time gravado
 * no vinculo.
 */
export async function GET(req: Request) {
  const { alvo: dono, resposta } = await exigirConta(req);
  if (resposta) return resposta;
  const { conta: v } = dono;

  const cfg = await lerConfig(v.id);
  const alvo = Number(new URL(req.url).searchParams.get("alvo") ?? cfg.nivelAlvo);

  const viva = espiarSessao(v.id)?.estado();
  let lider = viva?.time.find((p) => p.leader) ?? viva?.time[0] ?? null;
  if (!lider) {
    const time = v.time?.lista ?? [];
    lider = time.find((p) => p.leader) ?? time[0] ?? null;
  }
  if (!lider) return NextResponse.json({ erro: "sem_lider" }, { status: 409 });

  const plano = await planejarRota(lider, alvo, { vip: viva?.perfil?.vip });
  if (!plano) {
    return NextResponse.json(
      { erro: lider.level >= alvo ? "ja_passou" : "sem_rota", lider: lider.name, nivel: lider.level },
      { status: 409 },
    );
  }
  return NextResponse.json({ ...plano, lider: lider.name, nivel: lider.level });
}
