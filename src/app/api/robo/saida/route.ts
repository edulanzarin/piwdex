import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { conexoesAbertas, tetoDeIp } from "@/lib/robo/motor/sessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Com que endereco o JOGO nos ve.
 *
 * Existe porque a pergunta confunde duas coisas que nao tem relacao: o IP de
 * ENTRADA (o que `piwdex.com.br` resolve, e por onde o navegador chega) e o de
 * SAIDA (o que a plataforma usa quando o nosso processo abre uma conexao pra
 * fora). O limite `4006` conta o segundo, e nenhum painel mostra esse numero.
 *
 * Supor a resposta seria o erro que este projeto ja pagou caro: a unica forma de
 * saber com que endereco saimos e PERGUNTAR pra alguem de fora.
 *
 * Duas fontes, e o acordo entre elas e o que da confianca: uma sozinha podendo
 * estar atras de cache ou proxy diria um numero que nao e o nosso.
 *
 * Admin so: e diagnostico de infraestrutura, nao dado de assinante.
 */
const ESPELHOS = [
  { nome: "cloudflare", url: "https://cloudflare.com/cdn-cgi/trace" },
  { nome: "ipify", url: "https://api.ipify.org?format=json" },
];

async function perguntar(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const txt = await r.text();
    // O `trace` do Cloudflare vem em linhas `chave=valor`; o ipify, em JSON.
    const m = txt.match(/(?:^|\n)ip=([^\n]+)/) ?? txt.match(/"ip"\s*:\s*"([^"]+)"/);
    return m?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const { usuario, resposta } = await exigirUsuarioApi();
  if (resposta) return resposta;
  if (!usuario.admin) return NextResponse.json({ erro: "so_admin" }, { status: 403 });

  const vistos = await Promise.all(ESPELHOS.map((e) => perguntar(e.url)));
  const enderecos = ESPELHOS.map((e, i) => ({ espelho: e.nome, ip: vistos[i] }));
  const unicos = [...new Set(vistos.filter(Boolean))];

  const teto = tetoDeIp();
  return NextResponse.json({
    /** o endereco com que o jogo nos ve, quando os dois espelhos concordam */
    saida: unicos.length === 1 ? unicos[0] : null,
    enderecos,
    /** dois valores diferentes = a plataforma usa um POOL de saida, e o teto do
     *  jogo pode variar entre uma conexao e outra */
    poolDeSaida: unicos.length > 1,
    conexoesAbertas: conexoesAbertas(),
    /**
     * O teto que o motor esta aplicando AGORA. `null` = nenhum (caducou ou nunca
     * houve). Ele expira em 30 min e sobe sozinho quando uma conexao abre acima
     * dele — um numero aprendido de uma observacao, sobre um recurso que pode ser
     * compartilhado, nao pode virar permanente.
     */
    tetoAprendido: Number.isFinite(teto) ? teto : null,
    /**
     * O ASN do endereco de saida, quando o espelho da Cloudflare informa.
     *
     * E o que distingue as duas hipoteses do `4006`: se o jogo limita por
     * DATACENTER (e nao por conta), o problema nao e quantas contas voce tem —
     * e de onde elas falam, e nenhum ajuste de teto resolve.
     */
    dica: "compare `saida` entre dois deploys: se mudar, a plataforma nao dá endereço fixo",
  });
}
