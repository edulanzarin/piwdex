"use client";

// Chamariz pra quem NAO e VIP: UM card no fim da pagina (ultimo bloco, no fluxo normal —
// so aparece quando voce rola ate la embaixo, sem nada fixo tapando a tela). Dois caminhos:
//   - ASSINAR VIP -> /vip (libera o robo).
//   - JOGAR COM MEU LINK -> abre o jogo pela indicacao do Eduardo (quem entra por ali
//     fortalece a conta que move o piwdex). Link de indicacao publico, confirmado por ele.
// Some na propria area VIP e nas telas de login/conexao, e pra quem ja e VIP.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./locale-provider";
import { Star, ChevronRight } from "./icons";

const HIDDEN = ["/vip", "/entrar", "/criar-conta", "/conectar"];
// Link de indicacao do Poke Idle World (codigo do Eduardo). Trocar aqui se o codigo mudar.
const REF_URL = "https://poke.idleworld.online/?ref=DQVF6Q2";

export function VipCta({ vip }: { vip: boolean }) {
  const t = useT();
  const pathname = usePathname();

  if (vip) return null;
  if (HIDDEN.some((h) => pathname === h || pathname.startsWith(`${h}/`))) return null;

  return (
    <div className="container-page pb-10 pt-4">
      <div
        className="card flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "color-mix(in srgb, var(--yellow) 45%, transparent)", background: "rgba(240,200,60,0.05)" }}
      >
        <div className="min-w-0">
          <div className="section-title flex items-center gap-2 text-yellow">
            <Star size={13} /> {t("vipcta.title")}
          </div>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-dim">{t("vipcta.desc")}</p>
        </div>
        {/* degrau mobile: botoes empilhados em largura cheia (alvo de toque folgado),
            lado a lado so a partir do sm — sem flex-wrap mudando a altura */}
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <a
            href={REF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost w-full sm:w-auto"
            title={t("vipcta.playHint")}
          >
            {t("vipcta.play")} <ChevronRight size={10} />
          </a>
          <Link href="/vip" className="btn btn-yellow w-full sm:w-auto">
            {t("vipcta.btn")} <ChevronRight size={10} />
          </Link>
        </div>
      </div>
    </div>
  );
}
