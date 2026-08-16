"use client";

// Vender drops (manual) — 1a capacidade de venda do Robo. Mostra a mochila com preco
// NPC, voce marca o que vender e aperta o botao. Vende via POST /api/vip/shop
// (action sell-items). Base pro auto depois. Item RARO vem marcado com aviso e nao
// entra no "marcar comuns". Escreve na conta real.

import { useEffect, useMemo, useState } from "react";
import { LoadingBall } from "./loaders";
import { useT } from "./locale-provider";
import { Coin } from "./icons";

interface Inv { id: number; name: string; icon: string; quantity: number; npcPrice: number; category: string; rare: boolean }
type Load = { s: "loading" } | { s: "error"; code: string } | { s: "ok"; inv: Inv[] };

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function DropSeller() {
  const t = useT();
  const [st, setSt] = useState<Load>({ s: "loading" });
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/vip/shop", { cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as { inventory?: Inv[]; error?: string };
      if (res.ok) setSt({ s: "ok", inv: j.inventory ?? [] });
      else setSt({ s: "error", code: j.error ?? "failed" });
    } catch {
      setSt({ s: "error", code: "failed" });
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const inv = st.s === "ok" ? st.inv : [];
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const markCommon = () => setSel(new Set(inv.filter((i) => !i.rare).map((i) => i.id)));
  const clear = () => setSel(new Set());

  const { count, gold } = useMemo(() => {
    let count = 0, gold = 0;
    for (const i of inv) if (sel.has(i.id)) { count++; gold += i.npcPrice * i.quantity; }
    return { count, gold };
  }, [inv, sel]);

  const sell = async () => {
    const items = inv.filter((i) => sel.has(i.id)).map((i) => ({ itemId: i.id, qty: i.quantity }));
    if (!items.length) return;
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/vip/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sell-items", items }),
      });
      if (res.ok) {
        setFlash(t("robo.sell.sold", { gold: fmt(gold) }));
        setSel(new Set());
        await load();
      } else {
        setFlash(t("robo.sell.failed"));
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="pixel flex items-center gap-2 text-[0.8rem] text-yellow"><Coin size={14} /> {t("robo.sell.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.sell.desc")}</p>
      </div>

      <div className="card p-4">
        {st.s === "loading" ? (
          <LoadingBall label={t("robo.loading")} />
        ) : st.s === "error" ? (
          <p className="text-[0.72rem] text-text-dim">{st.code === "not_connected" ? t("robo.connect") : t("robo.error")}</p>
        ) : inv.length === 0 ? (
          <p className="text-[0.72rem] text-text-dim">{t("robo.sell.empty")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={markCommon} className="btn btn-ghost">{t("robo.sell.markCommon")}</button>
              <button type="button" onClick={clear} className="btn btn-ghost">{t("robo.sell.clear")}</button>
              {flash && <span className="ml-auto text-[0.72rem] font-semibold text-green">{flash}</span>}
            </div>

            <div className="grid max-h-96 gap-1.5 overflow-auto pr-1 sm:grid-cols-2">
              {inv.map((i) => {
                const on = sel.has(i.id);
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => toggle(i.id)}
                    className="flex items-center gap-2.5 rounded border p-2 text-left transition"
                    style={{ borderColor: on ? "var(--cyan)" : "var(--border)", background: on ? "color-mix(in srgb, var(--cyan) 8%, transparent)" : "transparent" }}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[0.6rem] ${on ? "border-cyan bg-cyan text-[#06131a]" : "border-border text-transparent"}`}>✓</span>
                    {i.icon && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.icon} alt="" width={22} height={22} className="[image-rendering:pixelated]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm">{i.name}</span>
                        {i.rare && <span className="rounded px-1 text-[0.5rem] font-bold uppercase text-yellow" style={{ border: "1px solid var(--yellow)" }}>{t("robo.sell.rare")}</span>}
                      </div>
                      <div className="text-[0.6rem] text-text-dim">×{fmt(i.quantity)} · <span className="text-yellow">{fmt(i.npcPrice)}</span> {t("robo.sell.each")}</div>
                    </div>
                    <span className="shrink-0 pixel text-[0.66rem] text-yellow">{fmt(i.npcPrice * i.quantity)}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <span className="text-[0.72rem] text-text-dim">{t("robo.sell.selected", { n: count })}</span>
              <button type="button" onClick={sell} disabled={busy || count === 0} className="btn btn-cyan disabled:opacity-40">
                {busy ? `${t("robo.sell.selling")}...` : `${t("robo.sell.button", { gold: fmt(gold) })} ›`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
