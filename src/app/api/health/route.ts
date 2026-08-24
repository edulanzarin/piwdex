import { NextResponse } from "next/server";
import { SERVE_BOT } from "@/lib/robo/papel";
import { saudeDaGuarda } from "@/lib/robo/motor/guarda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sonda de vida do processo.
 *
 * Ela veio do piwdex v1 e sobrevive a ele por um motivo de infra, nao de
 * produto: o `railway.json` aponta o `healthcheckPath` pra ca, e healthcheck que
 * responde 404 e deploy que o Railway marca como falho e **nao promove**. Ou
 * seja, sem esta rota a troca de versao nao chega ao ar — o site velho continua
 * servindo e o log nao diz que o problema e uma rota que sumiu.
 *
 * O `uptimeSeconds` era do robo, que segurava WebSocket e estado em memoria e
 * morria calado quando o container reiniciava. Aqui nao ha estado em memoria que
 * doa perder... com uma excecao: o `source.ts` guarda o catalogo do jogo em
 * memoria e o revalida por ETag. Container que reinicia sozinho a toda hora
 * refaz o download de 1,6 MB toda vez, e isso e invisivel nos logs (o app loga
 * "Ready" nas duas vezes). Abra duas vezes com minutos de diferenca: se o numero
 * VOLTOU pra perto de zero, o processo morreu no meio.
 *
 * Sem tocar o catalogo de proposito. Se a fonte do jogo cair, o site continua de
 * pe servindo o snapshot, e o orquestrador nao pode mata-lo por causa disso.
 */
const BOOT = Date.now();

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      uptimeSeconds: Math.round((Date.now() - BOOT) / 1000),
      startedAt: new Date(BOOT).toISOString(),
      now: new Date().toISOString(),
      /**
       * Quanto a guarda de processo ja aparou (so no servico do robo).
       *
       * Sobreviver a exceção nao e o mesmo que estar bem: um numero que sobe e o
       * robo mascarando defeito que precisa de conserto na origem. Sem publica-lo
       * aqui, a rede de seguranca viraria exatamente o que ela nao pode ser — um
       * jeito silencioso de o erro deixar de aparecer.
       */
      ...(SERVE_BOT ? { guarda: saudeDaGuarda() } : {}),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
