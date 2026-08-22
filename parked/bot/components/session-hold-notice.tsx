"use client";

// Aviso FIXADO: enquanto o robo esta ligado, ELE segura a sessao de jogo (o jogo so
// permite 1 conexao por conta). Se o usuario entrar no jogo pelo navegador sem saber, o
// robo reconecta e o chuta de volta — parece bug. O aviso deixa claro: pra jogar no
// navegador, desligue o robo primeiro.
// O bloco e um SLOT permanente: sempre renderizado com as mesmas dimensoes e apenas
// `invisible` quando o robo esta desligado — ligar/desligar nao empurra a tela.

import { useVipLive } from "./vip-live";
import { useT } from "./locale-provider";
import { Signal } from "./icons";

export function SessionHoldNotice() {
  const t = useT();
  const { hunt } = useVipLive();
  const holding = !!hunt && (hunt.desiredOn || hunt.holdOpen);

  return (
    // vidro tingido de amarelo (glass + a cor por cima) no lugar do rgba chapado que
    // estava inventado aqui: mesmo material do card/modal, so que na cor do aviso
    <div
      className={`glass flex min-h-[2.75rem] items-center gap-2.5 rounded-md border border-[color:var(--yellow)]/50 px-3 py-2 text-base leading-relaxed text-yellow ${holding ? "" : "invisible"}`}
      style={{ background: "color-mix(in srgb, var(--yellow) 12%, var(--surface))" }}
      role="status"
      aria-hidden={!holding}
    >
      <Signal size={16} className="shrink-0" />
      <span>{t("vip.hold.notice")}</span>
    </div>
  );
}
