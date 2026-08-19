"use client";

// Chamariz pra quem NAO e VIP: UM card no fim da pagina (ultimo bloco, no fluxo normal —
// so aparece quando voce rola ate la embaixo, sem nada fixo tapando a tela). Dois caminhos:
//   - ADQUIRIR O BOT -> /vip.
//   - APOIAR COM O CODIGO -> quem nao vai assinar ainda ajuda usando o codigo do Eduardo
//     ao comprar diamante no jogo (nao custa nada a mais pro jogador).
// O argumento NAO e "caca sozinho": o jogo ja e idle. O argumento e VELOCIDADE.
// Some na propria area VIP e nas telas de login/conexao, e pra quem ja e VIP.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./locale-provider";
import { Star, ChevronRight } from "./icons";
import { SUPPORT_CODE, SUPPORT_URL } from "@/lib/support";

const HIDDEN = ["/vip", "/entrar", "/criar-conta", "/conectar"];

export function VipCta({ vip }: { vip: boolean }) {
  const t = useT();
  const pathname = usePathname();

  if (vip) return null;
  if (HIDDEN.some((h) => pathname === h || pathname.startsWith(`${h}/`))) return null;

  return (
    <div className="container-page pb-10 pt-4">
      {/* o card continua sendo VIDRO: o amarelo entra misturado na propria superficie do
          token (o rgba chapado de antes matava a translucidez do material) */}
      <div
        className="card flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
        style={{
          borderColor: "color-mix(in srgb, var(--yellow) 45%, transparent)",
          background: "color-mix(in srgb, var(--yellow) 7%, var(--surface))",
        }}
      >
        <div className="min-w-0">
          {/* titulo longo quebra em duas linhas no celular: a estrela nao pode encolher junto */}
          <div className="section-title flex items-center gap-2 text-yellow">
            <span className="shrink-0"><Star size={18} /></span> {t("vipcta.title")}
          </div>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-dim">{t("vipcta.desc")}</p>
        </div>
        {/* degrau mobile: botoes empilhados em largura cheia (alvo de toque folgado),
            lado a lado so a partir do sm — sem flex-wrap mudando a altura */}
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost w-full sm:w-auto"
            title={t("vipcta.playHint")}
          >
            {t("vipcta.play")} <span className="pixel tracking-widest">{SUPPORT_CODE}</span>
          </a>
          <Link href="/vip" className="btn btn-yellow w-full sm:w-auto">
            {t("vipcta.btn")} <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
