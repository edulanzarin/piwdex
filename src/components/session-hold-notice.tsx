"use client";

// Aviso FIXADO: enquanto o robo esta ligado, ELE segura a sessao de jogo (o jogo so
// permite 1 conexao por conta). Se o usuario entrar no jogo pelo navegador sem saber, o
// robo reconecta e o chuta de volta — parece bug. O aviso deixa claro: pra jogar no
// navegador, desligue o robo primeiro. Aparece sempre que o robo esta ligado/segurando.

import { useVipLive } from "./vip-live";
import { useT } from "./locale-provider";
import { Signal } from "./icons";

export function SessionHoldNotice() {
  const t = useT();
  const { hunt } = useVipLive();
  const holding = !!hunt && (hunt.desiredOn || hunt.holdOpen);
  if (!holding) return null;

  return (
    <div
      className="flex items-center gap-2.5 rounded-md border border-[color:var(--yellow)]/50 bg-[rgba(240,200,60,0.08)] px-3 py-2 text-[0.68rem] leading-relaxed text-yellow"
      role="status"
    >
      <Signal size={13} className="shrink-0" />
      <span>{t("vip.hold.notice")}</span>
    </div>
  );
}
