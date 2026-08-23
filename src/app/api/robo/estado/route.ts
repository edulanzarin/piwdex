import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { estadoDe, sessaoDe } from "@/lib/robo/motor/sessao";

export const runtime = "nodejs";
// Um stream nao pode ser cacheado nem pre-renderizado: ele nunca "termina".
export const dynamic = "force-dynamic";

/**
 * O estado do robo, ao vivo, num stream so.
 *
 * A alternativa seria a tela perguntar de tempos em tempos por analyzer, time,
 * fila, status, vida e reconexao — seis pollings pra um dado que o servidor JA
 * sabe na hora em que muda. O v1 chegou a ter oito, e cada um deles era uma
 * pergunta repetida cuja resposta quase sempre era "nada mudou".
 *
 * Duas travas seguram o custo:
 *
 * - **Teto de frequencia.** O frame `field` chega ~2x por segundo e o analyzer a
 *   cada 2s; empurrar tudo faria a tela redesenhar mais do que um olho le. Um
 *   envio por segundo, no maximo, com a ultima versao sempre chegando.
 * - **Batimento.** Proxy fecha conexao ociosa sem avisar ninguem. Um comentario
 *   SSE a cada 20s mantem o cano aberto sem gerar renderizacao.
 */

const TETO_MS = 1_000;
const BATIMENTO_MS = 20_000;

export async function GET(req: Request) {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  // `sessaoDe` e nao `espiarSessao`: quem abre o painel sem robo ligado precisa
  // de um emissor pra assinar — senao a tela so veria o estado inicial e ficaria
  // muda ate um F5.
  const sessao = sessaoDe(usuario.id);
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(controle) {
      let vivo = true;
      let pendente = false;
      let ultimoEnvio = 0;
      let atraso: ReturnType<typeof setTimeout> | null = null;

      const escrever = (texto: string) => {
        if (!vivo) return;
        try {
          controle.enqueue(enc.encode(texto));
        } catch {
          vivo = false;
        }
      };

      const mandarEstado = () => {
        ultimoEnvio = Date.now();
        pendente = false;
        escrever(`event: estado\ndata: ${JSON.stringify(estadoDe(usuario.id))}\n\n`);
      };

      /**
       * O chat viaja num evento SEPARADO.
       *
       * Ele muda devagar (uma mensagem por vez) e o estado muda a cada segundo
       * enquanto a cacada corre. Juntos, trezentas mensagens seriam reenviadas
       * sessenta vezes por minuto — a mesma conversa, de novo, pra sempre.
       */
      const mandarChat = () => {
        escrever(`event: chat\ndata: ${JSON.stringify(sessao.chatAtual())}\n\n`);
      };

      const aoMudar = () => {
        if (pendente) return;
        const espera = Math.max(0, TETO_MS - (Date.now() - ultimoEnvio));
        if (espera === 0) {
          mandarEstado();
          return;
        }
        pendente = true;
        atraso = setTimeout(() => {
          atraso = null;
          if (vivo) mandarEstado();
        }, espera);
      };

      mandarEstado();
      mandarChat();
      sessao.on("mudou", aoMudar);
      sessao.on("chat", mandarChat);

      const batida = setInterval(() => escrever(": batida\n\n"), BATIMENTO_MS);

      const encerrar = () => {
        if (!vivo) return;
        vivo = false;
        clearInterval(batida);
        if (atraso) clearTimeout(atraso);
        // Tirar o ouvinte e obrigatorio, nao higiene: sem isso cada aba aberta
        // deixa um listener preso na sessao, que vive o processo inteiro. O
        // EventEmitter avisa aos dez e vaza memoria muito antes disso.
        sessao.off("mudou", aoMudar);
        sessao.off("chat", mandarChat);
        try { controle.close(); } catch { /* ja fechado */ }
      };

      req.signal.addEventListener("abort", encerrar);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      // O proxy do Railway (e o nginx de qualquer um) bufferiza por padrao, e um
      // stream bufferizado nao e um stream: a tela receberia tudo de uma vez, no
      // fim.
      "x-accel-buffering": "no",
    },
  });
}
