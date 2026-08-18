"use client";

// Alvo do bookmarklet: o favorito lido na aba do jogo abre esta pagina com o token no
// HASH da URL (`/conectar#<json>`). O hash NAO vai pro servidor; lemos no cliente, limpamos
// da barra na hora e mandamos pro /api/connect (mesma origem, sem CORS). Depois vai pra /conta.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/locale-provider";
import { Pokeball } from "@/components/pokeball";

export default function ConectarPage() {
  const t = useT();
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [err, setErr] = useState("");

  useEffect(() => {
    const raw = decodeURIComponent(window.location.hash.slice(1));
    history.replaceState(null, "", window.location.pathname); // tira o token da barra na hora
    if (!raw) {
      setStatus("error");
      setErr(t("connect.noToken"));
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw }),
        });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (res.ok && j.ok) {
          setStatus("ok");
          setTimeout(() => router.replace("/vip#conta"), 700);
        } else {
          setStatus("error");
          setErr(t(`account.err.${j.error ?? "unauthorized"}`));
        }
      } catch {
        setStatus("error");
        setErr(t("account.err.unreachable"));
      }
    })();
  }, [router, t]);

  // Card de dimensao FIXA: os 3 estados (conectando / ok / erro) trocam DENTRO do mesmo
  // espaco (w-full max-w-md + min-h) — mudar de estado nao muda a altura nem a largura.
  return (
    <div className="container-page flex min-h-[60vh] items-center justify-center py-16">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="flex min-h-[13rem] flex-col items-center justify-center gap-3">
          {status === "working" && (
            <>
              <Pokeball size={64} className="wiggle" />
              <div className="pixel text-base text-text-dim">{t("connect.working")}</div>
            </>
          )}
          {status === "ok" && (
            <>
              <Pokeball size={64} />
              <div className="pixel text-lg text-green">{t("connect.ok")}</div>
              <p className="text-sm text-text-dim">{t("connect.redirect")}</p>
            </>
          )}
          {status === "error" && (
            <>
              <div className="pixel text-lg text-red">{t("connect.failed")}</div>
              <p className="text-sm text-text-dim">{err}</p>
              <a href="/vip#conta" className="btn btn-cyan mt-2">{t("connect.back")}</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
