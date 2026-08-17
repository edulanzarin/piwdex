"use client";

// Chamariz pra quem NAO e VIP: UMA barra FLUTUANTE no rodape da viewport (pill com margem,
// borda e sombra — nao encosta nas beiradas), fecha no X e some sozinha ao chegar no fim da
// pagina (pra nao cobrir o ultimo conteudo). Dois caminhos:
//   - ASSINAR VIP -> /vip (libera o robo).
//   - JOGAR COM MEU LINK -> abre o jogo pela indicacao do Eduardo (quem entra por ali
//     fortalece a conta que move o piwdex). Link de indicacao publico, confirmado por ele.
// Some na propria area VIP e nas telas de login/conexao, e pra quem ja e VIP.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "./locale-provider";
import { CloseButton } from "./icon-button";
import { Robot, ChevronRight } from "./icons";

const HIDDEN = ["/vip", "/entrar", "/criar-conta", "/conectar"];
// Link de indicacao do Poke Idle World (codigo do Eduardo). Trocar aqui se o codigo mudar.
const REF_URL = "https://poke.idleworld.online/?ref=DQVF6Q2";

export function VipCta({ vip }: { vip: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const [nearBottom, setNearBottom] = useState(false);

  // some ao chegar no fim: se a pagina ROLA e voce esta nos ultimos ~140px, esconde (nao
  // tapa o rodape/ultimo conteudo). Pagina curta (sem rolagem) mantem a barra visivel.
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight > window.innerHeight + 8;
      const reached = window.scrollY + window.innerHeight >= doc.scrollHeight - 140;
      setNearBottom(scrollable && reached);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  if (vip) return null;
  if (HIDDEN.some((h) => pathname === h || pathname.startsWith(`${h}/`))) return null;
  if (dismissed || nearBottom) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3">
      <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-xl border border-[color:var(--yellow)]/45 bg-[color:var(--surface-solid)]/95 px-4 py-3 shadow-[0_10px_36px_rgba(0,0,0,0.55)] backdrop-blur">
        <span className="hidden shrink-0 text-yellow sm:block"><Robot size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="section-title text-yellow">{t("vipcta.title")}</div>
          <p className="mt-0.5 truncate text-[0.62rem] text-text-dim">{t("vipcta.desc")}</p>
        </div>
        <a
          href={REF_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost hidden shrink-0 sm:inline-flex"
          title={t("vipcta.playHint")}
        >
          {t("vipcta.play")} <ChevronRight size={10} />
        </a>
        <Link href="/vip" className="btn btn-yellow shrink-0">
          {t("vipcta.btn")} <ChevronRight size={10} />
        </Link>
        <CloseButton onClick={() => setDismissed(true)} title={t("robo.hunt.close")} className="shrink-0" />
      </div>
    </div>
  );
}
