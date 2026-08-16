"use client";

// Sino de alertas no topo (VIP). Puxa o contador de nao-lidos a cada 60s (e quando a
// aba volta ao foco), leva pra /vip#alertas. So aparece pra VIP — a rota de contagem e
// VIP-gated de qualquer jeito.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "./icons";
import { useT } from "./locale-provider";

export function NavBell() {
  const t = useT();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/vip/alerts?count=1", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { unread?: number } | null) => {
          if (alive && j) setUnread(j.unread ?? 0);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <Link
      href="/vip#alertas"
      title={t("vip.tab.alertas")}
      aria-label={t("vip.tab.alertas")}
      className="relative flex h-10 w-10 items-center justify-center rounded text-text-dim transition hover:bg-surface-2 hover:text-yellow"
    >
      <Bell size={20} />
      {unread > 0 && (
        <span className="absolute right-0.5 top-0.5 flex min-w-[15px] items-center justify-center rounded-full bg-cyan px-1 text-[0.5rem] font-bold leading-none text-[#06131a]">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
