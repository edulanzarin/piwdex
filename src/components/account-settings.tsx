"use client";

// Ajustes da conta do piwdex: nome de exibicao e senha. Dois forms via server actions
// (updateName / changePassword) com useActionState. A conta do JOGO fica na area VIP.

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { updateName, changePassword, type ActionResult } from "@/lib/actions/account";
import { useT } from "./locale-provider";
import { Star, ChevronRight, Check } from "./icons";

function SubmitBtn({ label, loading }: { label: string; loading: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-cyan self-start disabled:opacity-50">
      {pending ? `${loading}...` : label}
    </button>
  );
}

// linha de sucesso inline (verde, com check) — o /conta vive fora do ToastProvider
function Ok({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-[0.92rem] font-semibold text-green">
      <Check size={11} /> {children}
    </p>
  );
}

export function AccountSettings({ email, nome, vip }: { email: string; nome: string | null; vip: boolean }) {
  const t = useT();
  const [nameState, nameAction] = useActionState<ActionResult | undefined, FormData>(updateName, undefined);
  const [passState, passAction] = useActionState<ActionResult | undefined, FormData>(changePassword, undefined);

  const errText = (r?: ActionResult) => (r && !r.ok && r.error ? t(`conta.err.${r.error}`) : null);

  return (
    <div className="flex flex-col gap-4">
      {/* email (so leitura) + status VIP */}
      <div className="card flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="field-label">{t("conta.f.email")}</div>
            <div className="mt-1 truncate text-sm text-text">{email}</div>
          </div>
          {vip ? (
            <span className="chip shrink-0" style={{ background: "var(--yellow)", color: "#3a2c00" }}>VIP</span>
          ) : (
            <Link href="/vip" className="btn btn-yellow shrink-0" style={{ "--accent": "var(--yellow)" } as React.CSSProperties}>
              <Star size={10} /> {t("vipcta.btn")}
            </Link>
          )}
        </div>
      </div>

      {/* nome de exibicao */}
      <form action={nameAction} className="card flex flex-col gap-3 p-5">
        <div className="section-title text-cyan">{t("conta.sec.name")}</div>
        <label className="flex flex-col gap-1">
          <span className="field-label">{t("conta.f.name")}</span>
          <input name="nome" type="text" defaultValue={nome ?? ""} maxLength={40} autoComplete="name" className="input" placeholder={t("conta.f.namePh")} />
        </label>
        {errText(nameState) && <p className="text-[0.92rem] font-semibold text-red">{errText(nameState)}</p>}
        {nameState?.ok && <Ok>{t("conta.name.saved")}</Ok>}
        <SubmitBtn label={t("conta.name.btn")} loading={t("conta.saving")} />
      </form>

      {/* senha */}
      <form action={passAction} className="card flex flex-col gap-3 p-5">
        <div className="section-title text-cyan">{t("conta.sec.pass")}</div>
        <label className="flex flex-col gap-1">
          <span className="field-label">{t("conta.f.current")}</span>
          <input name="atual" type="password" required autoComplete="current-password" className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="field-label">{t("conta.f.new")}</span>
          <input name="nova" type="password" required minLength={6} autoComplete="new-password" className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="field-label">{t("conta.f.confirm")}</span>
          <input name="confirma" type="password" required minLength={6} autoComplete="new-password" className="input" />
        </label>
        {errText(passState) && <p className="text-[0.92rem] font-semibold text-red">{errText(passState)}</p>}
        {passState?.ok && <Ok>{t("conta.pass.saved")}</Ok>}
        <SubmitBtn label={t("conta.pass.btn")} loading={t("conta.saving")} />
      </form>

      {/* atalho pra area VIP (conta do jogo, robo etc) */}
      <Link href="/vip" className="text-center text-[0.92rem] text-text-dim hover:text-cyan">
        {t("conta.toVip")} <ChevronRight size={9} className="inline" />
      </Link>
    </div>
  );
}
