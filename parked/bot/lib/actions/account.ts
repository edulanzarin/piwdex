"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getUserById, updateUserName, updateUserPassword } from "@/lib/users";

// Ajustes da CONTA do piwdex (login por email/senha) — separado da area VIP (que e a
// conta do JOGO). Duas acoes: trocar o nome de exibicao e trocar a senha. Ambas exigem
// sessao valida; a troca de senha confere a senha atual antes.

export interface ActionResult {
  ok: boolean;
  error?: string;
  msg?: string;
}

const NAME_MAX = 40;

export async function updateName(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false, error: "not_logged" };
  const nome = String(formData.get("nome") ?? "").trim().slice(0, NAME_MAX);
  await updateUserName(s.user.id, nome || null);
  revalidatePath("/conta");
  return { ok: true, msg: "name_saved" };
}

export async function changePassword(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false, error: "not_logged" };

  const atual = String(formData.get("atual") ?? "");
  const nova = String(formData.get("nova") ?? "");
  const confirma = String(formData.get("confirma") ?? "");

  if (nova.length < 6) return { ok: false, error: "short" };
  if (nova !== confirma) return { ok: false, error: "mismatch" };

  const u = await getUserById(s.user.id);
  if (!u?.senha_hash) return { ok: false, error: "not_logged" };
  const ok = await bcrypt.compare(atual, u.senha_hash);
  if (!ok) return { ok: false, error: "wrong_current" };

  await updateUserPassword(s.user.id, await bcrypt.hash(nova, 10));
  return { ok: true, msg: "pass_saved" };
}
