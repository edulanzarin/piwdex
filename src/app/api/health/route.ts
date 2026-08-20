import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sonda de vida do processo. Existe por dois motivos, e o segundo e o que importa aqui:
//
//  1. o Railway precisa de um `healthcheckPath` pra saber que o deploy subiu de pe;
//  2. o robo depende de um processo que NAO MORRE — ele segura WebSocket e estado em
//     memoria. Um container que dorme e acorda derruba todas as sessoes, e isso e
//     invisivel nos logs (o app loga "Ready" nas duas vezes). `uptimeSeconds` denuncia:
//     abra duas vezes com minutos de diferenca — se o numero VOLTOU pra perto de zero,
//     o processo morreu no meio, e nenhuma hunt sobreviveu.
//
// Sem banco de proposito: se o Postgres piscar, o app continua vivo e nao queremos que
// o orquestrador o mate por isso.

const BOOT = Date.now();

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      uptimeSeconds: Math.round((Date.now() - BOOT) / 1000),
      startedAt: new Date(BOOT).toISOString(),
      now: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
