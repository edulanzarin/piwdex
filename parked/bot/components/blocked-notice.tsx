"use client";

// Aviso de CONTA RECUSADA pelo jogo. Estado terminal: o robo parou e nao vai tentar de
// novo — insistir contra uma recusa nao muda o resultado, so gasta tentativa.
//
// Este aviso existe porque o silencio era pior que a recusa: o robo tentava reconectar
// pra sempre e o usuario via "nao conectou", ficava reconectando na mao e nunca
// descobria o motivo. Aqui o motivo aparece com a FRASE DO JOGO, nao um texto nosso —
// se a conta foi banida, quem tem que explicar a regra e quem aplicou.
//
// Ao contrario do SessionHoldNotice, este NAO e um slot permanente: ele so existe quando
// ha o que dizer, e quando existe precisa ocupar espaco e interromper a leitura.

import { useVipLive } from "./vip-live";
import { useT } from "./locale-provider";
import { Signal } from "./icons";

export function BlockedNotice() {
  const t = useT();
  const { hunt } = useVipLive();
  if (hunt?.status !== "blocked") return null;

  return (
    <div
      className="glass flex flex-col gap-2 rounded-md border border-[color:var(--red)]/60 px-4 py-3 text-base leading-relaxed text-red"
      style={{ background: "color-mix(in srgb, var(--red) 12%, var(--surface))" }}
      role="alert"
    >
      <span className="flex items-center gap-2.5 font-bold">
        <Signal size={16} className="shrink-0" />
        {t("vip.blocked.title")}
      </span>
      {/* a frase do jogo, crua: e a evidencia do que aconteceu */}
      {hunt.blockedReason && (
        <span className="rounded border border-[color:var(--red)]/40 bg-[color:var(--bg)]/40 px-3 py-2 text-sm text-text [overflow-wrap:anywhere]">
          {hunt.blockedReason}
        </span>
      )}
      <span className="text-sm text-text-dim">{t("vip.blocked.body")}</span>
    </div>
  );
}
