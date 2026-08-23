"use client";

import { useState } from "react";
import { Button, Note, Panel } from "@/components/ui";

/**
 * A assinatura.
 *
 * Duas coisas que a tela precisa acertar e que sao faceis de errar:
 *
 * 1. **Pagamento por PIX nao e instantaneo do ponto de vista daqui.** Entre o
 *    "paguei" e o webhook do Mercado Pago existe uma janela, e uma tela que
 *    afirma "ativo" cedo demais e uma tela que mente. Por isso a volta do
 *    checkout diz "conferindo", e nao "pronto".
 * 2. **Nao e recorrencia.** E avulso: cada pagamento soma 30 dias. Dizer
 *    "assinatura" e deixar a pessoa achar que renova sozinha seria cobrar
 *    confianca que o arranjo nao tem.
 */

const COR = "var(--color-t-robo)";

const VOLTA: Record<string, { tom: "ok" | "warn" | "danger"; texto: string }> = {
  aprovado: { tom: "ok", texto: "Pagamento aprovado. A liberação chega em instantes — atualize a página se demorar." },
  pendente: { tom: "warn", texto: "O pagamento ficou pendente. Assim que o PIX cair, o acesso abre sozinho." },
  falhou: { tom: "danger", texto: "O pagamento não foi concluído. Nada foi cobrado." },
};

export function AssinaturaTool({
  ativa,
  ate,
  preco,
  ligado,
}: {
  ativa: boolean;
  ate: string | null;
  preco: number;
  ligado: boolean;
  estado?: string;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const volta = typeof window !== "undefined"
    ? VOLTA[new URLSearchParams(window.location.search).get("estado") ?? ""]
    : undefined;

  async function pagar() {
    setOcupado(true);
    setErro(null);
    try {
      const res = await fetch("/api/robo/checkout", { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { url?: string; erro?: string };
      if (res.ok && j.url) {
        window.location.href = j.url;
        return;
      }
      setErro(
        j.erro === "pagamento_desligado"
          ? "O pagamento está fora do ar no momento."
          : "Não consegui abrir o checkout. Tente de novo.",
      );
    } catch {
      setErro("Não consegui falar com o servidor.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Panel className="mx-auto mt-8 w-full max-w-lg p-6">
      <h1 className="pix text-[17px]" style={{ color: COR }}>
        Assinatura
      </h1>

      {volta ? (
        <Note tone={volta.tom} className="mt-3">
          {volta.texto}
        </Note>
      ) : null}

      {ativa ? (
        <Note tone="ok" className="mt-3">
          Ativa{ate ? ` até ${new Date(ate).toLocaleDateString("pt-BR")}` : ""}. Pagar de novo soma 30
          dias ao que falta.
        </Note>
      ) : (
        <p className="mt-3 text-[14px] leading-relaxed text-text-dim">
          O robô joga por você: segura a caçada, acompanha o analyzer ao vivo, captura o que cai e
          levanta o time quando ele desmaia.
        </p>
      )}

      <div className="mt-5 flex items-baseline gap-2">
        <span className="pix text-[28px] text-text">
          R$ {preco.toFixed(2).replace(".", ",")}
        </span>
        <span className="text-[13px] text-text-mute">por 30 dias</span>
      </div>

      <p className="mt-1 text-[12px] text-text-mute">
        Avulso, por PIX. Não renova sozinho e não guarda cartão.
      </p>

      <div className="mt-5">
        <Button variant="primary" size="lg" disabled={ocupado || !ligado} onClick={() => void pagar()}>
          {ocupado ? "abrindo…" : ativa ? "somar 30 dias" : "assinar"}
        </Button>
      </div>

      <div aria-live="polite">
        {!ligado ? (
          <Note tone="warn" className="mt-4">
            O pagamento está desligado neste ambiente.
          </Note>
        ) : null}
        {erro ? (
          <Note tone="danger" className="mt-4">
            {erro}
          </Note>
        ) : null}
      </div>
    </Panel>
  );
}
