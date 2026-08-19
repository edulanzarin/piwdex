"use client";

// Balao FIXO no canto direito: "me apoie com meu codigo".
// Regra do Eduardo: aparece ABERTO em TODA pagina, pra VIP e pra nao-VIP, e volta a
// aparecer mesmo depois de fechado — por isso NAO ha persistencia nenhuma (nem
// localStorage nem cookie). Fechar vale so pra tela atual; trocar de rota reabre.
// Dois niveis de saida pra nao ser agressivo dentro da mesma tela:
//   - X do cartao -> recolhe pra pilula (continua a um clique de reabrir);
//   - X da pilula -> some ate a proxima navegacao.
// Fica fora das telas de login/conexao, onde taparia campo de formulario no celular.
// No celular encosta nas bordas de baixo e respeita a largura da tela: nunca empurra
// nem tapa o conteudo na horizontal.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "./locale-provider";
import { Heart, Close, Check, ChevronRight } from "./icons";
import { SUPPORT_CODE, SUPPORT_URL } from "@/lib/support";

const HIDDEN = ["/entrar", "/criar-conta", "/conectar"];
type State = "open" | "collapsed" | "hidden";

export function SupportBadge() {
  const t = useT();
  const pathname = usePathname();
  const [state, setState] = useState<State>("open");
  const [copied, setCopied] = useState(false);

  // toda troca de pagina reabre o balao (pedido do Eduardo: sempre visivel de cara)
  useEffect(() => {
    setState("open");
    setCopied(false);
  }, [pathname]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_CODE);
      setCopied(true);
    } catch {
      /* sem clipboard (http, permissao): o codigo esta na tela pra copiar na mao */
    }
  };

  if (state === "hidden") return null;
  if (HIDDEN.some((h) => pathname === h || pathname.startsWith(`${h}/`))) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-[calc(100vw-2rem)] sm:bottom-6 sm:right-6">
      {state === "open" ? (
        <div
          className="card w-80 max-w-full p-4"
          style={{ borderColor: "color-mix(in srgb, var(--yellow) 45%, transparent)" }}
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 text-yellow"><Heart size={16} /></span>
            <div className="min-w-0 flex-1">
              <div className="pixel text-base text-yellow">{t("support.title")}</div>
              <p className="mt-1 text-sm leading-relaxed text-text-dim">{t("support.desc")}</p>
            </div>
            <button
              type="button"
              onClick={() => setState("collapsed")}
              aria-label={t("support.hide")}
              title={t("support.hide")}
              className="icon-btn h-8 w-8 shrink-0"
            >
              <Close size={16} />
            </button>
          </div>

          {/* o codigo em si: selecionavel, pra dar pra copiar na mao se o clipboard falhar */}
          <div className="well mt-3 flex items-center justify-between gap-2">
            <code className="select-all truncate pixel text-lg tracking-widest text-text">{SUPPORT_CODE}</code>
            <button type="button" onClick={() => void copy()} className="btn btn-ghost btn-sm shrink-0">
              {copied ? <><Check size={14} /> {t("support.copied")}</> : t("support.copy")}
            </button>
          </div>

          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-yellow btn-sm mt-2 w-full"
          >
            {t("support.open")} <ChevronRight size={14} />
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setState("open")}
            className="card flex min-h-10 items-center gap-2 px-3 text-sm text-yellow transition hover:brightness-125"
            style={{ borderColor: "color-mix(in srgb, var(--yellow) 45%, transparent)" }}
          >
            <span className="shrink-0"><Heart size={16} /></span>
            <span className="truncate">{t("support.badge")}</span>
          </button>
          <button
            type="button"
            onClick={() => setState("hidden")}
            aria-label={t("support.close")}
            title={t("support.close")}
            className="icon-btn h-10 w-10 shrink-0"
          >
            <Close size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
