"use client";

// Formulario unico de login/cadastro. Usa server actions (authenticate/register)
// via useActionState. So email/senha (sem OAuth).

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { authenticate, register, type AuthResult } from "@/lib/actions/auth";
import { useT } from "./locale-provider";

function SubmitBtn({ label, loading }: { label: string; loading: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-cyan w-full disabled:opacity-50">
      {pending ? `${loading}...` : label}
    </button>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const t = useT();
  const action = mode === "login" ? authenticate : register;
  const [state, formAction] = useActionState<AuthResult | undefined, FormData>(action, undefined);

  return (
    <div className="card flex flex-col gap-4 p-6">
      <form action={formAction} className="flex flex-col gap-3">
        {mode === "register" && (
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("auth.f.name")}</span>
            <input name="nome" type="text" autoComplete="name" className="input" />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="field-label">{t("auth.f.email")}</span>
          <input name="email" type="email" required autoComplete="email" className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="field-label">{t("auth.f.senha")}</span>
          <input
            name="senha"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="input"
          />
        </label>

        {/* slot RESERVADO da linha de erro: existe sempre com min-h — a mensagem
            aparecer/sumir nao empurra o formulario */}
        <p className="min-h-5 text-sm text-red">{state?.error ?? ""}</p>

        <div className="mt-1">
          {mode === "login" ? (
            <SubmitBtn label={t("auth.login.btn")} loading={t("auth.login.loading")} />
          ) : (
            <SubmitBtn label={t("auth.register.btn")} loading={t("auth.register.loading")} />
          )}
        </div>
      </form>

      <p className="text-center text-base text-text-dim">
        {mode === "login" ? (
          <>
            {t("auth.toRegister")}{" "}
            <Link href="/criar-conta" className="text-cyan hover:underline">{t("auth.toRegisterLink")}</Link>
          </>
        ) : (
          <>
            {t("auth.toLogin")}{" "}
            <Link href="/entrar" className="text-cyan hover:underline">{t("auth.toLoginLink")}</Link>
          </>
        )}
      </p>
    </div>
  );
}
