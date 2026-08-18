"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminUser } from "@/lib/admin-data";
import { Coin, Diamond, Star, Trainer } from "@/components/icons";

const GAME_URL = "https://poke.idleworld.online";

// Comando pronto pra colar no console da aba do jogo: injeta o token na sessao e vai pro /play.
// O navegador PROIBE um dominio escrever no storage de outro, entao o admin abre a aba do jogo
// e cola isto (ou usa o bookmarklet, que roda no dominio do jogo). Ver game-auth.ts.
function loginSnippet(imp: NonNullable<AdminUser["impersonate"]>): string {
  const tokenJson = JSON.stringify({ accessToken: imp.accessToken, refreshToken: imp.refreshToken });
  return `sessionStorage.setItem('pokeweb:tokens', ${JSON.stringify(tokenJson)}); location.href='/play'`;
}

const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR"));
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

// Bookmarklet arrastavel: o React sanitiza href="javascript:", entao setamos o atributo por
// ref depois de montar. Arrasta pra barra de favoritos e, na aba do jogo, clica -> loga.
function BookmarkletLink({ snippet, label }: { snippet: string; label: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.setAttribute("href", `javascript:(function(){${snippet}})();`);
  }, [snippet]);
  return (
    <a
      ref={ref}
      href="#"
      draggable
      onClick={(e) => e.preventDefault()}
      title="Arraste pra barra de favoritos; na aba do jogo, clique pra entrar"
      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 pixel text-xs text-text-dim hover:border-[color:var(--border-strong)] hover:text-cyan cursor-grab"
    >
      ↗ {label}
    </a>
  );
}

export function AdminDashboard({ users }: { users: AdminUser[] }) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  async function copyLogin(u: AdminUser) {
    if (!u.impersonate) return;
    try {
      await navigator.clipboard.writeText(loginSnippet(u.impersonate));
      window.open(GAME_URL, "_blank", "noopener");
      setToast(`Login de ${u.playerName ?? u.email} copiado — na aba do jogo: F12 → Console → Ctrl+V → Enter`);
    } catch {
      setToast("Não consegui copiar (permissão de clipboard). Use o bookmarklet ao lado.");
    }
  }

  const totals = {
    total: users.length,
    vip: users.filter((u) => u.vip).length,
    linked: users.filter((u) => u.linkStatus === "active").length,
    diamonds: users.reduce((s, u) => s + (u.diamonds ?? 0), 0),
    gold: users.reduce((s, u) => s + (u.gold ?? 0), 0),
  };

  return (
    <div className="flex flex-col gap-4">
      {/* resumo */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Usuários" value={fmt(totals.total)} />
        <Stat label="VIPs" value={fmt(totals.vip)} icon={<Star size={12} />} />
        <Stat label="Conta ligada" value={fmt(totals.linked)} icon={<Trainer size={12} />} />
        <Stat label="Dólares (soma)" value={fmt(totals.gold)} icon={<Coin size={12} />} />
        <Stat label="Diamantes (soma)" value={fmt(totals.diamonds)} icon={<Diamond size={12} />} />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-text-dim">Moedas puxadas ao vivo do jogo (REST, sem roubar a sessão).</span>
        <button
          type="button"
          onClick={() => { setBusy(true); router.refresh(); setTimeout(() => setBusy(false), 1200); }}
          className="rounded border border-border px-2.5 py-1 pixel text-xs text-text-dim hover:text-cyan"
        >
          {busy ? "atualizando…" : "atualizar"}
        </button>
      </div>

      {/* tabela */}
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full min-w-[52rem] border-collapse text-left text-base">
          <thead>
            <tr className="border-b border-border bg-surface-2 pixel text-xs uppercase tracking-wide text-text-dim">
              <Th>Usuário</Th>
              <Th>VIP</Th>
              <Th>Conta do jogo</Th>
              <Th className="text-right">Nível</Th>
              <Th className="text-right">Dólares</Th>
              <Th className="text-right">Diamantes</Th>
              <Th className="text-right">Capturas</Th>
              <Th>Criado</Th>
              <Th>Entrar como</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/40">
                <Td>
                  <div className="flex flex-col">
                    <span className="text-text">{u.nome ?? "—"}</span>
                    <span className="text-sm text-text-dim">{u.email}</span>
                  </div>
                </Td>
                <Td>
                  {u.vip ? (
                    <span className="chip" style={{ background: "var(--yellow)", color: "#3a2c00" }}>VIP</span>
                  ) : (
                    <span className="text-text-dim">—</span>
                  )}
                  {u.vip && u.vipAte && (
                    <div className="mt-0.5 text-xs text-text-dim">até {fmtDate(u.vipAte)}</div>
                  )}
                </Td>
                <Td>
                  {u.linked ? (
                    <div className="flex flex-col">
                      <span className="text-text">{u.playerName ?? "conectada"}</span>
                      <span className={`text-xs ${u.linkStatus === "active" ? "text-[color:var(--green,#35e08e)]" : "text-[color:#ff5555]"}`}>
                        {u.linkStatus === "active" ? "ativa" : "expirada"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-text-dim">não ligada</span>
                  )}
                </Td>
                <Td className="text-right tabular-nums">{fmt(u.level)}</Td>
                <Td className="text-right tabular-nums text-yellow">{fmt(u.gold)}</Td>
                <Td className="text-right tabular-nums text-cyan">{fmt(u.diamonds)}</Td>
                <Td className="text-right tabular-nums">{fmt(u.catches)}</Td>
                <Td className="whitespace-nowrap text-text-dim">{fmtDate(u.criadoEm)}</Td>
                <Td>
                  {u.impersonate ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => copyLogin(u)}
                        className="rounded border border-[color:var(--border-strong)] bg-surface-2 px-2 py-1 pixel text-xs text-cyan hover:bg-cyan/10"
                      >
                        Copiar login
                      </button>
                      <BookmarkletLink snippet={loginSnippet(u.impersonate)} label="arraste" />
                    </div>
                  ) : (
                    <span className="text-sm text-text-dim">sem token</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <p className="py-6 text-center text-sm text-text-dim">Nenhum usuário cadastrado ainda.</p>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface-solid)] px-4 py-2.5 text-center text-base text-text shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-surface-2 px-3 py-2">
      <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-text-dim">{icon}{label}</div>
      <div className="pixel text-lg text-text">{value}</div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-normal ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}
