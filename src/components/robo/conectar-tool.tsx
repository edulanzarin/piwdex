"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, HowTo, Note, Panel } from "@/components/ui";
import type { StatusVinculo } from "@/lib/robo/vinculo";

/**
 * Conectar a conta do JOGO.
 *
 * O caminho e o token, e nao email e senha: o `/login` do jogo exige captcha
 * amarrado ao navegador, entao o servidor nao consegue logar por credencial nem
 * se quisesse. O efeito colateral e bom — a senha do jogo nunca sai do jogo.
 *
 * Duas entradas pro mesmo lugar:
 *
 * 1. **O favorito** (bookmarklet). Arrasta uma vez pra barra, clica dentro da
 *    aba do jogo, e ele abre esta pagina com o token no HASH da URL. Hash nao
 *    viaja pro servidor: o token chega pelo `fetch`, e a barra e limpa no mesmo
 *    tique. E o unico jeito de nao pedir pra ninguem abrir o DevTools.
 * 2. **Colar na mao**, pra quem nao usa barra de favoritos ou esta no celular.
 */

const COR = "var(--color-t-robo)";

/** O favorito, montado no cliente porque depende da origem em que a pagina abriu. */
function Favorito() {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Arrastar o favorito de `localhost` gravaria um atalho quebrado pra sempre
    // — em desenvolvimento ele aponta pro endereco real.
    const aqui = window.location.origin;
    const alvo = /localhost|127\.0\.0\.1/.test(aqui) ? "https://bot.piwdex.com.br" : aqui;
    const aviso = "Abra este favorito com o jogo aberto e logado.";
    const codigo =
      "javascript:(function(){try{" +
      "var r=sessionStorage.getItem('pokeweb:tokens')||localStorage.getItem('pokeweb:tokens');" +
      `if(!r){alert('${aviso}');return}` +
      `window.open('${alvo}/conectar#'+encodeURIComponent(r),'_blank')` +
      "}catch(e){alert('piwdex: '+e.message)}})()";
    // Via `setAttribute`: o React sanitiza `href="javascript:"` e o favorito
    // sairia vazio.
    ref.current?.setAttribute("href", codigo);
  }, []);

  return (
    <a
      ref={ref}
      href="/conectar"
      onClick={(e) => e.preventDefault()}
      draggable
      title="Arraste para a barra de favoritos"
      className="pix inline-flex cursor-grab select-none items-center gap-2 border px-3 py-2 text-[12px] transition-colors"
      style={{ borderColor: COR, color: COR }}
    >
      ⤓ conectar ao PIWdex
    </a>
  );
}

const RECADO: Record<string, string> = {
  token_invalido: "Não achei um token nesse texto. Copie o valor inteiro de `pokeweb:tokens`.",
  jogo_fora_do_ar: "O jogo não respondeu. Tente de novo em alguns minutos.",
  conta_bloqueada: "O jogo recusou esta conta. Reconectar não resolve — veja o que ele respondeu abaixo.",
  muitas_tentativas: "O jogo pediu para esperar. Tente de novo daqui a pouco.",
  token_recusado: "O jogo não aceitou esse token. Ele vence rápido — copie um recém-gerado.",
  limite_de_contas: "Você chegou no teto de contas do seu plano. Desligue uma abaixo para abrir espaço.",
  nao_autenticado: "Sua sessão no PIWdex caiu. Entre de novo.",
  assinatura_inativa: "O vínculo com o jogo faz parte da assinatura.",
};

export function ConectarTool({
  status,
  nomeJogador,
  motivoBloqueio,
  reconectando,
  jaLigadas,
  limite,
}: {
  status: StatusVinculo | null;
  nomeJogador: string | null;
  motivoBloqueio: string | null;
  /** o id da conta que se esta RECONECTANDO. `null` = conta nova */
  reconectando?: string | null;
  jaLigadas?: number;
  limite?: number;
}) {
  const router = useRouter();
  // `-1` = sem teto. `Infinity` nao atravessa JSON, entao o contrato manda -1.
  const semTeto = (limite ?? -1) < 0;
  const cheio = !semTeto && !reconectando && (jaLigadas ?? 0) >= (limite ?? 0);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<{ recado: string; doJogo?: string } | null>(null);
  const [pronto, setPronto] = useState(false);

  async function conectar(bruto: string) {
    setOcupado(true);
    setErro(null);
    try {
      // Com o id, o jogo sabe QUAL conta reconectar; sem ele, e uma a mais —
      // e colar o token de uma que ja existe reconecta ela, nao duplica.
      const res = await fetch(
        reconectando ? `/api/robo/conectar?conta=${encodeURIComponent(reconectando)}` : "/api/robo/conectar",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bruto }),
        },
      );
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        erro?: string;
        motivo?: string;
        status?: number;
      };
      if (res.ok && j.ok) {
        setPronto(true);
        setTexto("");
        router.refresh();
        setTimeout(() => router.push("/painel"), 900);
        return;
      }
      // Dois recados: o nosso diz o que fazer, o do jogo prova o que aconteceu.
      setErro({
        recado: RECADO[j.erro ?? ""] ?? "Não consegui conectar.",
        doJogo: [j.status ? `HTTP ${j.status}` : "", j.motivo ? `“${j.motivo}”` : ""]
          .filter(Boolean)
          .join(" · ") || undefined,
      });
    } catch {
      setErro({ recado: "Não consegui falar com o servidor." });
    } finally {
      setOcupado(false);
    }
  }

  // O favorito chega aqui com o token no hash. Lê, limpa a barra na hora e envia.
  useEffect(() => {
    const bruto = decodeURIComponent(window.location.hash.slice(1));
    if (!bruto) return;
    history.replaceState(null, "", window.location.pathname);
    void conectar(bruto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto mt-6 flex w-full max-w-2xl flex-col gap-4">
      {/* Quantas cabem, antes do formulário. Descobrir o teto só depois de colar
          o token é descobrir tarde demais. */}
      {jaLigadas != null ? (
        <p className="pix text-[11px] text-text-mute">
          {reconectando
            ? "reconectando uma conta que já é sua"
            : semTeto
              ? `${jaLigadas} ${jaLigadas === 1 ? "conta ligada" : "contas ligadas"} · sem teto`
              : `${jaLigadas} de ${limite} contas`}
        </p>
      ) : null}

      {cheio ? (
        <Note tone="warn">
          Você chegou no teto de contas do seu plano. Desligue uma na lista abaixo para abrir
          espaço.
        </Note>
      ) : null}

      <HowTo
        tint={COR}
        resumo="Como o PIWdex entra na sua conta do jogo sem pedir a sua senha."
        passos={[
          {
            titulo: "Arraste o favorito",
            texto: "Uma vez só. Ele fica na barra do navegador e serve pra sempre.",
          },
          {
            titulo: "Abra o jogo e entre nele",
            texto: "Precisa estar logado: o que o favorito copia é a credencial que o jogo já te deu.",
          },
          {
            titulo: "Clique no favorito, dentro da aba do jogo",
            texto: "Ele abre esta página já com o token e conecta sozinho.",
          },
        ]}
        bomSaber={[
          "A sua senha do jogo nunca passa por aqui — o jogo exige captcha no login, então nem daria.",
          "O token vence sozinho. Quando isso acontecer, a tela pede pra repetir o passo 3.",
          "Conectar derruba a aba do jogo: o jogo aceita uma sessão por conta, e o robô passa a ser ela.",
        ]}
      />

      <Panel className="p-5">
        <h1 className="pix text-[17px]" style={{ color: COR }}>
          Conectar a conta do jogo
        </h1>

        {status === "active" && nomeJogador ? (
          <Note tone="ok" className="mt-3">
            Conectado como {nomeJogador}. Reconectar troca a conta vinculada.
          </Note>
        ) : null}
        {status === "expired" ? (
          <Note tone="warn" className="mt-3">
            O vínculo venceu. Repita o passo do favorito — o resto volta ao que era.
          </Note>
        ) : null}
        {status === "blocked" ? (
          <Note tone="danger" className="mt-3">
            O jogo recusou esta conta{motivoBloqueio ? `: “${motivoBloqueio}”` : "."} Reconectar não
            desfaz isso.
          </Note>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Favorito />
          <span className="text-[12px] text-text-mute">arraste para a barra de favoritos</span>
        </div>

        <div className="mt-6 border-t border-line pt-4">
          <p className="pix text-[11px] text-text-mute">Ou cole na mão</p>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            spellCheck={false}
            rows={4}
            placeholder='{"accessToken":"…","refreshToken":"…"}'
            className="mt-2 w-full resize-y border border-line bg-bg-soft px-3 py-2 font-mono text-[12px]
                       text-text outline-none placeholder:text-text-mute/60 focus:border-line-strong"
          />
          <div className="mt-3 flex items-center gap-3">
            <Button
              variant="primary"
              disabled={ocupado || !texto.trim()}
              onClick={() => void conectar(texto)}
            >
              {ocupado ? "conectando…" : "conectar"}
            </Button>
            {pronto ? <span className="text-[13px] text-ok">pronto, indo pro painel…</span> : null}
          </div>
        </div>

        <div aria-live="polite">
          {erro ? (
            <Note tone="danger" className="mt-4">
              {erro.recado}
              {erro.doJogo ? <span className="mt-1 block not-italic opacity-80">{erro.doJogo}</span> : null}
            </Note>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
