"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/lib/auth";
import { createUserWithPassword, findUserByEmail } from "@/lib/users";

export interface AuthResult {
  ok: false;
  error: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Login por email/senha. Em sucesso, o signIn redireciona (throw) e nada retorna.
export async function authenticate(
  _prev: AuthResult | undefined,
  formData: FormData,
): Promise<AuthResult | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      senha: formData.get("senha"),
      redirectTo: "/conta",
    });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: "E-mail ou senha invalidos." };
    throw error; // deixa o redirect do Next passar
  }
}

// Cadastro por email/senha: valida, cria o usuario e ja loga.
export async function register(
  _prev: AuthResult | undefined,
  formData: FormData,
): Promise<AuthResult | undefined> {
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  if (!EMAIL_RE.test(email)) return { ok: false, error: "E-mail invalido." };
  if (senha.length < 6) return { ok: false, error: "A senha precisa de ao menos 6 caracteres." };

  const existing = await findUserByEmail(email);
  if (existing) return { ok: false, error: "Ja existe uma conta com esse e-mail." };

  const senhaHash = await bcrypt.hash(senha, 10);
  await createUserWithPassword({ email, nome: nome || null, senhaHash });

  try {
    await signIn("credentials", { email, senha, redirectTo: "/conta" });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: "Conta criada, mas o login falhou. Tente entrar." };
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
