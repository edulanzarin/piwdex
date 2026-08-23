"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { signIn, signOut } from "@/lib/robo/auth";
import { createUserWithPassword, findUserByEmail } from "@/lib/robo/users";
import { consumir } from "@/lib/robo/limite";

/**
 * Entrar e criar conta.
 *
 * Em sucesso o `signIn` REDIRECIONA, e redirecionar no Next e um throw — por
 * isso os dois `catch` reerguem o que nao for `AuthError`. Engolir tudo faria o
 * login "funcionar" sem sair da tela.
 */

export interface ResultadoAuth {
  erro: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DESTINO = "/painel";

/** De onde veio o pedido, pro freio de cadastro. Atras do proxy do Railway o
 *  IP real esta no `x-forwarded-for`; sem ele, todo mundo dividiria uma cota. */
async function origem(): Promise<string> {
  const h = await headers();
  const ff = h.get("x-forwarded-for");
  return (ff?.split(",")[0] ?? h.get("x-real-ip") ?? "desconhecido").trim();
}

export async function entrar(
  _anterior: ResultadoAuth | undefined,
  form: FormData,
): Promise<ResultadoAuth | undefined> {
  try {
    await signIn("credentials", {
      email: form.get("email"),
      senha: form.get("senha"),
      redirectTo: DESTINO,
    });
  } catch (e) {
    // O freio do `authorize` tambem cai aqui: por fora, cota estourada e senha
    // errada sao a mesma resposta, de proposito. Dizer "voce excedeu as
    // tentativas" confirma que a conta existe.
    if (e instanceof AuthError) return { erro: "E-mail ou senha não conferem." };
    throw e;
  }
}

export async function criarConta(
  _anterior: ResultadoAuth | undefined,
  form: FormData,
): Promise<ResultadoAuth | undefined> {
  const nome = String(form.get("nome") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");

  if (!EMAIL_RE.test(email)) return { erro: "Esse e-mail não parece válido." };
  if (senha.length < 8) return { erro: "A senha precisa de pelo menos 8 caracteres." };

  // Cadastro tem freio POR ORIGEM (o alvo aqui nao existe ainda): sem ele, um
  // laco cria mil contas e enche a tabela.
  if (!consumir(`cadastro:${await origem()}`, 5, 3600).ok) {
    return { erro: "Muitas contas criadas daqui. Tente de novo mais tarde." };
  }

  if (await findUserByEmail(email)) return { erro: "Já existe uma conta com esse e-mail." };

  const senhaHash = await bcrypt.hash(senha, 10);
  await createUserWithPassword({ email, nome: nome || null, senhaHash });

  try {
    await signIn("credentials", { email, senha, redirectTo: DESTINO });
  } catch (e) {
    if (e instanceof AuthError) return { erro: "A conta foi criada, mas o login falhou. Tente entrar." };
    throw e;
  }
}

export async function sair() {
  await signOut({ redirectTo: "/entrar" });
}
