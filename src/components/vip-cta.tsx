"use client";

// Chamariz de VIP no rodape das paginas publicas: aparece pra quem NAO e VIP (deslogado
// ou logado sem assinatura), convidando a liberar o robo/mercado. Some na propria area VIP
// e nas telas de login/conexao (ali ja e o fluxo). Path pelo cliente (usePathname).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./locale-provider";
import { Star } from "./icons";

const HIDDEN = ["/vip", "/entrar", "/criar-conta", "/conectar"];

export function VipCta({ vip }: { vip: boolean }) {
  const t = useT();
  const pathname = usePathname();
  if (vip) return null;
  if (HIDDEN.some((h) => pathname === h || pathname.startsWith(`${h}/`))) return null;

  return (
    <div className="container-page pb-8">
      <div
        className="card flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "color-mix(in srgb, var(--yellow) 45%, transparent)", background: "rgba(240,200,60,0.05)" }}
      >
        <div className="min-w-0">
          <div className="pixel flex items-center gap-2 text-[0.72rem] text-yellow">
            <Star size={13} /> {t("vipcta.title")}
          </div>
          <p className="mt-2 max-w-2xl text-[0.72rem] leading-relaxed text-text-dim">{t("vipcta.desc")}</p>
        </div>
        <Link href="/vip" className="btn shrink-0" style={{ background: "var(--yellow)", color: "#3a2c00" }}>
          {t("vipcta.btn")} ›
        </Link>
      </div>
    </div>
  );
}
